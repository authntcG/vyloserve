#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/.venv/bin/python3" ]; then
    exec "$SCRIPT_DIR/.venv/bin/python3" "$SCRIPT_DIR/main.py" "$@"
elif [ -f "$SCRIPT_DIR/venv/bin/python3" ]; then
    exec "$SCRIPT_DIR/venv/bin/python3" "$SCRIPT_DIR/main.py" "$@"
else
    exec python3 "$SCRIPT_DIR/main.py" "$@"
fi
