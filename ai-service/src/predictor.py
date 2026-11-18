"""
Morya Enterprises - AI Risk Analysis
Predictor Engine
Provides real-time inference, explainable risk factors, and actionable contractor recommendations.
"""

import os
import json
import math
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List

FEATURES = [
    'contract_amount',
    'approved_budget',
    'planned_duration_days',
    'planned_progress_pct',
    'actual_progress_pct',
    'progress_gap_pct',
    'budget_consumed_pct',
    'actual_expense_amount',
    'total_milestones',
    'completed_milestones',
    'overdue_milestones',
    'material_cost_index',
    'labour_shortage_index',
    'change_orders_count'
]

class RiskPredictor:
    def __init__(self, models_dir: str = None):
        if models_dir is None:
            models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
        self.models_dir = models_dir
        self.scaler = None
        self.cost_model = None
        self.delay_model = None
        self.metadata = {}
        self.is_loaded = False
        self._load_artifacts()

    def _load_artifacts(self):
        try:
            scaler_path = os.path.join(self.models_dir, 'scaler.joblib')
            cost_path = os.path.join(self.models_dir, 'cost_overrun_model.joblib')
            delay_path = os.path.join(self.models_dir, 'schedule_delay_model.joblib')
            meta_path = os.path.join(self.models_dir, 'metadata.json')

            if os.path.exists(scaler_path) and os.path.exists(cost_path) and os.path.exists(delay_path):
                self.scaler = joblib.load(scaler_path)
                self.cost_model = joblib.load(cost_path)
                self.delay_model = joblib.load(delay_path)
                if os.path.exists(meta_path):
                    with open(meta_path, 'r') as f:
                        self.metadata = json.load(f)
                self.is_loaded = True
                print("RiskPredictor: Models loaded successfully from disk.")
            else:
                print("RiskPredictor: Checkpoint files not found on disk. Falling back to rule-based evaluation until trained.")
        except Exception as e:
            print(f"RiskPredictor: Error loading models: {e}")
            self.is_loaded = False

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes project features and returns comprehensive risk assessment:
        - Cost risk score (0-100), tier (LOW, MEDIUM, HIGH)
        - Predicted final cost (INR) and variance
        - Schedule delay risk score (0-100), tier (LOW, MEDIUM, HIGH)
        - Estimated delay days
        - Key contributing risk factors
        - Actionable contractor recommendations
        """
        # Extract features with safe defaults
        contract_amount = self._safe_float(input_data.get('contract_amount'), 10000000.0)
        approved_budget = self._safe_float(input_data.get('approved_budget'), contract_amount * 0.85)
        planned_duration_days = self._safe_int(input_data.get('planned_duration_days'), 300)
        planned_progress_pct = self._safe_float(input_data.get('planned_progress_pct'), 50.0)
        actual_progress_pct = self._safe_float(input_data.get('actual_progress_pct'), 45.0)
        budget_consumed_pct = self._safe_float(input_data.get('budget_consumed_pct'), 48.0)
        actual_expense_amount = self._safe_float(input_data.get('actual_expense_amount'), approved_budget * (budget_consumed_pct / 100.0))
        total_milestones = max(1, self._safe_int(input_data.get('total_milestones'), 8))
        completed_milestones = max(0, min(total_milestones, self._safe_int(input_data.get('completed_milestones'), 3)))
        overdue_milestones = max(0, self._safe_int(input_data.get('overdue_milestones'), 0))
        material_cost_index = self._safe_float(input_data.get('material_cost_index'), 1.0)
        labour_shortage_index = self._safe_float(input_data.get('labour_shortage_index'), 0.05)
        change_orders_count = max(0, self._safe_int(input_data.get('change_orders_count'), 0))

        progress_gap_pct = round(planned_progress_pct - actual_progress_pct, 2)

        feat_values = [
            contract_amount,
            approved_budget,
            planned_duration_days,
            planned_progress_pct,
            actual_progress_pct,
            progress_gap_pct,
            budget_consumed_pct,
            actual_expense_amount,
            total_milestones,
            completed_milestones,
            overdue_milestones,
            material_cost_index,
            labour_shortage_index,
            change_orders_count
        ]

        if self.is_loaded and self.cost_model is not None and self.delay_model is not None:
            # Model-based inference
            df_in = pd.DataFrame([feat_values], columns=FEATURES)
            X_scaled = self.scaler.transform(df_in)

            pred_cost_overrun_pct = float(self.cost_model.predict(X_scaled)[0])
            pred_delay_days = float(self.delay_model.predict(df_in)[0])
            method = "Trained ML Models (GradientBoosting & RandomForest)"
            confidence = 0.88
        else:
            # Physics-based / Earned Value Analysis fallback
            earned_value = approved_budget * (actual_progress_pct / 100.0)
            cpi = earned_value / actual_expense_amount if actual_expense_amount > 0 else 1.0
            spi = actual_progress_pct / planned_progress_pct if planned_progress_pct > 0 else 1.0

            remaining_work = max(0.01, (100.0 - actual_progress_pct) / 100.0)
            pred_final = actual_expense_amount + (approved_budget * remaining_work / max(0.4, cpi))
            pred_cost_overrun_pct = ((pred_final - approved_budget) / approved_budget) * 100.0
            
            projected_days = (planned_duration_days / max(0.35, spi)) + (overdue_milestones * 8.0)
            pred_delay_days = max(0.0, projected_days - planned_duration_days)
            method = "Earned Value Analysis Baseline (Uncached ML)"
            confidence = 0.75

        # Format predictions
        pred_cost_overrun_pct = max(-10.0, min(80.0, pred_cost_overrun_pct))
        predicted_final_cost = approved_budget * (1.0 + (pred_cost_overrun_pct / 100.0))
        budget_variance_amount = predicted_final_cost - approved_budget

        # Score mapping (0-100)
        cost_risk_score = round(max(0.0, min(100.0, ((pred_cost_overrun_pct + 4.0) / 40.0) * 100.0)), 1)
        cost_tier = "HIGH" if cost_risk_score >= 70.0 else ("MEDIUM" if cost_risk_score >= 35.0 else "LOW")

        pred_delay_days = round(max(-10, min(250, pred_delay_days)))
        schedule_risk_score = round(max(0.0, min(100.0, (pred_delay_days / 75.0) * 100.0)), 1)
        schedule_tier = "HIGH" if schedule_risk_score >= 70.0 else ("MEDIUM" if schedule_risk_score >= 35.0 else "LOW")

        # Key risk factors identification
        risk_factors: List[str] = []
        recommendations: List[str] = []

        burn_vs_progress = budget_consumed_pct - actual_progress_pct
        if burn_vs_progress > 10.0:
            risk_factors.append(f"Budget consumption ({budget_consumed_pct:.1f}%) is outpacing physical progress ({actual_progress_pct:.1f}%) by {burn_vs_progress:.1f}%.")
            recommendations.append("Audit recent site material dispatches and subcontractor invoices for non-milestone billing.")

        if progress_gap_pct > 7.0:
            risk_factors.append(f"Physical execution is lagging behind scheduled plan by {progress_gap_pct:.1f}%.")
            recommendations.append("Deploy additional site manpower or execute parallel work packages to recover lost critical path time.")

        if overdue_milestones > 0:
            risk_factors.append(f"{overdue_milestones} milestone(s) currently past due date on the critical path.")
            recommendations.append("Hold an urgent site coordination meeting with assigned sub-contractors to resolve execution blockers.")

        if material_cost_index > 1.12:
            inflation_pct = round((material_cost_index - 1.0) * 100.0, 1)
            risk_factors.append(f"Material procurement price index is elevated by +{inflation_pct}% above initial estimate.")
            recommendations.append("Lock in bulk advance purchase contracts with primary steel and cement vendors to hedge price volatility.")

        if labour_shortage_index > 0.20:
            shortage_pct = round(labour_shortage_index * 100.0, 1)
            risk_factors.append(f"Site labour attendance deficiency index is at {shortage_pct}%.")
            recommendations.append("Engage auxiliary labour subcontractors or adjust shift patterns with overtime incentives.")

        if change_orders_count >= 2:
            risk_factors.append(f"{change_orders_count} architectural or client scope revisions recorded.")
            recommendations.append("Issue formal client variation orders and seek approved budget revision before proceeding with scope changes.")

        if not risk_factors:
            risk_factors.append("Project performance parameters are tracking within normal engineering tolerances.")
            recommendations.append("Maintain routine weekly milestone reviews and material inventory tracking.")

        return {
            "status": "MODEL_READY" if self.is_loaded else "MODEL_NOT_TRAINED",
            "prediction_method": method,
            "model_version": self.metadata.get("model_version", "v1.2.0-morya"),
            "company": "Morya Enterprises",
            "confidence_score": confidence,
            "cost_risk": {
                "score": cost_risk_score,
                "tier": cost_tier,
                "predicted_final_cost": round(predicted_final_cost, 2),
                "budget_variance_amount": round(budget_variance_amount, 2),
                "cost_overrun_pct": round(pred_cost_overrun_pct, 2)
            },
            "schedule_risk": {
                "score": schedule_risk_score,
                "tier": schedule_tier,
                "estimated_delay_days": int(pred_delay_days)
            },
            "contributing_risk_factors": risk_factors,
            "actionable_recommendations": recommendations,
            "input_features": {
                "contract_amount": contract_amount,
                "approved_budget": approved_budget,
                "actual_expense_amount": actual_expense_amount,
                "budget_consumed_pct": budget_consumed_pct,
                "actual_progress_pct": actual_progress_pct,
                "planned_progress_pct": planned_progress_pct,
                "overdue_milestones": overdue_milestones,
                "progress_gap_pct": progress_gap_pct
            }
        }

    @staticmethod
    def _safe_float(value: Any, default: float) -> float:
        try:
            number = float(value)
            return number if math.isfinite(number) else default
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_int(value: Any, default: int) -> int:
        try:
            number = int(value)
            return number
        except (TypeError, ValueError):
            return default
