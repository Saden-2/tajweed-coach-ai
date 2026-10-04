"""
Launcher for the Hugging Face Space (Gradio SDK is used only because the free
tier offers it; the app itself is plain FastAPI served by uvicorn on :7860).

At startup it downloads backend/ from the public GitHub repo (so the Space always
runs the repo's latest code after a restart), then serves backend/main.py.
"""
import io
import os
import sys
import tarfile
import urllib.request

REPO_TARBALL = "https://github.com/Saden-2/tajweed-coach-ai/archive/refs/heads/master.tar.gz"
HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, "backend_src")
SKIP_PREFIXES = ("venv", "__pycache__", "_audio_cache", "_analyze_log")


def fetch_backend() -> None:
    with urllib.request.urlopen(REPO_TARBALL, timeout=180) as resp:
        data = resp.read()
    count = 0
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for member in tar.getmembers():
            parts = member.name.split("/")  # <repo>-master/backend/<file>
            if len(parts) < 3 or parts[1] != "backend" or not member.isfile():
                continue
            rel = "/".join(parts[2:])
            if rel.startswith(SKIP_PREFIXES):
                continue
            out = os.path.join(DEST, rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, "wb") as f:
                f.write(tar.extractfile(member).read())
            count += 1
    print(f"[launcher] downloaded {count} backend files into {DEST}", flush=True)


fetch_backend()
sys.path.insert(0, DEST)
os.chdir(DEST)

import uvicorn  # noqa: E402
from main import app  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
