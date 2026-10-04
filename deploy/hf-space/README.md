---
title: Tajweed Coach AI Backend
emoji: 🎙️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 5.49.1
python_version: "3.11"
app_file: app.py
startup_duration_timeout: 1h
pinned: false
---

# Tajweed Coach AI — analysis API (إتقان)

FastAPI backend of **Tajweed Coach AI** (مدرّب التجويد الذكي) for the Baddhel × SDAIA AI Challenge.
It runs the open-source `quran-muaalem` model on CPU and exposes `POST /api/analyze` and `GET /health`.

Source code (public): https://github.com/Saden-2/tajweed-coach-ai

This Space contains only a small launcher (`app.py`): at startup it downloads the `backend/` folder
from the GitHub repository and serves it with uvicorn on port 7860.
