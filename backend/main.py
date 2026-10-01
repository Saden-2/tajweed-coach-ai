"""
Tajweed Coach AI - backend API skeleton.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Then:
    curl http://localhost:8000/health
    curl http://localhost:8000/api/ayah/1/1
    curl -F "audio=@your_recording.wav" http://localhost:8000/api/analyze?surah=1&ayah=1

See README.md for the full contract and what's real vs. mocked.
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model_adapter import get_adapter
from reference_data import get_ayah

app = FastAPI(title="Tajweed Coach AI API", version="0.1.0")

# Wide open for local dev against the design prototype. Tighten this to the
# real frontend's origin before shipping anywhere near production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class WordOut(BaseModel):
    id: str
    text: str
    # Pydantic resolves these annotations at class-creation time to build
    # its validators, so `from __future__ import annotations` alone does
    # NOT make `X | None` work on Python < 3.10 here (unlike plain
    # functions/dataclasses elsewhere in this project) - using
    # `Optional[str]` keeps this working on Python 3.9 too.
    status: Optional[str] = None  # None on the /api/ayah endpoint (no analysis yet)
    issue_title: Optional[str] = None
    issue_description: Optional[str] = None


class AyahOut(BaseModel):
    surah_number: int
    surah_name_ar: str
    ayah_number: int
    total_ayat: int
    words: list[WordOut]


class AnalyzeOut(BaseModel):
    score: int
    correct_count: int
    warn_count: int
    error_count: int
    words: list[WordOut]


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/ayah/{surah}/{ayah}", response_model=AyahOut)
def get_ayah_text(surah: int, ayah: int) -> AyahOut:
    ref = get_ayah(surah, ayah)
    if ref is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Ayah {surah}:{ayah} isn't in the reference data yet - only "
                "Al-Fatiha 1:1 is seeded for now. See reference_data.py."
            ),
        )
    return AyahOut(
        surah_number=ref["surah_number"],
        surah_name_ar=ref["surah_name_ar"],
        ayah_number=ref["ayah_number"],
        total_ayat=ref["total_ayat"],
        words=[WordOut(id=w["id"], text=w["text"]) for w in ref["words"]],
    )


@app.post("/api/analyze", response_model=AnalyzeOut)
async def analyze_recitation(surah: int, ayah: int, audio: UploadFile) -> AnalyzeOut:
    ref = get_ayah(surah, ayah)
    if ref is None:
        raise HTTPException(
            status_code=404,
            detail=f"Ayah {surah}:{ayah} isn't in the reference data yet.",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload.")

    adapter = get_adapter()
    result = adapter.analyze(audio_bytes, ref)

    return AnalyzeOut(
        score=result.score,
        correct_count=result.correct_count,
        warn_count=result.warn_count,
        error_count=result.error_count,
        words=[
            WordOut(
                id=w.id,
                text=w.text,
                status=w.status,
                issue_title=w.issue_title,
                issue_description=w.issue_description,
            )
            for w in result.words
        ],
    )
