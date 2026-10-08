from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(slots=True)
class TrainConfig:
    project: str = "firmai"
    experiment: str = "smoke"
    checkpoint_dir: Path = Path(".firmai/checkpoints")
    seed: int = 42
    precision: str = "bf16"

    @classmethod
    def from_env(cls) -> "TrainConfig":
        return cls(
            project=os.getenv("FIRMAI_PROJECT", "firmai"),
            experiment=os.getenv("FIRMAI_EXPERIMENT", "smoke"),
            checkpoint_dir=Path(
                os.getenv("FIRMAI_CHECKPOINT_DIR", ".firmai/checkpoints")
            ),
            seed=int(os.getenv("FIRMAI_SEED", "42")),
            precision=os.getenv("FIRMAI_PRECISION", "bf16"),
        )
