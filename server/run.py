#!/usr/bin/env python3
"""Startup wrapper: run uvicorn and print any startup error for App Runner logs."""
import os
import sys

# Use PORT from environment (App Runner sets this)
PORT = int(os.environ.get("PORT", "8080"))

def main():
    print("Starting webex-cc-mcp...", flush=True)
    sys.stdout.flush()
    sys.stderr.flush()
    try:
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=PORT)
    except Exception as e:
        import traceback
        msg = f"Startup failed: {e}\n{traceback.format_exc()}"
        print(msg, file=sys.stderr, flush=True)
        print(msg, flush=True)  # also stdout so it's not missed
        sys.exit(1)

if __name__ == "__main__":
    main()
