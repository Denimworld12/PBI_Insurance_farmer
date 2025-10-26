# modules/fraud.py
from typing import Dict, Any, List

def analyze_fraud(farmer: Dict[str,Any], claim: Dict[str,Any], damage: Dict[str,Any], auth_score: float, scene: Dict[str,Any]) -> Dict[str,Any]:
    fraud_indicators: List[str] = []
    score = 0.0

    prior = len(farmer.get('historical_data', {}).get('previous_claim_history', []))
    if prior > 3:
        fraud_indicators.append(f'high_claim_frequency_{prior}')
        score += 0.2

    claimed = float(claim.get('estimated_damage_percent', 0) or 0)
    calculated = float(damage.get('calculated_damage_percent', 0) or 0)
    if claimed > calculated + 20:
        fraud_indicators.append(f'exaggerated_claim_{claimed}_vs_{calculated}')
        score += 0.25

    if auth_score < 0.5:
        fraud_indicators.append('low_authenticity_score')
        score += 0.25

    # Suspicious scene combos
    if scene.get('scenario') in ['farm_in_water_human', 'farm_fire_human'] and claimed is very_high(claimed=claimed):
        fraud_indicators.append('staged_risk_scene_high_claim')
        score += 0.1

    risk = 'high' if score > 0.7 else ('medium' if score > 0.4 else 'low')
    return {'fraud_likelihood': min(1.0, score), 'fraud_indicators': fraud_indicators, 'risk_level': risk, 'investigation_required': score > 0.5}

def very_high(claimed: float) -> bool:
    return claimed >= 80.0
