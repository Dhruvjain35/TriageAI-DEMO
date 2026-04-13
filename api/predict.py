"""Vercel Serverless Function — /api/predict"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from typing import Any

from model import predict_triage


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            required = [
                "age", "sex", "chief_complaint", "heart_rate", "sbp",
                "dbp", "o2_sat", "resp_rate", "temperature", "gcs",
                "arrival_mode", "n_comorbidities",
            ]
            missing = [f for f in required if f not in body]
            if missing:
                self._json_response(400, {"error": f"Missing fields: {', '.join(missing)}"})
                return

            result = predict_triage(body)
            self._json_response(200, result)

        except json.JSONDecodeError:
            self._json_response(400, {"error": "Invalid JSON body."})
        except Exception as e:
            self._json_response(500, {"error": f"Prediction engine error: {str(e)}"})

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def _json_response(self, status: int, data: Any):
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
