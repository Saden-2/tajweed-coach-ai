"""
Second pre-flight (the first, validate_scope.py, only checks phonetization):
does the REAL model's tokenizer accept each ayah's phonetic script? The
accuracy test crashed on 108:1 with "Unable to create tensor ... NoneType":
a phoneme the tokenizer vocabulary does not know. That would be a 500 error
for the learner, so we list every such ayah (and the offending characters).

Usage (from backend/, venv314 active, frontend `npm run dev` running):
    python validate_tokens.py            # all Juz Amma (78-114)
    python validate_tokens.py 108 108    # custom surah range
Writes validate_tokens_report.txt (kept as evidence). Does NOT run the
neural network, so it is fast.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime

from model_adapter import MuaalemModelAdapter, clean_uthmani
from quran_transcript import MoshafAttributes, quran_phonetizer

FRONTEND = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
first = int(sys.argv[1]) if len(sys.argv) > 1 else 78
last = int(sys.argv[2]) if len(sys.argv) > 2 else 114

adapter = MuaalemModelAdapter()
tok = adapter._muaalem.multi_level_tokenizer
phon_vocab = set(tok.level_to_tokenizer["phonemes"].get_vocab().keys())
moshaf = MoshafAttributes(rewaya="hafs", madd_monfasel_len=4, madd_mottasel_len=4,
                          madd_mottasel_waqf=4, madd_aared_len=4)

lines = [f"Tokenizer validation {datetime.now().isoformat(timespec='seconds')} surahs {first}-{last}"]
bad, total = [], 0


def log(m):
    print(m, flush=True)
    lines.append(m)


def check(words: list[str]):
    out = quran_phonetizer(" ".join(words), moshaf, remove_spaces=True)
    unknown = sorted({c for c in out.phonemes if c not in phon_vocab})
    tok.tokenize([out.phonemes], [out.sifat], to_dict=True, return_tensors="pt", padding="longest")
    return unknown


for s in range(first, last + 1):
    with urllib.request.urlopen(f"{FRONTEND}/api/quran?surah={s}", timeout=180) as r:
        ayat = json.load(r)
    s_bad = []
    for a in ayat:
        words = [clean_uthmani(w["textUthmani"]) for w in a["words"] if w.get("charTypeName") == "word" and w.get("textUthmani")]
        words = [w for w in words if w]
        total += 1
        try:
            unknown = check(words)
            if unknown:  # tokenized but with unknown chars (informational)
                s_bad.append((a["verseNumber"], f"unknown chars {[hex(ord(c)) for c in unknown]}"))
        except Exception as exc:  # noqa: BLE001
            try:
                unknown = sorted({c for c in quran_phonetizer(" ".join(words), moshaf, remove_spaces=True).phonemes if c not in phon_vocab})
            except Exception:  # noqa: BLE001
                unknown = []
            s_bad.append((a["verseNumber"], f"FAIL {type(exc).__name__}; unknown chars {[hex(ord(c)) + ' ' + c for c in unknown]}; word codepoints: " + " | ".join(" ".join(f"{ord(c):04x}" for c in w) for w in words if any(ord(c) in (0x622, 0x653) for c in w))))
    log(f"surah {s}: {len(ayat) - len(s_bad)}/{len(ayat)} ayat OK" + ("" if not s_bad else "   <-- problems: " + "; ".join(f"{n}:{m}" for n, m in s_bad)))
    bad += [(s, n, m) for n, m in s_bad]

log("")
log(f"TOTAL: {total - len(bad)}/{total} ayat tokenize cleanly")
for s, n, m in bad:
    log(f"  {s}:{n} -> {m}")
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "validate_tokens_report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print("report written to validate_tokens_report.txt")
