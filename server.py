# Triage.ai — Clinical Decision Support System
# Copyright (c) 2026 Dhruv Jain & Sriyan Bodla. All rights reserved.
#
# This source code is proprietary and confidential. Unauthorized copying,
# modification, distribution, or use of this software, via any medium,
# is strictly prohibited without prior written permission from the authors.
#
# For research and demonstration purposes only.
# Not approved for clinical use.

"""
FastAPI backend for the Triage.ai live demo.
Serves the clinical triage prediction API and static frontend files.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator

from model import predict_triage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("triage_ai")

app = FastAPI(
    title="Triage.ai Clinical AI",
    version="1.0.0",
    description="Emergency Severity Index prediction engine",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------

RATE_LIMIT_MAX = 30
RATE_LIMIT_WINDOW = 60  # seconds

_rate_store: dict[str, list[float]] = {}


def _check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    timestamps = [t for t in _rate_store.get(client_ip, []) if now - t < RATE_LIMIT_WINDOW]

    if not timestamps:
        _rate_store.pop(client_ip, None)
    else:
        _rate_store[client_ip] = timestamps

    if len(timestamps) >= RATE_LIMIT_MAX:
        return False

    timestamps.append(now)
    _rate_store[client_ip] = timestamps

    if len(_rate_store) > 10_000:
        _cleanup_rate_store()

    return True


def _cleanup_rate_store() -> None:
    now = time.time()
    expired = [ip for ip, ts in _rate_store.items() if all(now - t >= RATE_LIMIT_WINDOW for t in ts)]
    for ip in expired:
        del _rate_store[ip]


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class PatientInput(BaseModel):
    age: int = Field(ge=0, le=120)
    sex: Literal["Male", "Female", "Other"]
    chief_complaint: str = Field(min_length=1, max_length=500)
    heart_rate: float = Field(ge=20, le=250)
    sbp: float = Field(ge=40, le=300)
    dbp: float = Field(ge=20, le=200)
    o2_sat: float = Field(ge=50, le=100)
    resp_rate: float = Field(ge=4, le=60)
    temperature: float = Field(ge=90, le=110)
    gcs: int = Field(ge=3, le=15)
    arrival_mode: Literal["Ambulance", "Walk-in", "Police", "Transfer"]
    n_comorbidities: int = Field(ge=0, le=10)

    @field_validator("chief_complaint")
    @classmethod
    def strip_complaint(cls, v: str) -> str:
        return v.strip()


class PredictionResponse(BaseModel):
    esi_level: int
    esi_label: str
    confidence: float
    probabilities: list[float]
    conformal_set: list[int]
    coverage_level: float
    risk_factors: list[dict]
    clinical_flags: list[str]
    composites: dict
    recommendation: str


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check() -> dict:
    return {"status": "ok", "model_mode": "simulation", "version": "1.0.0"}


@app.post("/api/predict", response_model=PredictionResponse)
async def predict(patient: PatientInput, request: Request) -> PredictionResponse:
    client_ip = request.client.host if request.client else "unknown"

    if not _check_rate_limit(client_ip):
        _cleanup_rate_store()
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 30 requests per minute.",
        )

    logger.info(
        "Prediction request | ip=%s | age_group=%s | arrival=%s | complaint_length=%d",
        client_ip,
        f"{(patient.age // 10) * 10}s",
        patient.arrival_mode,
        len(patient.chief_complaint),
    )

    try:
        result = predict_triage(patient.model_dump())
    except Exception as e:
        logger.error("Prediction failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Prediction engine error.") from e

    logger.info(
        "Prediction result | ip=%s | esi=%d | confidence=%.2f",
        client_ip,
        result["esi_level"],
        result["confidence"],
    )

    return PredictionResponse(**result)


# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------

@app.get("/")
async def serve_index() -> FileResponse:
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend not built yet.")
    return FileResponse(index_path)


@app.get("/demo.html")
async def serve_demo() -> FileResponse:
    return FileResponse(STATIC_DIR / "demo.html")


for static_file in ["styles.css", "app.js", "demo.css", "grain-shader.js"]:
    _path = STATIC_DIR / static_file

    def _make_handler(file_path: Path):
        async def handler() -> FileResponse:
            if not file_path.exists():
                raise HTTPException(status_code=404, detail=f"{file_path.name} not found.")
            return FileResponse(file_path)
        return handler

    app.get(f"/{static_file}")(_make_handler(_path))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
