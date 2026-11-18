"""
Morya Enterprises - AI Risk Analysis
Synthetic Construction Project Dataset Generator
Generates realistic, physically consistent construction project history
for training Cost Overrun and Schedule Delay risk prediction models.
"""

import numpy as np
import pandas as pd
import os

def generate_construction_dataset(n_samples: int = 3500, random_seed: int = 42) -> pd.DataFrame:
    np.random.seed(random_seed)
    
    project_types = ['RESIDENTIAL', 'COMMERCIAL', 'INFRASTRUCTURE', 'INDUSTRIAL', 'RENOVATION']
    type_probs = [0.35, 0.30, 0.15, 0.10, 0.10]
    
    types = np.random.choice(project_types, size=n_samples, p=type_probs)
    
    # Base planned duration (in days)
    base_durations = {
        'RESIDENTIAL': np.random.randint(180, 540, size=n_samples),
        'COMMERCIAL': np.random.randint(240, 720, size=n_samples),
        'INFRASTRUCTURE': np.random.randint(300, 900, size=n_samples),
        'INDUSTRIAL': np.random.randint(270, 750, size=n_samples),
        'RENOVATION': np.random.randint(60, 240, size=n_samples),
    }
    planned_duration = np.array([base_durations[t][i] for i, t in enumerate(types)])
    
    # Contract amount in INR (from 25 Lakhs to 12 Crores)
    contract_ranges = {
        'RESIDENTIAL': (3500000, 35000000),
        'COMMERCIAL': (8000000, 100000000),
        'INFRASTRUCTURE': (15000000, 120000000),
        'INDUSTRIAL': (12000000, 80000000),
        'RENOVATION': (1500000, 15000000),
    }
    contract_amount = np.array([
        np.random.uniform(contract_ranges[t][0], contract_ranges[t][1])
        for t in types
    ])
    
    # Approved budget is typically 80% to 92% of contract amount (leaving contractor profit margin 8-20%)
    profit_margin_planned = np.random.uniform(0.08, 0.20, size=n_samples)
    approved_budget = contract_amount * (1.0 - profit_margin_planned)
    
    # Current stage of project: planned progress percentage (10% to 100%)
    planned_progress_pct = np.random.uniform(10.0, 100.0, size=n_samples)
    
    # Execution variance: actual progress vs planned progress
    # Construction projects frequently encounter unexpected ground conditions, weather, permit delays
    progress_slippage_factor = np.random.normal(loc=-4.5, scale=12.0, size=n_samples)
    actual_progress_pct = np.clip(planned_progress_pct + progress_slippage_factor, 5.0, 100.0)
    
    # Milestones metrics
    total_milestones = np.random.randint(4, 18, size=n_samples)
    completed_milestones = np.floor((actual_progress_pct / 100.0) * total_milestones).astype(int)
    
    # Overdue milestones
    overdue_milestones = np.zeros(n_samples, dtype=int)
    for i in range(n_samples):
        remaining = total_milestones[i] - completed_milestones[i]
        if remaining > 0 and (planned_progress_pct[i] > actual_progress_pct[i]):
            diff = planned_progress_pct[i] - actual_progress_pct[i]
            max_overdue = min(remaining, int(diff / 10) + 1)
            overdue_milestones[i] = np.random.randint(0, max_overdue + 1)
        else:
            overdue_milestones[i] = 0
            
    # Material cost inflation index (1.0 = baseline, up to 1.35 = 35% inflation spike in steel/cement)
    material_cost_index = np.random.uniform(0.92, 1.35, size=n_samples)
    
    # Labour shortage / turnover index (0.0 = full attendance, 0.45 = acute labour shortage)
    labour_shortage_index = np.random.beta(a=2, b=5, size=n_samples) * 0.5
    
    # Scope changes / change orders count
    change_orders_count = np.random.poisson(lam=1.5, size=n_samples)
    
    # Budget consumed percentage: based on progress, material index, labour shortage, change orders
    # Ideal burn would equal actual progress. But real contractors experience overruns due to rework, inflation, delay overhead
    cost_inefficiency = (
        (material_cost_index - 1.0) * 0.45 +
        labour_shortage_index * 0.35 +
        (change_orders_count * 0.035) +
        np.maximum(0, (planned_progress_pct - actual_progress_pct) / 100.0) * 0.30 +
        np.random.normal(0, 0.04, size=n_samples)
    )
    
    budget_consumed_pct = (actual_progress_pct * (1.0 + cost_inefficiency))
    budget_consumed_pct = np.clip(budget_consumed_pct, 2.0, 160.0)
    
    actual_expense_amount = approved_budget * (budget_consumed_pct / 100.0)
    
    # Calculate Ground-truth Targets for ML
    
    # 1. Cost Overrun Rate (Final Projected Cost / Approved Budget - 1.0)
    # Extrapolated completion cost using Earned Value Analysis principles (Cost Performance Index CPI)
    earned_value = approved_budget * (actual_progress_pct / 100.0)
    actual_cost = actual_expense_amount
    cpi = np.where(actual_cost > 0, earned_value / actual_cost, 1.0)
    cpi = np.clip(cpi, 0.4, 1.6)
    
    remaining_work_ratio = np.maximum(0.01, (100.0 - actual_progress_pct) / 100.0)
    
    # Projected final cost
    projected_final_cost = actual_cost + (approved_budget * remaining_work_ratio / cpi)
    cost_overrun_pct = ((projected_final_cost - approved_budget) / approved_budget) * 100.0
    cost_overrun_pct = np.clip(cost_overrun_pct, -15.0, 75.0)
    
    # Cost risk score (0 to 100)
    cost_risk_score = np.clip(
        ((cost_overrun_pct + 5.0) / 45.0) * 100.0,
        0.0, 100.0
    )
    
    cost_risk_tier = pd.cut(
        cost_risk_score,
        bins=[-np.inf, 35.0, 70.0, np.inf],
        labels=['LOW', 'MEDIUM', 'HIGH']
    )
    
    # 2. Schedule Delay Targets (Days of delay at completion)
    spi = np.where(planned_progress_pct > 0, actual_progress_pct / planned_progress_pct, 1.0)
    spi = np.clip(spi, 0.35, 1.5)
    
    projected_duration = planned_duration / spi + (overdue_milestones * 9.0)
    estimated_delay_days = np.clip(projected_duration - planned_duration, -30, 240)
    
    schedule_risk_score = np.clip(
        (estimated_delay_days / 90.0) * 100.0,
        0.0, 100.0
    )
    
    schedule_risk_tier = pd.cut(
        schedule_risk_score,
        bins=[-np.inf, 35.0, 70.0, np.inf],
        labels=['LOW', 'MEDIUM', 'HIGH']
    )
    
    df = pd.DataFrame({
        'construction_type': types,
        'contract_amount': np.round(contract_amount, 2),
        'approved_budget': np.round(approved_budget, 2),
        'planned_duration_days': planned_duration,
        'planned_progress_pct': np.round(planned_progress_pct, 2),
        'actual_progress_pct': np.round(actual_progress_pct, 2),
        'progress_gap_pct': np.round(planned_progress_pct - actual_progress_pct, 2),
        'budget_consumed_pct': np.round(budget_consumed_pct, 2),
        'actual_expense_amount': np.round(actual_expense_amount, 2),
        'total_milestones': total_milestones,
        'completed_milestones': completed_milestones,
        'overdue_milestones': overdue_milestones,
        'material_cost_index': np.round(material_cost_index, 3),
        'labour_shortage_index': np.round(labour_shortage_index, 3),
        'change_orders_count': change_orders_count,
        # Targets:
        'cost_overrun_pct': np.round(cost_overrun_pct, 2),
        'projected_final_cost': np.round(projected_final_cost, 2),
        'cost_risk_score': np.round(cost_risk_score, 1),
        'cost_risk_tier': cost_risk_tier,
        'estimated_delay_days': np.round(estimated_delay_days).astype(int),
        'schedule_risk_score': np.round(schedule_risk_score, 1),
        'schedule_risk_tier': schedule_risk_tier
    })
    
    return df

if __name__ == '__main__':
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    df = generate_construction_dataset(n_samples=4000)
    out_file = os.path.join(data_dir, 'synthetic_construction_projects.csv')
    df.to_csv(out_file, index=False)
    print(f"Generated {len(df)} construction project samples saved to {out_file}")
    print(df.head())
