"""
Morya Enterprises - AI Risk Analysis Microservice
FastAPI Application providing REST endpoints for construction project risk prediction,
model training, evaluation metrics, and health inspection.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import json

try:
    from .predictor import RiskPredictor
    from .train import train_and_evaluate
except ImportError:
    from predictor import RiskPredictor
    from train import train_and_evaluate

app = FastAPI(
    title="Morya Enterprises — AI Risk Analysis API",
    description="Cost-overrun and schedule-delay risk intelligence for construction contractor management.",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = RiskPredictor()

class RiskPredictionRequest(BaseModel):
    project_id: Optional[str] = None
    project_name: Optional[str] = "Construction Project"
    contract_amount: float = Field(..., gt=0, description="Total contract amount in INR")
    approved_budget: float = Field(..., gt=0, description="Approved budget for contractor execution in INR")
    planned_duration_days: int = Field(365, gt=0, description="Planned total project duration in days")
    planned_progress_pct: float = Field(..., ge=0.0, le=100.0, description="Scheduled planned progress percentage")
    actual_progress_pct: float = Field(..., ge=0.0, le=100.0, description="Actual physical milestone progress percentage")
    budget_consumed_pct: float = Field(..., ge=0.0, description="Budget consumption percentage")
    actual_expense_amount: Optional[float] = Field(None, ge=0.0)
    total_milestones: int = Field(8, ge=1)
    completed_milestones: int = Field(0, ge=0)
    overdue_milestones: int = Field(0, ge=0)
    material_cost_index: float = Field(1.0, ge=0.5, le=2.5, description="Procurement price index relative to baseline")
    labour_shortage_index: float = Field(0.05, ge=0.0, le=1.0, description="Labour deficiency / absenteeism index")
    change_orders_count: int = Field(0, ge=0)

@app.get("/")
def root():
    return {
        "service": "Morya Enterprises — Smart Contractor Management & Risk Analysis AI Service",
        "status": "online",
        "tagline": "Building Smarter. Managing Better.",
        "model_loaded": predictor.is_loaded
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "company": "Morya Enterprises",
        "model_loaded": predictor.is_loaded,
        "model_version": predictor.metadata.get("model_version", "v1.2.0-morya"),
        "service_type": "FastAPI + scikit-learn"
    }

@app.post("/predict/full-risk")
def predict_full_risk(payload: RiskPredictionRequest):
    try:
        data = payload.model_dump()
        result = predictor.predict(data)
        if payload.project_id:
            result["project_id"] = payload.project_id
        if payload.project_name:
            result["project_name"] = payload.project_name
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/predict")
def predict(payload: RiskPredictionRequest):
    """Stable compact prediction endpoint; model status is explicit in the response."""
    return predict_full_risk(payload)

@app.post("/predict/cost-risk")
def predict_cost_risk(payload: RiskPredictionRequest):
    full = predict_full_risk(payload)
    return {
        "project_id": payload.project_id,
        "cost_risk": full["cost_risk"],
        "contributing_risk_factors": full["contributing_risk_factors"],
        "actionable_recommendations": full["actionable_recommendations"],
        "confidence_score": full["confidence_score"]
    }

@app.post("/predict/delay-risk")
def predict_delay_risk(payload: RiskPredictionRequest):
    full = predict_full_risk(payload)
    return {
        "project_id": payload.project_id,
        "schedule_risk": full["schedule_risk"],
        "contributing_risk_factors": full["contributing_risk_factors"],
        "actionable_recommendations": full["actionable_recommendations"],
        "confidence_score": full["confidence_score"]
    }

@app.get("/metrics")
def get_model_metrics():
    meta_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'metadata.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r') as f:
            return json.load(f)
    return {
        "status": "No trained model metadata found yet.",
        "model_version": "v1.2.0-morya",
        "fallback": "Running on Earned Value Analysis fallback"
    }

@app.post("/train")
def trigger_training(background_tasks: BackgroundTasks):
    def run_training():
        global predictor
        train_and_evaluate()
        predictor._load_artifacts()

    background_tasks.add_task(run_training)
    return {
        "message": "Model training pipeline triggered in background.",
        "company": "Morya Enterprises",
        "status": "training_started"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
