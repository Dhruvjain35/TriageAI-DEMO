#!/bin/bash
echo "Starting Triage.ai Live Demo..."
echo "Installing dependencies..."
pip3 install -q -r requirements.txt
echo ""
echo "Server starting at http://localhost:8000"
echo "Press Ctrl+C to stop."
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
