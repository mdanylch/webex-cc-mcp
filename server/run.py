#!/usr/bin/env python3
"""Startup wrapper: run uvicorn and print any startup error to stderr for App Runner logs."""
import sys

def main():
    print("Starting webex-cc-mcp...", flush=True)
    try:
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=8080)
    except Exception as e:
        print(f"Startup failed: {e}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
