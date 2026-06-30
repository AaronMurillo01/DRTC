"""Pub/sub broker for fanning ingest updates out to websocket clients.

The default implementation is in-process (asyncio queues), which keeps the dev
stack to a single container. The interface is deliberately small so a Redis
pub/sub backend can be dropped in for horizontal scaling without touching the
gateway or the ingest workers.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager


class Broker:
    def __init__(self, max_queue: int = 256) -> None:
        self._subscribers: set[asyncio.Queue[dict]] = set()
        self._max_queue = max_queue

    async def publish(self, message: dict) -> None:
        for q in list(self._subscribers):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # Slow consumer: drop the oldest frame rather than block ingest.
                try:
                    q.get_nowait()
                    q.put_nowait(message)
                except asyncio.QueueEmpty:
                    pass

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[dict]]:
        q: asyncio.Queue[dict] = asyncio.Queue(maxsize=self._max_queue)
        self._subscribers.add(q)
        try:
            yield q
        finally:
            self._subscribers.discard(q)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


broker = Broker()
