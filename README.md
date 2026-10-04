# Tajweed Coach AI — مدرّب التجويد الذكي

AI-assisted tajweed practice for Juz Amma. The learner **listens** to a professional reciter, **records** their own recitation, and gets **word-by-word feedback** — with a clear "preliminary estimate" notice: a certified tajweed teacher remains the final reference.

Submission to the **Bathil × SDAIA AI Challenge**, track 03 (interactive experiences and the learning journey).

- **Live demo:** https://tajweed-coach-ai.vercel.app  
  (the AI backend runs on a free-tier serverless host: the first analysis after a long idle can take 1–3 minutes while the model wakes up)
- Pre-challenge baseline and what was built during the challenge: see [`DISCLOSURE.md`](DISCLOSURE.md)
- Content, data and model sources and how they were verified: see [`SOURCES.md`](SOURCES.md)

## What it does

| Feature | Scope |
|---|---|
| Mushaf reading view (QCF page glyphs, basmala, surah banner, text size control, comfortable/page modes, night mode) | All 114 surahs |
| Listen to a reciter, ayah by ayah, with continuous play (11 reciters) | All 6,236 ayat |
| Record and get word-level tajweed feedback (correct / needs work / error) from an AI model | Juz Amma (surahs 78–114) |
| English meaning under the ayah (Saheeh International) | Juz Amma |
| Surah list with Meccan/Medinan and ayah count; Arabic + English UI toggle | All surahs |

Works on phones, tablets and desktop (responsive layout; the mushaf page fits any screen width).

## Architecture

```
Browser (Next.js app)  ──►  /api/quran  (Next.js route: Quran text, public Quran.com API)
        │
        └─ audio (webm)  ──►  FastAPI backend  ──►  quran-muaalem model (Wav2Vec2-BERT)
                              POST /api/analyze        + quran-transcript phonetizer
```

- `app/` — Next.js 16 frontend (React, Tailwind). Reusable pieces: `AyahPlayer` (listen), `QuranText` (mushaf view), `RecitationPanel` (record + feedback), `SurahList`, `ThemeToggle`.
- `backend/` — FastAPI service. The AI sits behind one interface (`ModelAdapter` in `backend/model_adapter.py`): swap the adapter to use a different model without touching the API or the UI. A mock adapter is included for UI work without a GPU/model.
- `deploy/modal/modal_app.py` — one-file serverless deployment of the backend on [Modal](https://modal.com).

## Run locally

Requirements: Node 20+, Python 3.10+ (3.11 recommended).

**1. Frontend**

```bash
npm install
cp .env.example .env.local     # edit if needed
npm run dev                    # http://localhost:3000
```

**2. Backend** (real model; first start downloads ~2.5 GB from Hugging Face)

```bash
cd backend
python -m venv venv && source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

The frontend talks to `http://localhost:8000` by default. More backend details: [`backend/README.md`](backend/README.md).

## Configuration (environment variables)

| Variable | Where | Meaning |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | frontend | URL of the analysis backend (default `http://localhost:8000`). Public, not a secret. |
| `QURAN_CLIENT_ID`, `QURAN_CLIENT_SECRET` | frontend server (optional) | Quran Foundation API credentials. Without them the app uses the public Quran.com API. **Never commit them.** |
| `WARMUP=0` | backend (optional) | Skip loading the model at server start. |

No secret is required to run or deploy the demo. `.env*` files are git-ignored.

## Deploy

- **Backend (Modal):** `pip install modal && modal setup && modal deploy deploy/modal/modal_app.py` — prints the backend URL. Scale-to-zero, so it costs nothing while idle.
- **Frontend (Vercel):** import the GitHub repo, set `NEXT_PUBLIC_BACKEND_URL` to the Modal URL, deploy. Pushes to `master` redeploy automatically.

## Reuse it

- **Another model or engine:** implement the `ModelAdapter` interface (`analyze(audio, surah, ayah, words) -> AnalysisResult`) and return it from `get_adapter()`.
- **Another scope:** change the Juz Amma constants (`JUZ_AMMA_FIRST_SURAH` / `JUZ_AMMA_LAST_SURAH`) in `app/components/RecitationPanel.tsx`; check coverage with `backend/validate_scope.py` and `backend/validate_tokens.py`.
- **Another reciter:** add an entry to `RECITERS` in `app/components/AyahPlayer.tsx` (any [EveryAyah](https://everyayah.com) folder name).
- **UI components** are self-contained and take plain props, so they can be dropped into another Next.js app.

## Limitations (please read)

- The tajweed feedback is a **preliminary estimate** from an experimental model: the warn/error thresholds are **not calibrated yet**, and it was tested on a small number of samples (see `DISCLOSURE.md`). It can be wrong, e.g. it may flag a light qalqalah at a stop, and when a whole word is skipped it detects that something is wrong but cannot point to the exact word.
- It is a training aid, **not a replacement for a certified teacher**, who remains the final reference.
- Audio is processed only to produce the feedback; this prototype does not store recordings or build any profile of the user.

## Credits and licenses

Model `quran-muaalem` and `quran-transcript` (Obadx), Quran text/fonts and translation via Quran.com / Quran Foundation, reciter audio via EveryAyah, Amiri Quran font (SIL OFL). Details and open license checks in [`SOURCES.md`](SOURCES.md).
