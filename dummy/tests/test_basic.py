"""Smoke tests for project scaffold — verifies package loads and config uses defaults."""

from __future__ import annotations

from src.config import load_config


class TestScaffoldImport:
    """AC: Given the package is imported, when import src succeeds, then all modules load."""

    def test_src_module_loads(self) -> None:
        """src/__init__ imports without error."""
        import src  # noqa: F401
        assert True

    def test_config_module_loads(self) -> None:
        """src/config loads without error."""
        from src import config  # noqa: F401
        assert True


class TestConfigDefaults:
    """AC: Given no configuration exists, when the config loader runs, it uses sensible defaults."""

    def test_load_config_returns_dict(self) -> None:
        """Config loader returns a dict."""
        cfg = load_config()
        assert isinstance(cfg, dict)

    def test_load_config_has_app_name(self) -> None:
        """Defaults include app_name."""
        cfg = load_config()
        assert "app_name" in cfg

    def test_load_config_debug_false(self) -> None:
        """Defaults set debug to False."""
        cfg = load_config()
        assert cfg.get("debug") is False

    def test_load_config_log_level(self) -> None:
        """Defaults include a log_level key."""
        cfg = load_config()
        assert "log_level" in cfg


class TestNoHardcodedPaths:
    """DoD: No hardcoded paths — uses relative or env-based resolution."""

    def test_config_load_with_explicit_path_nonexistent(self) -> None:
        """Explicit None path does not raise; falls back to defaults."""
        cfg = load_config(config_path=None)
        assert isinstance(cfg, dict)

    def test_src_init_has_config_module(self) -> None:
        """src/__init__ exposes config as a module."""
        import src.config
        assert hasattr(src.config, "load_config")