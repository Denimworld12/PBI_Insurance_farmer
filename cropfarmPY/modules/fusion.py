# modules/fusion.py
from typing import Dict, Any

def fuse_scores(auth_final: float, damage_conf: float, fraud_like: float, weather_support: bool) -> float:
    # Weighted and boost on external alignment
    fraud_conf = 1.0 - fraud_like
    score = auth_final * 0.4 + damage_conf * 0.35 + fraud_conf * 0.25
    if weather_support:
        score = min(1.0, score * 1.1)
    return round(score, 3)

def decide(final_conf: float, fraud_like: float) -> Dict[str,Any]:
    if fraud_like > 0.7:
        return {'action':'REJECT','reason':'High fraud risk','manual_review_required':True}
    if final_conf >= 0.75:
        return {'action':'APPROVE','reason':'High confidence','manual_review_required':False}
    if final_conf >= 0.5:
        return {'action':'MANUAL_REVIEW','reason':'Medium confidence','manual_review_required':True}
    return {'action':'REQUEST_ADDITIONAL','reason':'Low confidence','manual_review_required':True}
