"""
Z-Combinators Backend Entrypoint.
Delegates to app.main:app for modular architecture compatibility.
"""
from app.main import app

__all__ = ["app"]
