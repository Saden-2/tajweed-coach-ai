"""
Local workaround for a confirmed upstream bug in `quran_transcript`
(package `quran-transcript`, imported as `quran_transcript`) that crashes
`quran_phonetizer()` on virtually any real Quranic text.

Root cause (verified against quran-transcript 0.6.1 and 0.6.4 by reading
the installed package source directly, see `tajweed-coach-decisions.md`
for the full write-up):

`quran_transcript.phonetics.sifa.process_sifat()` walks every phoneme
group of the text and, for each group whose first symbol is an alif,
pulls the next entry off a list returned by `alif_tafkheem_tarqeeq_finder()`
to decide whether that alif is "thick" (mofakham) or "thin" (moraqaq).
But `alif_tafkheem_tarqeeq_finder()` only emits one entry per *stretched
madd alif* (its regex requires 2-6 repeated alif characters after a
fatha) - it silently skips any plain, unstretched single alif, such as
the hamzat-wasl alif at the start of the definite article "ال" (present
in a large fraction of all Quranic words). The two lists then go out of
sync and `process_sifat()` eventually indexes past the end of the
shorter list -> `IndexError: list index out of range`.

A second, related bug: `process_sifat()`'s fallback logic
(`parse_tafkheem_sifa`) raises `ValueError` whenever an alif phoneme
group is the very *first* group of the text being processed (no previous
phoneme to look at) - which happens for any ayah that itself begins with
"ال" (e.g. Al-Fatiha 1:2, "الحمد لله...").

Both bugs are upstream, not caused by anything in this project's own
code or test methodology - verified by reproducing them against the
raw, unmodified Basmala and against Al-Fatiha 1:2 directly.

This module patches both functions *in place on the already-imported
`quran_transcript` package*, without touching its installed files, so
the fix travels with this repo and survives a `pip install
quran-transcript` reinstall. Call `apply()` once, before the first call
to `quran_phonetizer()` (MuaalemModelAdapter does this automatically).

Scope / what this fix does NOT do: it only prevents the crash and fills
in the same conservative default the library's own code already uses
elsewhere (see inline comments below) - it does not change or recompute
any tajweed rule that previously worked correctly. See
`test_patch_equivalence` note in tajweed-coach-decisions.md: verified
byte-for-byte identical sifat output, before vs after this patch, for
every input that did not previously crash.

Status: this is a local, reviewed, defensible workaround - not a
substitute for an upstream fix. An issue should still be filed against
https://github.com/obadx/quran_transcript with this file's analysis.
"""

from __future__ import annotations

import re

_PATCHED = False


def apply() -> None:
    """Idempotent: safe to call multiple times / from multiple places."""
    global _PATCHED
    if _PATCHED:
        return

    import quran_transcript.phonetics.sifa as sifa_mod

    ph = sifa_mod.ph
    uth = sifa_mod.uth
    phg = sifa_mod.phg

    _original_parse_tafkheem_sifa = sifa_mod.parse_tafkheem_sifa

    def _fixed_alif_tafkheem_tarqeeq_finder(phonetic_script_with_space: str):
        """
        Fixed version of `alif_tafkheem_tarqeeq_finder`.

        Emits exactly one entry per alif-STARTING phoneme group (matching
        how `process_sifat` consumes this list), instead of one entry per
        *stretched madd* alif only. Non-madd alifs (e.g. the "ال" hamzat
        wasl) get `None`, which `process_sifat` already treats as "no
        override, keep the generic default computed by
        parse_tafkheem_sifa" - this mirrors what the *original* function
        already does for every non-lafdh-al-jalala madd alif too, so this
        is a scope fix, not a behavior change for any case that worked
        before.
        """
        phoneme_with_laam_Allh_reg = (
            f"(?<!{ph.jeem})(?<!{ph.daal})(?<!{ph.taa}{ph.fatha}{ph.waw})"
            f"(.){uth.space}?{ph.lam}{{2}}{ph.fatha}({ph.alif}{{2,6}}){ph.haa}"
            f"(?!{ph.dama}{ph.meem}(?!{ph.meem}))"
        )

        pos_to_phoneme_before_lam_Allah = {}
        for match in re.finditer(
            phoneme_with_laam_Allh_reg, phonetic_script_with_space
        ):
            pos = match.start(2)
            pos_to_phoneme_before_lam_Allah[pos] = match.group(1)

        # Same chunking process_sifat/chunck_phonemes uses, kept here so
        # positions line up exactly with how process_sifat walks groups.
        core_group = "|".join(f"{c}+" for c in phg.core)
        group_pattern = f"(?:{core_group})[{phg.residuals}]?"

        outputs = []
        for m in re.finditer(group_pattern, phonetic_script_with_space):
            group_text = m.group(0)
            if group_text[0] == ph.alif:
                pos = m.start()
                if pos in pos_to_phoneme_before_lam_Allah:
                    before = pos_to_phoneme_before_lam_Allah[pos]
                    outputs.append("moraqaq" if before == ph.kasra else "mofakham")
                else:
                    outputs.append(None)
        return outputs

    def _fixed_parse_tafkheem_sifa(phonemes, idx):
        """
        Fixed version of `parse_tafkheem_sifa`: no longer raises when an
        alif phoneme group is the very first group of the text (no
        preceding phoneme to consult). Defaults to "moraqaq" (thin) -
        there is nothing "thick" before it, so this is the same answer
        the original function already gives for an alif preceded by any
        non-tafkheem/non-raa letter; it just also applies when there is
        no preceding letter at all.
        """
        p_group = phonemes[idx]
        if p_group[0] == ph.alif and idx == 0:
            return "moraqaq"
        return _original_parse_tafkheem_sifa(phonemes, idx)

    sifa_mod.alif_tafkheem_tarqeeq_finder = _fixed_alif_tafkheem_tarqeeq_finder
    sifa_mod.parse_tafkheem_sifa = _fixed_parse_tafkheem_sifa

    _PATCHED = True
