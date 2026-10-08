from __future__ import annotations

import argparse
import os
import platform
import torch

from .config import TrainConfig
from .distributed import cleanup, rank, setup_distributed, world_size


def doctor() -> int:
    print("FIRMI AI 0.1.0")
    print(f"Python: {platform.python_version()}")
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA disponível: {torch.cuda.is_available()}")
    print(f"GPUs: {torch.cuda.device_count()}")
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            print(f"GPU {i}: {torch.cuda.get_device_name(i)}")
    return 0


def train() -> int:
    cfg = TrainConfig.from_env()
    current_rank = setup_distributed()

    if current_rank == 0:
        print(f"FIRMI AI | projeto={cfg.project} | experiência={cfg.experiment}")
        print(f"world_size={world_size()} | precision={cfg.precision}")
        print("Treino de validação do ambiente iniciado.")

    if torch.cuda.is_available():
        x = torch.randn((1024, 1024), device="cuda")
        y = x @ x
        if current_rank == 0:
            print(f"GPU smoke test OK: {float(y.mean()):.6f}")
        del x, y

    cleanup()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="firmai")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("doctor")
    sub.add_parser("train")

    args = parser.parse_args()
    if args.command == "doctor":
        return doctor()
    if args.command == "train":
        return train()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
