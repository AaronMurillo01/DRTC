"""Process runtime: the broker + snapshot cache the rest of the app resolves.

Defaults are single-process (in-memory). At startup, if DRTC_REDIS_URL is set,
the Redis-backed broker and cache are swapped in. Workers and the gateway import
`runtime` and use `runtime.broker` / `runtime.cache`, so nothing else cares which
implementation is active.
"""

from __future__ import annotations

import logging
from typing import Any

from .broker import Broker, InMemoryBroker, make_broker
from .cache import NullCache, SnapshotCache, make_cache
from .config import settings
from .history import HistoryStore, make_history

log = logging.getLogger("drtc.runtime")


class Runtime:
    def __init__(self) -> None:
        self.broker: Broker = InMemoryBroker()
        self.cache: SnapshotCache = NullCache()
        self.history: HistoryStore = make_history(None)
        self._redis: Any | None = None

    async def startup(self) -> None:
        self.history = make_history(settings.history_db)
        if settings.redis_url:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            await self._redis.ping()
            self.broker = make_broker(self._redis)
            self.cache = make_cache(self._redis)
            log.info("runtime: redis backend at %s", settings.redis_url)
        else:
            log.info("runtime: in-memory backend (single process)")

    async def shutdown(self) -> None:
        await self.broker.aclose()
        self.history.close()
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None


runtime = Runtime()
