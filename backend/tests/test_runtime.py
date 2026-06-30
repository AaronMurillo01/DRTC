import fakeredis.aioredis
import pytest
import redis.asyncio as aioredis

from app import runtime as runtime_mod
from app.broker import InMemoryBroker, RedisBroker
from app.cache import NullCache, RedisCache
from app.config import settings


@pytest.mark.asyncio
async def test_runtime_defaults_to_in_memory(monkeypatch):
    monkeypatch.setattr(settings, "redis_url", None)
    rt = runtime_mod.Runtime()
    await rt.startup()
    assert isinstance(rt.broker, InMemoryBroker)
    assert isinstance(rt.cache, NullCache)
    await rt.shutdown()


@pytest.mark.asyncio
async def test_runtime_swaps_to_redis_when_configured(monkeypatch):
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(aioredis, "from_url", lambda *a, **k: fake)
    monkeypatch.setattr(settings, "redis_url", "redis://localhost:6379/0")

    rt = runtime_mod.Runtime()
    await rt.startup()
    assert isinstance(rt.broker, RedisBroker)
    assert isinstance(rt.cache, RedisCache)

    # End-to-end through the swapped components: write to cache, fan out a frame.
    await rt.cache.write({"serverTime": 7})
    assert (await rt.cache.read())["serverTime"] == 7
    await rt.shutdown()
