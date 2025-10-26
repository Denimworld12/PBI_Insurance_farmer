# modules/pipeline.py
import cv2, json
from datetime import datetime, timezone
from typing import Dict, Any, List
from modules.authenticity import analyze_image_forensics
from modules.content import ContentDetector, classify_scene
from modules.metadata import read_exif
from modules.environment import validate_with_weather
from modules.fraud import analyze_fraud
from modules.fusion import fuse_scores, decide

def process_claim(input_data: Dict[str,Any]) -> Dict[str,Any]:
    farmer = input_data['farmer_data']
    claim = input_data['claim_data']
    images = input_data['media_uploads']['images']
    crop_type = farmer.get('crop_details', {}).get('crop_type', 'Unknown')

    yolo = ContentDetector()
    auth_scores, scenes, exifs = [], [], []
    per_image = []

    for img in images:
        path = img['file_path']
        auth = analyze_image_forensics(path)
        scene = classify_scene(path, yolo)
        exif_info = read_exif(path)
        loc = {'coordinates_valid': False, 'distance_from_boundary_m': None}
        try:
            from shapely.geometry import Point, Polygon
            gps = img['capture_metadata']['gps_coordinates']
            point = Point(gps[1], gps[0])
            poly = Polygon(farmer['farm_location']['registered_coordinates'])
            loc['coordinates_valid'] = poly.contains(point)
            loc['distance_from_boundary_m'] = round(point.distance(poly.boundary)*111000, 2)
        except Exception:
            pass

        auth_scores.append(auth.get('final_score', 0.5))
        scenes.append(scene)
        exifs.append(exif_info)
        per_image.append({'image_id': img['image_id'], 'authenticity': auth, 'scene': scene, 'exif': exif_info, 'location': loc})

    avg_auth = sum(auth_scores)/len(auth_scores) if auth_scores else 0.5
    # Simple damage estimate proxy from vegetation loss across images (can be replaced by your HSV-based damage analyzer)
    veg_list = [s['vegetation_percent'] for s in scenes if s.get('available')]
    damage_percent = max(0.0, 100.0 - (sum(veg_list)/len(veg_list))) if veg_list else 0.0
    damage_conf = 0.75 if veg_list else 0.5
    severity = 'minimal' if damage_percent < 15 else ('moderate' if damage_percent < 35 else ('severe' if damage_percent < 60 else 'critical'))

    first_ts = images[0]['capture_metadata'].get('timestamp')
    date_iso = datetime.fromtimestamp(first_ts/1000, tz=timezone.utc).strftime("%Y-%m-%d") if first_ts else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lat = images[0]['capture_metadata']['gps_coordinates'][0]
    lon = images[0]['capture_metadata']['gps_coordinates'][1]
    weather = validate_with_weather(lat, lon, date_iso, claim.get('claim_reason',''))
    fraud = analyze_fraud(farmer, claim, {'calculated_damage_percent': damage_percent}, avg_auth, scenes[0] if scenes else {})

    final_conf = fuse_scores(avg_auth, damage_conf, fraud['fraud_likelihood'], weather.get('supports_claim', False))
    decision = decide(final_conf, fraud['fraud_likelihood'])

    sum_insured = float(farmer.get('insurance_details', {}).get('sum_insured', 0) or 0)
    payout = round((damage_percent/100.0)*sum_insured, 2) if decision['action'] == 'APPROVE' else 0.0

    # scenario consolidation: choose dominant across images
    scen_counts = {}
    for s in scenes:
        scen_counts[s.get('scenario','unknown')] = scen_counts.get(s.get('scenario','unknown'), 0) + 1
    scenario = max(scen_counts, key=scen_counts.get) if scen_counts else 'unknown'

    return {
        'claim_id': input_data['claim_id'],
        'processing_timestamp': datetime.now(timezone.utc).isoformat(),
        'overall_assessment': {
            'final_decision': decision['action'],
            'confidence_score': final_conf,
            'risk_level': fraud['risk_level'],
            'manual_review_required': decision['manual_review_required']
        },
        'scene_summary': {'scenario': scenario, 'images': scenes},
        'damage_assessment': {
            'calculated_damage_percent': round(damage_percent,2),
            'farmer_claimed_damage_percent': claim.get('estimated_damage_percent', 0),
            'variance': abs(damage_percent - float(claim.get('estimated_damage_percent', 0) or 0)),
            'severity': severity
        },
        'payout_calculation': {
            'sum_insured': sum_insured,
            'damage_percent': round(damage_percent,2),
            'final_payout_amount': payout,
            'currency': 'INR'
        },
        'fraud_indicators': {
            'total_red_flags': len(fraud['fraud_indicators']),
            'fraud_likelihood': fraud['fraud_likelihood'],
            'investigation_required': fraud['investigation_required'],
            'list': fraud['fraud_indicators']
        },
        'external_validation': weather,
        'per_image_evidence': per_image
    }
