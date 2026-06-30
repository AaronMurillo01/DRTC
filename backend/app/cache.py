"""Shared snapshot cache.

A gateway replica that does not run the ingest workers still needs to hand a
fresh client the current picture on connect. In single-process mode the gateway
reads its own in-memory store (NullCache). With Redis, the ingest process writes
the latest snapshot to a shared key and every gateway reads from there.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any


class SnapshotCache(ABC):
    @abstractmethod
    async def write(self, snapshot: dict) -> None: ...

    @abstractmethod
    async def read(self) -> dict | None: ...


class NullCache(SnapshotCache):
    """No shared cache; the gateway falls back to its local store."""

    async def write(self, snapshot: dict) -> None:
        return None

    async def read(self) -> dict | None:
        return None


class RedisCache(SnapshotCache):
    def __init__(self, redis: Any, key: str = "drtc:snapshot") -> None:
        self._redis = redis
        self._key = key

    async def write(self, snapshot: dict) -> None:
        await self._redis.set(self._key, json.dumps(snapshot))

    async def read(self) -> dict | None:
        raw = await self._redis.get(self._key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return None


def make_cache(redis: Any | None) -> SnapshotCache:
    return RedisCache(redis) if redis is not None else NullCache()
