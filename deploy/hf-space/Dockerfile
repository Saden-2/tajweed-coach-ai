# Hugging Face Docker Space for the Tajweed Coach AI backend (CPU).
# Pulls backend/ from the public GitHub repo at build time, so the Space itself
# needs only this Dockerfile + README.md. "Factory rebuild" re-fetches the latest code.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates tar \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1
WORKDIR $HOME/app

# Backend source (public repo, master branch)
ARG REPO_TARBALL=https://github.com/Saden-2/tajweed-coach-ai/archive/refs/heads/master.tar.gz
RUN curl -fsSL "$REPO_TARBALL" | tar -xz --strip-components=2 --wildcards '*/backend/*' \
    && ls -la

# CPU-only PyTorch first (much smaller than the default CUDA build), then the rest.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Bake the model weights into the image so a cold start does not re-download ~2.5 GB,
# and fail the build early if the model cannot load.
RUN python -c "from model_adapter import MuaalemModelAdapter; MuaalemModelAdapter(); print('MODEL READY')"

EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
