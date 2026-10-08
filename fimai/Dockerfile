FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv git openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY pyproject.toml README.md ./
COPY src ./src

RUN python3 -m pip install --upgrade pip && \
    python3 -m pip install -e .

CMD ["python3", "-m", "firmai.cli", "doctor"]
