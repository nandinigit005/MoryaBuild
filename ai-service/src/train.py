"""
Morya Enterprises - AI Risk Analysis
Model Training & Evaluation Pipeline
Trains:
1. Cost Overrun Regressor (Predicts final cost overrun percentage and variance)
2. Schedule Delay Regressor (Predicts delay in days and slippage score)
Saves model checkpoints, evaluation metrics, and feature importances.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

try:
    from .generator import generate_construction_dataset
except ImportError:
    from generator import generate_construction_dataset

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

def train_and_evaluate(data_path: str = None, models_dir: str = None):
    current_dir = os.path.dirname(__file__)
    if models_dir is None:
        models_dir = os.path.join(current_dir, '..', 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    if data_path and os.path.exists(data_path):
        print(f"Loading existing dataset from {data_path}...")
        df = pd.read_csv(data_path)
    else:
        print("Generating fresh synthetic construction dataset...")
        df = generate_construction_dataset(n_samples=5000, random_seed=42)
        save_data_dir = os.path.join(current_dir, '..', 'data')
        os.makedirs(save_data_dir, exist_ok=True)
        df.to_csv(os.path.join(save_data_dir, 'synthetic_construction_projects.csv'), index=False)

    X = df[FEATURES]
    y_cost = df['cost_overrun_pct']
    y_delay = df['estimated_delay_days']
    
    # Train / Test split (80% train, 20% test)
    X_train, X_test, y_cost_train, y_cost_test, y_delay_train, y_delay_test = train_test_split(
        X, y_cost, y_delay, test_size=0.20, random_state=42
    )
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Cost Overrun Model (Gradient Boosting Regressor)
    print("Training Cost Overrun Model (GradientBoostingRegressor)...")
    cost_model = GradientBoostingRegressor(
        n_estimators=120,
        learning_rate=0.08,
        max_depth=4,
        random_state=42
    )
    cost_model.fit(X_train_scaled, y_cost_train)
    
    # Evaluate Cost Model
    cost_preds = cost_model.predict(X_test_scaled)
    cost_r2 = r2_score(y_cost_test, cost_preds)
    cost_mae = mean_absolute_error(y_cost_test, cost_preds)
    cost_rmse = np.sqrt(mean_squared_error(y_cost_test, cost_preds))
    print(f"Cost Model Evaluation: R² = {cost_r2:.4f}, MAE = {cost_mae:.2f}%, RMSE = {cost_rmse:.2f}%")
    
    # Train Schedule Delay Model (Random Forest Regressor)
    print("Training Schedule Delay Model (RandomForestRegressor)...")
    delay_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=6,
        random_state=42,
        n_jobs=-1
    )
    delay_model.fit(X_train, y_delay_train)
    
    # Evaluate Delay Model
    delay_preds = delay_model.predict(X_test)
    delay_r2 = r2_score(y_delay_test, delay_preds)
    delay_mae = mean_absolute_error(y_delay_test, delay_preds)
    delay_rmse = np.sqrt(mean_squared_error(y_delay_test, delay_preds))
    print(f"Delay Model Evaluation: R² = {delay_r2:.4f}, MAE = {delay_mae:.2f} days, RMSE = {delay_rmse:.2f} days")
    
    # Feature importances
    cost_importances = dict(zip(FEATURES, [round(float(v), 4) for v in cost_model.feature_importances_]))
    delay_importances = dict(zip(FEATURES, [round(float(v), 4) for v in delay_model.feature_importances_]))
    
    # Save artifacts
    joblib.dump(scaler, os.path.join(models_dir, 'scaler.joblib'))
    joblib.dump(cost_model, os.path.join(models_dir, 'cost_overrun_model.joblib'))
    joblib.dump(delay_model, os.path.join(models_dir, 'schedule_delay_model.joblib'))
    
    metadata = {
        "model_version": "v1.2.0-morya",
        "company": "Morya Enterprises",
        "training_status": "TRAINED_ON_SYNTHETIC_DEMONSTRATION_DATA",
        "dataset_type": "synthetic_demonstration",
        "features": FEATURES,
        "dataset_samples": len(df),
        "test_samples": len(X_test),
        "cost_model_metrics": {
            "algorithm": "GradientBoostingRegressor",
            "r2_score": round(float(cost_r2), 4),
            "mae_percentage": round(float(cost_mae), 2),
            "rmse_percentage": round(float(cost_rmse), 2)
        },
        "delay_model_metrics": {
            "algorithm": "RandomForestRegressor",
            "r2_score": round(float(delay_r2), 4),
            "mae_days": round(float(delay_mae), 2),
            "rmse_days": round(float(delay_rmse), 2)
        },
        "cost_feature_importances": cost_importances,
        "delay_feature_importances": delay_importances
    }
    
    meta_path = os.path.join(models_dir, 'metadata.json')
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Artifacts and metadata successfully saved to {models_dir}")
    return metadata

if __name__ == '__main__':
    train_and_evaluate()
