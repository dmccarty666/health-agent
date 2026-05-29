"""Database connection module for health-agent backend.

Provides a psycopg2 connection to the local PostgreSQL health_agent database.
Uses a simple connection-factory pattern — no connection pooling needed for
this single-user analytics API.
"""

from __future__ import annotations

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras


# Configuration — prefer env vars, fall back to defaults
DB_HOST = os.environ.get("HEALTH_DB_HOST", "localhost")
DB_PORT = os.environ.get("HEALTH_DB_PORT", "5432")
DB_NAME = os.environ.get("HEALTH_DB_NAME", "health_agent")
DB_USER = os.environ.get("HEALTH_DB_USER", "postgres")
DB_PASSWORD = os.environ.get("HEALTH_DB_PASSWORD", "")


def _connect() -> psycopg2.extensions.connection:
    """Create a new database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


@contextmanager
def get_cursor():
    """Context manager yielding a RealDictCursor for row-as-dict access.

    Usage:
        with get_cursor() as cur:
            cur.execute("SELECT ...")
            rows = cur.fetchall()
    """
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_user_id() -> str:
    """Return the user_id that has measurements in the database.

    Looks up the first user with at least one measurement. Falls back to
    the first user in the users table if no measurements exist yet.
    """
    with get_cursor() as cur:
        cur.execute(
            "SELECT user_id FROM measurements GROUP BY user_id "
            "ORDER BY COUNT(*) DESC LIMIT 1"
        )
        row = cur.fetchone()
        if row:
            return row["user_id"]

        cur.execute("SELECT id FROM users LIMIT 1")
        row = cur.fetchone()
        if row:
            return row["id"]

        return ""
