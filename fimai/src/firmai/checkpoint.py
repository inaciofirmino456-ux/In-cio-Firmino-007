from __future__ import annotations

from pathlib import Path
import json
import torch


class CheckpointManager:
    """Small, explicit checkpoint manager for resumable experiments."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(
        self,
        name: str,
        *,
        model=None,
        optimizer=None,
        step: int = 0,
        metadata: dict | None = None,
    ) -> Path:
        target = self.root / name
        target.mkdir(parents=True, exist_ok=True)

        state = {"step": step, "metadata": metadata or {}}
        if model is not None:
            state["model"] = model.state_dict()
        if optimizer is not None:
            state["optimizer"] = optimizer.state_dict()

        torch.save(state, target / "checkpoint.pt")
        (target / "metadata.json").write_text(
            json.dumps(state["metadata"], indent=2),
            encoding="utf-8",
        )
        return target

    def load(self, name: str, *, model=None, optimizer=None, map_location="cpu"):
        path = self.root / name / "checkpoint.pt"
        state = torch.load(path, map_location=map_location, weights_only=False)

        if model is not None and "model" in state:
            model.load_state_dict(state["model"])
        if optimizer is not None and "optimizer" in state:
            optimizer.load_state_dict(state["optimizer"])

        return state
