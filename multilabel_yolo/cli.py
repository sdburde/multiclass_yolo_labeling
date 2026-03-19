"""Command-line interface for MultiLabel YOLO."""

import argparse
import sys

from .server import run_server


def main():
    """Main entry point for the multilabel-yolo CLI."""
    parser = argparse.ArgumentParser(
        prog="multilabel-yolo",
        description="MultiLabel YOLO - Web-based annotation tool for YOLO object detection datasets",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host address to bind the server (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=7182,
        help="Port to run the server on (default: 7182)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=True,
        help="Enable auto-reload mode (default: enabled)",
    )
    parser.add_argument(
        "--no-reload",
        action="store_false",
        dest="reload",
        help="Disable auto-reload mode",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__import__('multilabel_yolo').__version__}",
        help="Show version and exit",
    )

    args = parser.parse_args()

    print(f"🚀 Starting MultiLabel YOLO on http://{args.host}:{args.port}")
    run_server(host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
