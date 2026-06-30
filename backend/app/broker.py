"""Pub/sub broker for fanning ingest updates out to websocket clients.

Two implementations behind one interface:

- InMemoryBroker: asyncio queues, single process. The default, zero deps.
- RedisBroker: Redis pub/sub, so ingest in one process reaches websocket
  clients held by *other* gateway replicas. This is the horizontal-scaling
  swap, selected at startup when DRTC_REDIS_URL is set.

The gateway and ingest workers only ever see the abstract Broker, so neither
changes when the implementation does.
"""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Any


class Broker(ABC):
    @abstractmethod
    async def publish(self, message: dict) -> None: ...

    @abstractmethod
    def subscribe(self) -> Any:
        """Async context manager yielding an asyncio.Queue of messages."""

    @property
    @abstractmethod
    def subscriber_count(self) -> int: ...

    async def aclose(self) -> None:  # noqa: B027 - optional override
        """Release any resources. No-op by default."""


def _offer(queue: asyncio.Queue[dict], message: dict) -> None:
    """Enqueue, dropping the oldest frame for a slow consumer instead of blocking."""
    try:
        queue.put_nowait(message)
    except asyncio.QueueFull:
        with suppress(asyncio.QueueEmpty):
            queue.get_nowait()
            queue.put_nowait(message)


class InMemoryBroker(Broker):
    def __init__(self, max_queue: int = 256) -> None:
        self._subscribers: set[asyncio.Queue[dict]] = set()
        self._max_queue = max_queue

    async def publish(self, message: dict) -> None:
        for q in list(self._subscribers):
            _offer(q, message)

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


class RedisBroker(Broker):
    def __init__(self, redis: Any, channel: str = "drtc:events", max_queue: int = 256) -> None:
        self._redis = redis
        self._channel = channel
        self._max_queue = max_queue
        self._count = 0

    async def publish(self, message: dict) -> None:
        await self._redis.publish(self._channel, json.dumps(message))

    async def _pump(self, pubsub: Any, queue: asyncio.Queue[dict]) -> None:
        async for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            data = msg["data"]
            try:
                _offer(queue, json.loads(data))
            except (ValueError, TypeError):
                continue

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[dict]]:
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(self._channel)
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=self._max_queue)
        task = asyncio.create_task(self._pump(pubsub, queue))
        self._count += 1
        try:
            yield queue
        finally:
            self._count -= 1
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            with suppress(Exception):
                await pubsub.unsubscribe(self._channel)
                await pubsub.aclose()

    @property
    def subscriber_count(self) -> int:
        return self._count


def make_broker(redis: Any | None, channel: str = "drtc:events") -> Broker:
    return RedisBroker(redis, channel) if redis is not None else InMemoryBroker()
