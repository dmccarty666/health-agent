"""Tests for greet function."""

import pytest
from src.greet import greet


class TestGreet:
    """Test suite for greet function."""

    def test_greet_alice(self):
        """Given greet('Alice') is called, then it returns 'Hello, Alice!'"""
        result = greet("Alice")
        assert result == "Hello, Alice!"

    def test_greet_empty_string(self):
        """Given greet('') is called, then it returns 'Hello, !'"""
        result = greet("")
        assert result == "Hello, !"

    def test_greet_non_string_raises(self):
        """Given a non-string is passed to greet, then it raises TypeError."""
        with pytest.raises(TypeError):
            greet(123)

    def test_greet_world(self):
        """Plan.md §5 Scenario A: greet('World') → 'Hello, World!'"""
        result = greet("World")
        assert result == "Hello, World!"