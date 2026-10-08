from __future__ import annotations

import os
import torch
import torch.distributed as dist


def is_distributed() -> bool:
    return dist.is_available() and dist.is_initialized()


def setup_distributed() -> int:
    """Initialize torch.distributed when launched by torchrun."""
    if not dist.is_available():
        return 0

    world_size = int(os.environ.get("WORLD_SIZE", "1"))
    if world_size > 1 and not dist.is_initialized():
        backend = "nccl" if torch.cuda.is_available() else "gloo"
        dist.init_process_group(backend=backend)

    if torch.cuda.is_available():
        local_rank = int(os.environ.get("LOCAL_RANK", "0"))
        torch.cuda.set_device(local_rank)

    return int(os.environ.get("RANK", "0"))


def rank() -> int:
    return int(os.environ.get("RANK", "0"))


def world_size() -> int:
    return int(os.environ.get("WORLD_SIZE", "1"))


def cleanup() -> None:
    if is_distributed():
        dist.barrier()
        dist.destroy_process_group()
