import os
"""
Pre-flight check for the supported scope (Juz Amma, surahs 78-114).

For every ayah it runs the SAME text -> phonetics steps the analyzer runs
(MuaalemModelAdapter.analyze + _sifat_to_words): phonetize the whole ayah,
then phonetize each word on its own. If any ayah raises, the learner would
hit a 500 error on it - so we want to know BEFORE shipping, not in the demo.

The Quran text comes from the frontend's own /api/quran route (the exact
textUthmani words the analyzer receives at runtime), so the Next.js dev
server must be running, and the Python venv (venv314) must be active.

Usage, from backend/:
    python validate_scope.py            # all of Juz Amma (78-114)
    python validate_scope.py 1 1        # a custom surah range (e.g. Al-Fatiha)

Writes validate_scope_report.txt next to this file (kept in the repo as
verification evidence).
"""
import json
import sys
import urllib.request
from datetime import datetime

from qt_alif_patch import apply as apply_qt_alif_patch

apply_qt_alif_patch()

from quran_transcript import MoshafAttributes, quran_phonetizer  # noqa: E402

first = int(sys.argv[1]) if len(sys.argv) > 1 else 78
last = int(sys.argv[2]) if len(sys.argv) > 2 else 114
if len(sys.argv) > 3:
    os.environ["FRONTEND_URL"] = sys.argv[3]
BASE = (sys.argv[3] if len(sys.argv) > 3 else os.environ.get("FRONTEND_URL", "http://localhost:3000")).rstrip("/")

moshaf = MoshafAttributes(
    rewaya="hafs",
    madd_monfasel_len=4,
    madd_mottasel_len=4,
    madd_mottasel_waqf=4,
    madd_aared_len=4,
)

total = 0
passed = 0
failures = []
lines = [f"Scope validation {datetime.now().isoformat(timespec='seconds')}  surahs {first}-{last}"]

for surah in range(first, last + 1):
    try:
        with urllib.request.urlopen(f"{BASE}/api/quran?surah={surah}", timeout=180) as r:
            ayat = json.load(r)
    except Exception as exc:  # noqa: BLE001
        msg = f"surah {surah}: COULD NOT FETCH TEXT ({exc})"
        print(msg)
        lines.append(msg)
        failures.append((surah, 0, f"fetch failed: {exc}"))
        continue

    s_total = s_ok = 0
    for a in ayat:
        words = [
            w["textUthmani"]
            for w in a.get("words", [])
            if w.get("charTypeName") == "word" and w.get("textUthmani")
        ]
        total += 1
        s_total += 1
        try:
            if not words:
                raise ValueError("no textUthmani words")
            quran_phonetizer(" ".join(words), moshaf, remove_spaces=True)
            for w in words:
                quran_phonetizer(w, moshaf, remove_spaces=True)
            passed += 1
            s_ok += 1
        except Exception as exc:  # noqa: BLE001
            failures.append((surah, a.get("verseNumber"), f"{type(exc).__name__}: {exc}"))

    msg = f"surah {surah}: {s_ok}/{s_total} ayat OK"
    print(msg)
    lines.append(msg)

lines.append("")
lines.append(f"TOTAL: {passed}/{total} ayat passed")
if failures:
    lines.append("FAILURES:")
    for surah, ayah, err in failures:
        lines.append(f"  {surah}:{ayah}  {err}")
summary = "\n".join(lines)
print("\n" + lines[-1] if not failures else "\n" + summary)
with open("validate_scope_report.txt", "w", encoding="utf-8") as f:
    f.write(summary + "\n")
print("report written to validate_scope_report.txt")
