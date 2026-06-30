import asyncio

import fakeredis.aioredis
import pytest

from app.broker import InMemoryBroker, RedisBroker, make_broker
from app.cache import NullCache, RedisCache, make_cache


async def _drain_one(queue: asyncio.Queue, timeout: float = 1.0):
    return await asyncio.wait_for(queue.get(), timeout)


@pytest.mark.asyncio
async def test_in_memory_broker_fans_out():
    broker = InMemoryBroker()
    async with broker.subscribe() as q1, broker.subscribe() as q2:
        assert broker.subscriber_count == 2
        await broker.publish({"type": "hello", "payload": {"n": 1}})
        assert (await _drain_one(q1))["payload"]["n"] == 1
        assert (await _drain_one(q2))["payload"]["n"] == 1
    assert broker.subscriber_count == 0


@pytest.mark.asyncio
async def test_in_memory_broker_drops_oldest_when_full():
    broker = InMemoryBroker(max_queue=2)
    async with broker.subscribe() as q:
        for i in range(5):
            await broker.publish({"type": "t", "payload": {"i": i}})
        # Capacity 2: the two most recent frames survive.
        got = [(await _drain_one(q))["payload"]["i"] for _ in range(2)]
        assert got == [3, 4]


@pytest.mark.asyncio
async def test_redis_broker_roundtrip():
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    broker = RedisBroker(redis, channel="test:chan")
    async with broker.subscribe() as q:
        await asyncio.sleep(0.05)  # let the subscription settle
        await broker.publish({"type": "ping", "payload": {"v": 42}})
        msg = await _drain_one(q)
        assert msg["type"] == "ping"
        assert msg["payload"]["v"] == 42
    await redis.aclose()


@pytest.mark.asyncio
async def test_make_broker_selects_implementation():
    assert isinstance(make_broker(None), InMemoryBroker)
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    assert isinstance(make_broker(redis), RedisBroker)
    await redis.aclose()


@pytest.mark.asyncio
async def test_redis_cache_roundtrip_and_null_cache():
    assert await NullCache().read() is None
    await NullCache().write({"x": 1})  # no-op

    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    cache = RedisCache(redis, key="test:snap")
    assert await cache.read() is None
    await cache.write({"events": [], "serverTime": 123})
    got = await cache.read()
    assert got["serverTime"] == 123
    assert isinstance(make_cache(redis), RedisCache)
    assert isinstance(make_cache(None), NullCache)
    await redis.aclose()
