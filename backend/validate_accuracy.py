"""
Objective sanity test of the REAL analyzer (not a replacement for a human
tajweed teacher). It answers one question: does the analyzer tell a correct
recitation from a wrong one?

Audio: per-ayah recordings of a professional reciter (Mishary Alafasy,
EveryAyah.com) fed to the model as FILES - no speaker/microphone noise.
Text:  the same textUthmani words the app uses (frontend /api/quran route).

Three experiments per ayah:
  A) CORRECT   audio of ayah X  vs text of ayah X            -> should score HIGH
  B) WRONG-AYAH audio of ayah X vs text of a different ayah   -> should score LOW
  C) 1-WORD ERROR audio of ayah X vs text of X where ONE word is replaced by a
     word from another ayah -> that word should be flagged, the rest mostly OK

Usage (from backend/, venv314 active, frontend `npm run dev` running):
    python validate_accuracy.py            # default set (~14 ayat)
    python validate_accuracy.py quick      # 6 ayat, faster
Writes validate_accuracy_report.txt (keep it in the repo as evidence).
Downloaded audio is cached in backend/_audio_cache (gitignored).
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime

import model_adapter
from model_adapter import MuaalemModelAdapter, clean_uthmani

FRONTEND = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
RECITER = "Alafasy_128kbps"
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_audio_cache")
os.makedirs(CACHE, exist_ok=True)

FULL = {112: [1, 2, 3, 4], 108: [1, 2, 3], 103: [1, 2, 3], 106: [1, 2, 3, 4]}
QUICK = {112: [1, 2, 3, 4], 108: [1, 2]}
SET = QUICK if "quick" in sys.argv[1:] else FULL

_text_cache: dict[int, list] = {}


def ayah_words(surah: int, ayah: int) -> list[str]:
    if surah not in _text_cache:
        with urllib.request.urlopen(f"{FRONTEND}/api/quran?surah={surah}", timeout=180) as r:
            _text_cache[surah] = json.load(r)
    for a in _text_cache[surah]:
        if a["verseNumber"] == ayah:
            return [clean_uthmani(w["textUthmani"]) for w in a["words"]
                    if w.get("charTypeName") == "word" and w.get("textUthmani")]
    raise KeyError((surah, ayah))


def audio_bytes(surah: int, ayah: int) -> bytes:
    path = os.path.join(CACHE, f"{surah:03d}{ayah:03d}.mp3")
    if not os.path.exists(path):
        url = f"https://everyayah.com/data/{RECITER}/{surah:03d}{ayah:03d}.mp3"
        req = urllib.request.Request(url, headers={"User-Agent": "tajweed-coach-validation"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    with open(path, "rb") as f:
        return f.read()


def ref(surah: int, ayah: int, words: list[str]):
    return {
        "surah_number": surah, "surah_name_ar": "", "ayah_number": ayah,
        "total_ayat": 0,
        "words": [{"id": str(i), "text": t} for i, t in enumerate(words)],
    }


print("Loading the REAL model (first time can take a few minutes)...")
adapter = MuaalemModelAdapter()
print("Model loaded.\n")

pairs = [(s, a) for s, al in SET.items() for a in al]
lines = [f"Accuracy sanity test {datetime.now().isoformat(timespec='seconds')} "
         f"reciter={RECITER} ayat={len(pairs)}"]


def log(msg=""):
    print(msg, flush=True)
    lines.append(msg)


A, B = [], []
c_detect = c_total = c_fp_words = c_other_words = 0

for idx, (s, a) in enumerate(pairs):
    t0 = time.time()
    wav = audio_bytes(s, a)
    words = ayah_words(s, a)

    # A) correct text
    ra = adapter.analyze(wav, ref(s, a, words))
    A.append(ra.score)

    # B) text of a different ayah (next one in the list, cyclic)
    s2, a2 = pairs[(idx + 1) % len(pairs)]
    other = ayah_words(s2, a2)
    try:
        rb = adapter.analyze(wav, ref(s, a, other))
        B.append(rb.score)
    except Exception as exc:  # noqa: BLE001 - e.g. tokenizer cannot encode that text
        class _R: score = -1
        rb = _R()
        print(f"   (B skipped for {s}:{a}: text {s2}:{a2} cannot be processed: {type(exc).__name__})")

    # C) replace the middle word with the first word of a different ayah
    cmsg = "C: (ayah too short, skipped)"
    if len(words) >= 3:
        k = len(words) // 2
        repl = next((w for w in other if w != words[k]), other[0])
        bad = list(words)
        bad[k] = repl
        try:
            rc = adapter.analyze(wav, ref(s, a, bad))
        except Exception as exc:  # noqa: BLE001
            log(f"{s}:{a}  A={ra.score}%  (C skipped: {type(exc).__name__})")
            continue
        flagged = rc.words[k].status != "correct"
        others_flagged = sum(1 for i, w in enumerate(rc.words) if i != k and w.status != "correct")
        c_total += 1
        c_detect += int(flagged)
        c_fp_words += others_flagged
        c_other_words += len(rc.words) - 1
        cmsg = (f"C: replaced word #{k+1} -> {'DETECTED' if flagged else 'missed'}, "
                f"{others_flagged}/{len(rc.words)-1} other words also flagged")
    log(f"{s}:{a}  A(correct text)={ra.score}%   B(wrong ayah)={'n/a' if rb.score < 0 else str(rb.score) + '%'}" f"   {cmsg}   [{time.time()-t0:.0f}s]")

mean = lambda xs: sum(xs) / len(xs) if xs else 0
log("")
log("=== SUMMARY ===")
log(f"A  correct text   : mean score {mean(A):.0f}%  (min {min(A)}%, max {max(A)}%)  -> want HIGH")
log(f"B  wrong-ayah text: mean score {mean(B):.0f}%  (min {min(B)}%, max {max(B)}%)  -> want LOW")
log(f"Gap A-B = {mean(A)-mean(B):.0f} points  (bigger = the analyzer separates right from wrong better)")
if c_total:
    log(f"C  1-word error   : detected {c_detect}/{c_total} replaced words; "
        f"other words wrongly flagged {c_fp_words}/{c_other_words}")
log("")
log("Reading it: if A is low, the analyzer is TOO STRICT (false alarms on a correct")
log("professional recitation). If A and B are close, it is not discriminating.")
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "validate_accuracy_report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print("\nreport written to validate_accuracy_report.txt")
