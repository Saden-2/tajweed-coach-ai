"""
Model adapter layer.

The API layer (main.py) never talks to a model directly - it calls
`get_adapter()` and uses whatever adapter that returns. This is what lets
the whole product (frontend, API contract, later the mobile app) get built
and tested *today* against MockModelAdapter, then swapped for the real
fine-tuned model later without touching anything else.

Two adapters ship here:

- MockModelAdapter: deterministic canned response. No ML, no GPU. Always
  available. Good enough to develop and demo the full product flow.

- MuaalemModelAdapter: a real integration against the `quran-muaalem`
  package (https://github.com/obadx/quran-muaalem), which is the
  open-source base the product's research notes are built on. It is
  written against the real usage documented for that package, but it is
  NOT expected to run in this sandbox (no GPU, and the package likely
  isn't installed here) - it's here so that switching to a real baseline
  is a one-line change (see get_adapter()) once you're running this
  somewhere with the dependency installed. Validate it first with the
  Colab notebook in ../colab/ before wiring it into a live API.

IMPORTANT: MuaalemModelAdapter gives you phonemes + sifat (tajweed
articulation features) from the model - it does NOT by itself decide
"warn" vs "error" vs a human-readable rule name. `_sifat_to_words()` below
IS now implemented (see notes on it), but the "any mismatch = error"
threshold it uses is a first pass, not tuned - it still needs calibration
against the human-evaluator ground truth (Tier-1/Tier-2 split in the
validation plan) before this adapter is trusted for real users. Until
that calibration happens, keep using MockModelAdapter for anything
user-facing.

`_sifat_to_words()` does NOT reimplement phoneme alignment from scratch -
it reuses `quran_muaalem.explain.expalin_sifat`, the same alignment/
comparison function the quran-muaalem authors ship in their own Gradio
demo (uses Google's diff-match-patch to align predicted vs expected
phonemes robustly across insertions/deletions/substitutions, then
compares each of the 10 sifat attributes group-by-group). Reusing it
instead of hand-rolling alignment avoids a whole class of subtle bugs.
"""

from __future__ import annotations

import io
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal

from reference_data import AyahRef

logger = logging.getLogger("tajweed_coach.model_adapter")

WordStatus = Literal["correct", "warn", "error"]

# Arabic display names for each of the 10 sifat (articulation attribute)
# categories the model predicts per phoneme. These are standard tajweed
# terminology, not invented here.
SIFAT_AR_NAMES: dict[str, str] = {
    "hams_or_jahr": "الهمس والجهر",
    "shidda_or_rakhawa": "الشدة والرخاوة",
    "tafkheem_or_taqeeq": "التفخيم والترقيق",
    "itbaq": "الإطباق والانفتاح",
    "safeer": "الصفير",
    "qalqla": "القلقلة",
    "tikraar": "التكرار (الراء)",
    "tafashie": "التفشي (الشين)",
    "istitala": "الاستطالة (الضاد)",
    "ghonna": "الغنة",
}

# Arabic labels for each attribute's possible values (both sides of every
# binary/ternary sifa), used to render "متوقع X لكن سُمع Y" explanations.
SIFAT_VALUE_AR: dict[str, str] = {
    "hams": "مهموس",
    "jahr": "مجهور",
    "shadeed": "شديد",
    "between": "بين الشدة والرخاوة",
    "rikhw": "رخو",
    "mofakham": "مفخم",
    "moraqaq": "مرقق",
    "low_mofakham": "مفخم قليلاً",
    "monfateh": "منفتح",
    "motbaq": "مطبق",
    "safeer": "فيه صفير",
    "no_safeer": "بدون صفير",
    "moqalqal": "فيه قلقلة",
    "not_moqalqal": "بدون قلقلة",
    "mokarar": "فيه تكرار",
    "not_mokarar": "بدون تكرار",
    "motafashie": "فيه تفشي",
    "not_motafashie": "بدون تفشي",
    "mostateel": "فيه استطالة",
    "not_mostateel": "بدون استطالة",
    "maghnoon": "بغنة",
    "not_maghnoon": "بدون غنة",
}


@dataclass
class WordResult:
    id: str
    text: str
    status: WordStatus
    issue_title: str | None = None
    issue_description: str | None = None


@dataclass
class AnalysisResult:
    score: int  # 0-100
    words: list[WordResult] = field(default_factory=list)

    @property
    def correct_count(self) -> int:
        return sum(1 for w in self.words if w.status == "correct")

    @property
    def warn_count(self) -> int:
        return sum(1 for w in self.words if w.status == "warn")

    @property
    def error_count(self) -> int:
        return sum(1 for w in self.words if w.status == "error")


class ModelAdapter(ABC):
    @abstractmethod
    def analyze(self, audio_bytes: bytes, ayah: AyahRef) -> AnalysisResult:
        """Analyze a recitation recording against the given ayah reference."""
        raise NotImplementedError


class MockModelAdapter(ModelAdapter):
    """
    Deterministic canned response, matching the interactive design mockup
    (Bismillah: two correct words, one 'needs improvement', one 'error').

    This intentionally ignores the actual audio content - it exists so the
    rest of the stack has something real to build and test against while
    the real model integration is validated separately.
    """

    def analyze(self, audio_bytes: bytes, ayah: AyahRef) -> AnalysisResult:
        del audio_bytes  # unused in the mock

        words: list[WordResult] = []
        for w in ayah["words"]:
            if w["text"] == "الرَّحْمَنِ":
                words.append(
                    WordResult(
                        id=w["id"],
                        text=w["text"],
                        status="warn",
                        issue_title="تفخيم الراء (Tafkhim)",
                        issue_description=(
                            "الراء في «الرَّحْمَنِ» مفتوحة، لذا يجب تفخيمها "
                            "(نطقها سميكة وممتلئة)، ولاحظنا ترقيقًا خفيفًا لها."
                        ),
                    )
                )
            elif w["text"] == "الرَّحِيمِ":
                words.append(
                    WordResult(
                        id=w["id"],
                        text=w["text"],
                        status="error",
                        issue_title="المدّ الطبيعي (Natural Madd)",
                        issue_description=(
                            "الياء في «الرَّحِيمِ» حرف مدّ أصلي، ويجب مطّها بمقدار "
                            "حركتين. لاحظنا أن زمن المدّ جاء أقصر من المطلوب."
                        ),
                    )
                )
            else:
                words.append(WordResult(id=w["id"], text=w["text"], status="correct"))

        return AnalysisResult(score=78, words=words)


class MuaalemModelAdapter(ModelAdapter):
    """
    Real integration against obadx/quran-muaalem (model checkpoint:
    obadx/muaalem-model-v3_2, ~660M params, needs ~1.5GB VRAM).

    Not exercised in this sandbox. Validate against qdat_bench in the Colab
    notebook first; only then point the API at this adapter.
    """

    def __init__(self, device: str | None = None) -> None:
        try:
            import torch  # noqa: F401

            # Workaround for a real bug in quran-muaalem: it imports a
            # private transformers constant (_HIDDEN_STATES_START_POSITION)
            # from transformers.models.wav2vec2_bert.modeling_wav2vec2_bert,
            # which that module doesn't actually define in current
            # transformers releases (verified against both the package's
            # own minimum pin and the latest release - absent in both).
            # The same constant (value 2) exists in the sibling
            # transformers/models/wav2vec2/modeling_wav2vec2.py, used the
            # exact same way (outputs[_HIDDEN_STATES_START_POSITION:] to
            # keep hidden_states/attentions while swapping in custom
            # logits) - quran-muaalem's own code uses that identical
            # pattern, so injecting the same value here is safe, not a
            # guess. Remove this block once quran-muaalem fixes it upstream
            # (the hasattr guard makes it a no-op once they do).
            import transformers.models.wav2vec2_bert.modeling_wav2vec2_bert as _w2v2bert_mod

            if not hasattr(_w2v2bert_mod, "_HIDDEN_STATES_START_POSITION"):
                _w2v2bert_mod._HIDDEN_STATES_START_POSITION = 2
                logger.warning(
                    "Patched missing transformers._HIDDEN_STATES_START_POSITION "
                    "(quran-muaalem import workaround)."
                )

            from quran_muaalem import Muaalem  # type: ignore
        except ImportError as exc:  # pragma: no cover - expected in this sandbox
            raise RuntimeError(
                "quran-muaalem is not installed. Install it with "
                "`pip install quran-muaalem librosa \"numba>=0.61.2\"` "
                "(plus `apt-get install -y ffmpeg libsndfile1 portaudio19-dev`) "
                "on a machine with a GPU, or keep using MockModelAdapter here."
            ) from exc

        import torch

        resolved_device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading quran-muaalem model on device=%s", resolved_device)
        self._muaalem = Muaalem(device=resolved_device)

    def analyze(self, audio_bytes: bytes, ayah: AyahRef) -> AnalysisResult:
        from librosa import load
        from quran_transcript import MoshafAttributes, quran_phonetizer

        wave, _ = load(io.BytesIO(audio_bytes), sr=16000, mono=True)

        uthmani_ref = " ".join(w["text"] for w in ayah["words"])
        # NOTE: these 4 madd-length fields are REQUIRED by MoshafAttributes
        # (rewaya="hafs" alone is not enough - pydantic will reject it).
        # Values match quran-muaalem's own shipped default
        # (quran_muaalem/app/types.py: DEFAULT_MOSHAF) - a valid, common
        # choice within Hafs 'an 'Asim, not the only correct one.
        moshaf = MoshafAttributes(
            rewaya="hafs",
            madd_monfasel_len=4,
            madd_mottasel_len=4,
            madd_mottasel_waqf=4,
            madd_aared_len=4,
        )
        phonetizer_out = quran_phonetizer(uthmani_ref, moshaf, remove_spaces=True)

        outs = self._muaalem([wave], [phonetizer_out], sampling_rate=16000)

        return self._sifat_to_words(outs[0], ayah, moshaf)

    def _sifat_to_words(
        self, muaalem_output, ayah: AyahRef, moshaf
    ) -> AnalysisResult:
        """
        Turns the model's predicted phonemes+sifat into per-word
        correct/warn/error verdicts with a named rule + Arabic explanation.

        How it works:
        1. Reuse `quran_muaalem.explain.expalin_sifat` (the same function
           the quran-muaalem authors use in their own demo) to align the
           predicted phoneme sequence against the expected one - via
           Google's diff-match-patch, so insertions/deletions/
           substitutions are handled properly, not naive index zipping -
           and get a table comparing each of the 10 sifat attributes
           group-by-group.
        2. Slice that table into per-WORD chunks. This is done by
           phonetizing each word of the ayah *individually* to count how
           many phoneme-groups it produces, then taking that many rows
           off the front of the table for each word in order.

           KNOWN LIMITATION: phonetizing words individually ignores
           cross-word tajweed effects (e.g. idgham/ikhfa/iqlab where one
           word's final letter merges into the next word's first letter).
           Those merged phonemes can end up attributed to the wrong side
           of a word boundary. Good enough for a first pass; if per-word
           results look off specifically at word boundaries, that's why -
           fixing it means using `phonetizer_out.mappings` (character-
           position -> tajweed-rule spans on the *whole-ayah* phonetic
           output) instead of per-word re-phonetizing.
        3. Any sifat mismatch (or an inserted/extra sound) inside a word's
           slice marks that word "error" with the first mismatched
           attribute as the named rule. This "any mismatch = error, no
           warn tier yet" rule is a deliberately simple first pass - it is
           NOT calibrated against human judgments. Before this adapter is
           trusted for real users, tune the warn/error split (and maybe
           the moshaf-length assumptions above) against the human
           evaluator panel results (see the validation plan doc).
        """
        from quran_muaalem.explain import expalin_sifat
        from quran_transcript import quran_phonetizer
        import diff_match_patch as dmp

        uthmani_ref = " ".join(w["text"] for w in ayah["words"])
        ref_out = quran_phonetizer(uthmani_ref, moshaf, remove_spaces=True)

        dmp_obj = dmp.diff_match_patch()
        diffs = dmp_obj.diff_main(ref_out.phonemes, muaalem_output.phonemes.text)
        table = expalin_sifat(muaalem_output.sifat, ref_out.sifat, diffs)

        # Per-word phoneme-group counts (see KNOWN LIMITATION above).
        word_group_counts = []
        for w in ayah["words"]:
            w_out = quran_phonetizer(w["text"], moshaf, remove_spaces=True)
            word_group_counts.append(len(w_out.sifat))

        words: list[WordResult] = []
        table_idx = 0
        for w, count in zip(ayah["words"], word_group_counts):
            word_rows = table[table_idx : table_idx + count]
            table_idx += count

            issue: tuple[str, str] | None = None
            for row in word_rows:
                if row["tag"] == "insert":
                    issue = (
                        "صوت زائد",
                        f"سُمع صوت «{row['phonemes']}» غير موجود بالنص.",
                    )
                    break
                for attr, ar_name in SIFAT_AR_NAMES.items():
                    exp_v = row.get(f"exp_{attr}")
                    got_v = row.get(attr)
                    if not exp_v or not got_v or got_v == "None":
                        continue
                    if exp_v != got_v:
                        issue = (
                            ar_name,
                            f"المتوقع «{SIFAT_VALUE_AR.get(exp_v, exp_v)}» "
                            f"لكن سُمع «{SIFAT_VALUE_AR.get(got_v, got_v)}».",
                        )
                        break
                if issue:
                    break

            if issue is None:
                words.append(WordResult(id=w["id"], text=w["text"], status="correct"))
            else:
                title, desc = issue
                # TODO: no "warn" tier yet - every mismatch is "error"
                # until this is calibrated against human judgments.
                words.append(
                    WordResult(
                        id=w["id"],
                        text=w["text"],
                        status="error",
                        issue_title=title,
                        issue_description=desc,
                    )
                )

        correct = sum(1 for w in words if w.status == "correct")
        score = round(100 * correct / len(words)) if words else 0
        return AnalysisResult(score=score, words=words)


def get_adapter() -> ModelAdapter:
    """
    Single place that decides which adapter the API uses. Flip this to
    MuaalemModelAdapter() once `_sifat_to_words` is implemented and
    validated - nothing else in the API needs to change.
    """
    return MockModelAdapter()
