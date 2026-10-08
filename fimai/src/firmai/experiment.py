from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Experiment:
    name: str
    train_fn: Callable[[Any], None]


_REGISTRY: dict[str, Experiment] = {}


def experiment(name: str):
    if not name.strip():
        raise ValueError("Experiment name cannot be empty")

    def decorator(fn: Callable[[Any], None]):
        if name in _REGISTRY:
            raise ValueError(f"Experiment already registered: {name}")
        _REGISTRY[name] = Experiment(name=name, train_fn=fn)
        return fn

    return decorator


def get_experiment(name: str) -> Experiment:
    try:
        return _REGISTRY[name]
    except KeyError as exc:
        raise KeyError(f"Unknown experiment: {name}") from exc
