---
title: Tajweed Coach AI Backend
emoji: 🎙️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Tajweed Coach AI — analysis API (إتقان)

FastAPI backend of **Tajweed Coach AI** (مدرّب التجويد الذكي) for the Baddhel × SDAIA AI Challenge.
It runs the open-source `quran-muaalem` model on CPU and exposes `POST /api/analyze` and `GET /health`.

Source code (public): https://github.com/Saden-2/tajweed-coach-ai
This Space only contains the Dockerfile; at build time it downloads the `backend/` folder from the GitHub repository.
