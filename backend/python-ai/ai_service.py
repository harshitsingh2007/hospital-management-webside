"""
ai_service.py
-------------
Dedicated Python AI/ML Microservice for AI Queue System.
Runs on Port 8001.

Responsibilities:
- Tabular Feature Engineering & Duration Predictions
- Strict Internal Secret Authentication (X-AI-Internal-Secret)
- Model Version Pointer Resolution (current_version.json)
- Continuous Learning Model Training & Holdout Evaluation
- Safe Model Rollback Endpoint
"""

import os
import sys
import io
import json
from typing import Optional, Dict, Any, List
import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure root backend directory is accessible for ML pipelines
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BACKEND_DIR, ".env"))
except ImportError:
    pass

from schema_validator import detect_column_mappings, validate_and_transform_dataframe
from train_model import (
    train_model_for_tenant,
    get_tenant_model_info,
    rollback_tenant_model,
    engineer_features,
    MODELS_DIR,
    MIN_TRAINING_ROWS,
    CATEGORY_CONFIG
)

AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "internal-queue-ai-secret-key-2026")

def verify_internal_secret(x_ai_internal_secret: Optional[str] = Header(None)):
    """Verifies internal microservice secret header.
    Rejects direct untrusted public access.
    """
    if x_ai_internal_secret != AI_INTERNAL_SECRET:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Invalid or missing X-AI-Internal-Secret header."
        )

app = FastAPI(title="AI Queue ML Microservice", version="2.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory model cache
_models_cache: Dict[str, dict] = {}

def load_model_bundle(tenant_id: str) -> dict:
    tid = (tenant_id or "global").strip()
    if tid in _models_cache:
        return _models_cache[tid]

    tenant_dir = os.path.join(MODELS_DIR, tid)
    pointer_path = os.path.join(tenant_dir, "current_version.json")
    if not os.path.exists(pointer_path):
        tenant_dir = os.path.join(MODELS_DIR, "global")
        pointer_path = os.path.join(tenant_dir, "current_version.json")

    version_dir = None
    pointer_data = {}
    if os.path.exists(pointer_path):
        try:
            with open(pointer_path, "r", encoding="utf-8") as pf:
                pointer_data = json.load(pf)
                version_dir = pointer_data.get("active_dir")
        except Exception as e:
            print(f"[ML Service] Error reading pointer {pointer_path}: {e}")

    model_path = None
    meta_path = None
    if version_dir:
        model_path = os.path.join(tenant_dir, version_dir, "queue_predictor.pkl")
        meta_path = os.path.join(tenant_dir, version_dir, "metadata.json")

    if not model_path or not os.path.exists(model_path):
        # Fallback to direct queue_predictor.pkl in tenant or global
        model_path = os.path.join(tenant_dir, "queue_predictor.pkl")
        meta_path = os.path.join(tenant_dir, "metadata.json")
        if not os.path.exists(model_path):
            model_path = os.path.join(MODELS_DIR, "global", "queue_predictor.pkl")
            meta_path = os.path.join(MODELS_DIR, "global", "metadata.json")

    bundle = None
    if model_path and os.path.exists(model_path):
        try:
            bundle = joblib.load(model_path)
        except Exception as e:
            print(f"[ML Service] Error loading model bundle from {model_path}: {e}")

    meta = {}
    if meta_path and os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            meta = {}
    elif pointer_data:
        meta = pointer_data

    result = {"bundle": bundle, "metadata": meta}
    _models_cache[tid] = result
    return result

class PredictRequest(BaseModel):
    tenant_id: Optional[str] = "global"
    consumer_type: Optional[str] = "hospital"
    service_category: str = "consultation"
    queue_length: int = Field(default=1, ge=0)
    active_staff_counters: int = Field(default=2, ge=1)
    complexity_score: float = Field(default=1.0, ge=0.5, le=3.0)
    hour_of_day: Optional[int] = Field(default=12, ge=0, le=23)
    day_of_week: Optional[int] = Field(default=1, ge=0, le=6)

class TrainRequest(BaseModel):
    tenant_id: str = "global"
    records: Optional[List[Dict[str, Any]]] = None
    data_source: Optional[str] = "service_logs"

class RollbackRequest(BaseModel):
    tenant_id: str
    target_version: str

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai-queue-python-ml",
        "port": int(os.getenv("AI_SERVICE_PORT", "8001")),
        "models_cached": list(_models_cache.keys()),
    }

@app.post("/predict")
async def predict_duration(req: PredictRequest, _=Depends(verify_internal_secret)):
    tenant_id = req.tenant_id or "global"
    bundle_info = load_model_bundle(tenant_id)
    bundle = bundle_info.get("bundle")

    if bundle and isinstance(bundle, dict) and "model" in bundle:
        try:
            model = bundle["model"]
            feature_names = bundle.get("feature_names", bundle.get("feature_columns", []))

            hour = req.hour_of_day if req.hour_of_day is not None else 12
            day = req.day_of_week if req.day_of_week is not None else 1
            queue_len = req.queue_length
            active_counters = max(1, req.active_staff_counters)
            complexity = req.complexity_score
            cat = str(req.service_category or "consultation").lower()
            consumer = str(req.consumer_type or "hospital").lower()

            row = {
                "queue_length": queue_len,
                "active_staff_counters": active_counters,
                "complexity_score": complexity,
                "hour_of_day": hour,
                "day_of_week": day,
                "is_peak_hour": 1 if hour in (9, 10, 11, 14, 15, 16) and day in (1, 2, 3, 4, 5) else 0,
                "is_weekend": 1 if day in (0, 6) else 0,
                "sin_hour": np.sin(2 * np.pi * hour / 24.0),
                "cos_hour": np.cos(2 * np.pi * hour / 24.0),
                "sin_day": np.sin(2 * np.pi * day / 7.0),
                "cos_day": np.cos(2 * np.pi * day / 7.0),
                "staff_load_ratio": queue_len / active_counters,
                "effective_workload": (queue_len * complexity) / active_counters,
                "counter_capacity_index": active_counters / (queue_len + 1.0),
            }

            # One-hot encode known categories
            for col in feature_names:
                if col.startswith("service_category_"):
                    target_cat = col.replace("service_category_", "").lower()
                    row[col] = 1 if cat == target_cat else 0
                elif col.startswith("consumer_type_"):
                    target_consumer = col.replace("consumer_type_", "").lower()
                    row[col] = 1 if consumer == target_consumer else 0

            df_feat = pd.DataFrame([row])
            # Handle unseen categories or missing features cleanly
            for col in feature_names:
                if col not in df_feat.columns:
                    df_feat[col] = 0

            df_feat = df_feat[feature_names]
            pred = float(model.predict(df_feat)[0])
            pred_clamped = max(1.0, min(120.0, round(pred, 1)))

            return {
                "status": "success",
                "predicted_service_minutes": pred_clamped,
                "model_used": bundle.get("model_name", "Trained ML Regressor"),
                "version": bundle.get("version", bundle_info.get("metadata", {}).get("version", "v_active")),
                "source": "ml_model",
            }
        except Exception as e:
            print(f"[ML Service] Prediction error, using category fallback: {e}")

    # Fallback to category median duration / clinical heuristic
    base_durations = {
        "emergency": 25.0,
        "consultation": 15.0,
        "radiology": 20.0,
        "laboratory": 10.0,
        "lab_test": 10.0,
        "pharmacy": 6.0,
        "billing": 5.0,
    }
    cat_lower = str(req.service_category or "consultation").lower()
    base = base_durations.get(cat_lower, 15.0)
    heuristic_pred = max(1.0, min(120.0, round(base * req.complexity_score, 1)))

    return {
        "status": "success",
        "predicted_service_minutes": heuristic_pred,
        "model_used": "Synthetic Baseline Fallback",
        "version": "fallback_baseline",
        "source": "synthetic_baseline",
    }

@app.post("/train")
async def train_model_endpoint(req: TrainRequest, _=Depends(verify_internal_secret)):
    tenant_id = req.tenant_id or "global"
    df = pd.DataFrame(req.records) if req.records and len(req.records) > 0 else None

    meta = train_model_for_tenant(
        tenant_id=tenant_id,
        custom_df=df,
        min_rows=MIN_TRAINING_ROWS,
        data_source=req.data_source or ("service_logs" if df is not None else "synthetic")
    )

    # Invalidate in-memory cache
    if tenant_id in _models_cache:
        del _models_cache[tenant_id]

    return {
        "status": "success",
        "message": f"Successfully completed training run for tenant '{tenant_id}'",
        "metrics": meta,
        **meta,
    }

@app.post("/rollback")
async def rollback_model_endpoint(req: RollbackRequest, _=Depends(verify_internal_secret)):
    success, msg = rollback_tenant_model(req.tenant_id, req.target_version)
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    # Invalidate in-memory cache
    if req.tenant_id in _models_cache:
        del _models_cache[req.tenant_id]

    return {
        "status": "success",
        "message": msg,
        "tenant_id": req.tenant_id,
        "target_version": req.target_version,
    }

@app.get("/model-status/{tenant_id}")
async def model_status(tenant_id: str, _=Depends(verify_internal_secret)):
    return get_tenant_model_info(tenant_id)

@app.get("/model-versions/{tenant_id}")
async def model_versions(tenant_id: str, _=Depends(verify_internal_secret)):
    tenant_dir = os.path.join(MODELS_DIR, tenant_id)
    if not os.path.exists(tenant_dir):
        return {"tenant_id": tenant_id, "versions": []}

    dirs = [
        d for d in os.listdir(tenant_dir)
        if d.startswith("v") and os.path.isdir(os.path.join(tenant_dir, d))
    ]
    dirs.sort(reverse=True)

    versions = []
    for d in dirs[:10]:
        meta_file = os.path.join(tenant_dir, d, "metadata.json")
        if os.path.exists(meta_file):
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    versions.append(meta)
            except Exception:
                versions.append({"version": d})
        else:
            versions.append({"version": d})

    return {"tenant_id": tenant_id, "versions": versions}

@app.post("/preview-historical")
async def preview_historical_data(
    tenant_id: str = Form(...),
    file: UploadFile = File(...),
    _=Depends(verify_internal_secret),
):
    filename = file.filename.lower()
    contents = await file.read()
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

    detected_columns = list(df.columns)
    suggested_mapping, unmapped, missing_required = detect_column_mappings(detected_columns)
    val_result = validate_and_transform_dataframe(df, suggested_mapping, default_tenant_id=tenant_id)

    sample_df = df.head(5).fillna("")
    sample_rows = sample_df.to_dict(orient="records")

    return {
        "tenant_id": tenant_id,
        "detected_columns": detected_columns,
        "suggested_mapping": suggested_mapping,
        "unmapped_columns": unmapped,
        "missing_required": missing_required,
        "sample_rows": sample_rows,
        "total_rows": len(df),
        "validation_preview": {
            "valid_rows": val_result.valid_rows,
            "rejected_rows": val_result.rejected_rows,
            "errors": val_result.errors[:5],
            "warnings": val_result.warnings[:5],
        },
    }

@app.post("/validate-historical")
async def validate_historical_data(
    tenant_id: str = Form(...),
    file: UploadFile = File(...),
    column_mapping_json: Optional[str] = Form(None),
    _=Depends(verify_internal_secret),
):
    contents = await file.read()
    filename = file.filename.lower()
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading dataset: {str(e)}")

    user_mapping = None
    if column_mapping_json:
        try:
            user_mapping = json.loads(column_mapping_json)
        except Exception:
            user_mapping = None

    val_result = validate_and_transform_dataframe(df, user_mapping, default_tenant_id=tenant_id)

    if not val_result.success:
        return {
            "success": False,
            "tenant_id": tenant_id,
            "errors": val_result.errors,
            "warnings": val_result.warnings,
            "valid_rows": 0,
            "rejected_rows": len(df),
            "records": [],
        }

    records = val_result.clean_dataframe.to_dict(orient="records") if val_result.clean_dataframe is not None else []
    return {
        "success": True,
        "tenant_id": tenant_id,
        "valid_rows": val_result.valid_rows,
        "rejected_rows": val_result.rejected_rows,
        "warnings": val_result.warnings,
        "records": records,
    }
