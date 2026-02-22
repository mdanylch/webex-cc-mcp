#!/bin/sh
set -e
pip3 install -r requirements.txt
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
