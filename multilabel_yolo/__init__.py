"""MultiLabel YOLO - A web-based annotation tool for YOLO object detection datasets."""

__version__ = "0.1.0"
__author__ = "sdburde"

from .server import app, run_server

__all__ = ["app", "run_server", "__version__"]
