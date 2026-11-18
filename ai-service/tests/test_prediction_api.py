from fastapi.testclient import TestClient

from src.app import app
from src.predictor import RiskPredictor


client = TestClient(app)


VALID_PAYLOAD = {
    "project_id": "project-test-1",
    "project_name": "Test Construction Project",
    "contract_amount": 2500000,
    "approved_budget": 2100000,
    "planned_progress_pct": 70,
    "actual_progress_pct": 55,
    "budget_consumed_pct": 82,
    "actual_expense_amount": 1722000,
    "total_milestones": 8,
    "completed_milestones": 4,
    "overdue_milestones": 1,
}


def test_predict_returns_structured_fallback_response():
    response = client.post("/predict", json=VALID_PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "MODEL_NOT_TRAINED"
    assert body["cost_risk"]["tier"] in {"LOW", "MEDIUM", "HIGH"}
    assert body["schedule_risk"]["tier"] in {"LOW", "MEDIUM", "HIGH"}
    assert isinstance(body["contributing_risk_factors"], list)
    assert isinstance(body["actionable_recommendations"], list)


def test_predict_handles_missing_optional_expense_safely():
    payload = {key: value for key, value in VALID_PAYLOAD.items() if key != "actual_expense_amount"}
    response = client.post("/predict", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "MODEL_NOT_TRAINED"


def test_predict_rejects_invalid_required_input():
    payload = {**VALID_PAYLOAD, "approved_budget": -1}
    response = client.post("/predict", json=payload)

    assert response.status_code == 422


def test_missing_model_artifacts_use_explicit_fallback(tmp_path):
    predictor = RiskPredictor(models_dir=str(tmp_path))
    result = predictor.predict(VALID_PAYLOAD)

    assert predictor.is_loaded is False
    assert result["status"] == "MODEL_NOT_TRAINED"
    assert result["prediction_method"].startswith("Earned Value Analysis")
