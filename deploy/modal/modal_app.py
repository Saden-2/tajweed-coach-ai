"""
Serverless deployment of the Tajweed Coach AI backend on Modal (https://modal.com).

Why Modal: the model (quran-muaalem, ~660M params) needs a few GB of RAM; the free
tiers of the usual hosts either lack the memory or lock CPU/Docker behind a paid plan.
Modal gives free monthly credits and scales to zero when idle, so it costs nothing while nobody uses it.

Deploy (from the repo root, with the Python venv active and `pip install modal`):
    modal setup                                   # one-time login in the browser
    modal deploy deploy/modal/modal_app.py        # prints the public URL

The printed URL (https://<workspace>--tajweed-coach-ai-api-web.modal.run) is what the
frontend uses as NEXT_PUBLIC_BACKEND_URL. The first request after an idle period has to
start a container and load the model (about 1-2 minutes); later requests take seconds.
"""
from pathlib import Path

import modal

BACKEND = Path(__file__).resolve().parent.parent.parent / "backend"
BACKEND_FILES = ["main.py", "model_adapter.py", "qt_alif_patch.py", "reference_data.py"]

app = modal.App("tajweed-coach-ai")

# Caches the downloaded model weights between cold starts.
hf_cache = modal.Volume.from_name("tajweed-hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi>=0.115",
        "uvicorn[standard]>=0.30",
        "python-multipart>=0.0.9",
        "pydantic>=2.7",
        "torch>=2.0",
        "transformers>=4.40",
        "quran-muaalem",
        "quran-transcript",
        "librosa",
        "av",
        "numba>=0.61.2",
        "diff-match-patch",
    )
    .env({"HF_HOME": "/cache/hf", "WARMUP": "0"})
)
for name in BACKEND_FILES:
    image = image.add_local_file(BACKEND / name, f"/root/backend/{name}")


@app.cls(
    image=image,
    # CPU on purpose: Modal asks for a payment method before it allows GPU functions.
    # Switch to gpu="T4" later (analysis in seconds instead of ~1 minute) if a payment
    # method is added to the Modal account.
    cpu=4.0,
    memory=16384,
    timeout=900,
    scaledown_window=120,  # shorter idle window = less compute spent while nobody uses it
    volumes={"/cache": hf_cache},
)
class Api:
    @modal.enter()
    def load_model(self):
        import os
        import sys

        sys.path.insert(0, "/root/backend")
        os.chdir("/root/backend")
        from model_adapter import MuaalemModelAdapter, get_adapter

        adapter = get_adapter()  # loads once; falls back to Mock only if loading fails
        if not isinstance(adapter, MuaalemModelAdapter):
            raise RuntimeError("Real model failed to load - see the container logs above.")
        hf_cache.commit()

    @modal.asgi_app()
    def web(self):
        from main import app as fastapi_app

        return fastapi_app
