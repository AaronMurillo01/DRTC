"""Runtime configuration via environment variables (12-factor)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DRTC_", env_file=".env", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "*"

    # Poll cadences (seconds).
    seismic_interval: int = 60
    orbital_interval: int = 5
    space_interval: int = 120
    disaster_interval: int = 300
    groundlink_interval: int = 60

    # Pass-prediction tuning.
    pass_horizon_hours: float = 12.0
    pass_step_sec: float = 30.0
    tle_refresh_sec: int = 1800

    # Optional Redis pub/sub + cache (in-memory broker used when unset).
    redis_url: str | None = None

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
