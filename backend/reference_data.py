"""
Reference Qur'an text used to render the recitation screen and to give the
mock model adapter something concrete to compare against.

This is intentionally tiny (Al-Fatiha, ayah 1 = the Basmala) so the whole
stack (frontend design -> API -> response shape) can be wired and tested
end-to-end before real Qur'an-text + audio infrastructure exists.

TODO (real product): replace this with a proper Qur'an text source
(Uthmani script + word boundaries) for all 6236 ayat. The Qur'an Foundation
API (https://api.quran.com) or a local Tanzil/Uthmani dataset are good
starting points; keep the *shape* below (surah, ayah, ayah_number_in_surah,
total_ayat_in_surah, words[]) so the rest of the code doesn't need to change.
"""

from typing import TypedDict


class WordRef(TypedDict):
    id: str
    text: str  # Uthmani script with full tashkeel


class AyahRef(TypedDict):
    surah_number: int
    surah_name_ar: str
    ayah_number: int
    total_ayat: int
    words: list[WordRef]


# Riwayah scope decision (see project notes): Hafs 'an 'Asim only for v1.
RIWAYAH = "hafs"

AYAT: dict[tuple[int, int], AyahRef] = {
    (1, 1): {
        "surah_number": 1,
        "surah_name_ar": "الفاتحة",
        "ayah_number": 1,
        "total_ayat": 7,
        "words": [
            {"id": "w1", "text": "بِسْمِ"},
            {"id": "w2", "text": "اللَّهِ"},
            {"id": "w3", "text": "الرَّحْمَنِ"},
            {"id": "w4", "text": "الرَّحِيمِ"},
        ],
    },
}


def get_ayah(surah_number: int, ayah_number: int) -> AyahRef | None:
    return AYAT.get((surah_number, ayah_number))
