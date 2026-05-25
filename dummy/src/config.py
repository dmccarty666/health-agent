"""Config loader — env vars + optional config file; sensible defaults when none exist."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

# Known config env vars
_ENV_PREFIX = "DUMMY_"
_CONFIG_FILE_ENV = f"{_ENV_PREFIX}CONFIG"


def load_config(config_path: str | None = None) -> dict[str, Any]:
    """Load configuration with precedence: explicit path > env var > defaults.

    Args:
        config_path: Explicit path to a config file (JSON or .env-style).
                     If None, falls back to $DUMMY_CONFIG env var, then defaults.

    Returns:
        Flat dict of config values.
    """
    defaults: dict[str, Any] = {
        "app_name": "DummyProject",
        "debug": False,
        "log_level": "INFO",
    }

    # .env file support (simple key=value, no嵌套)
    env_file_path = config_path or os.environ.get(_CONFIG_FILE_ENV)
    if env_file_path:
        path = Path(env_file_path)
        if path.exists():
            for line in path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    defaults[key.strip()] = val.strip()

    return defaults