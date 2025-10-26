# modules/environment.py
import os, requests
from typing import Dict, Any

def validate_with_weather(lat: float, lon: float, date_iso: str, claim_reason: str) -> Dict[str, Any]:
    api_key = os.getenv('RAPIDAPI_KEY')
    if not api_key:
        return {'success': False, 'error': 'API key not configured', 'supports_claim': False}
    url = "https://meteostat.p.rapidapi.com/point/daily"
    params = {'lat': lat, 'lon': lon, 'start': date_iso, 'end': date_iso}
    headers = {'x-rapidapi-key': api_key, 'x-rapidapi-host': 'meteostat.p.rapidapi.com'}
    r = requests.get(url, params=params, headers=headers, timeout=15)
    if r.status_code != 200:
        return {'success': False, 'error': f'API {r.status_code}', 'supports_claim': False}
    data = r.json().get('data', [])
    if not data:
        return {'success': False, 'error': 'no_data', 'supports_claim': False}
    row = data[0]
    hum = float(row.get('rhum', 50) or 50)
    tavg = float(row.get('tavg', 25) or 25)
    prcp = float(row.get('prcp', 0) or 0)
    supports = False
    reasons = []
    if claim_reason == 'pest_attack':
        if hum > 70: reasons.append(f'high_humidity_{hum}')
        if 25 <= tavg <= 35: reasons.append(f'ideal_temp_{tavg}')
        supports = len(reasons) > 0
    elif claim_reason == 'drought':
        if prcp < 5 and hum < 40: reasons.append(f'low_rain_{prcp}_low_hum_{hum}')
        supports = len(reasons) > 0
    elif claim_reason == 'flood':
        if prcp > 50: reasons.append(f'heavy_rain_{prcp}')
        supports = len(reasons) > 0
    return {'success': True, 'weather': {'rhum': hum, 'tavg': tavg, 'prcp': prcp}, 'supports_claim': supports, 'reasoning': reasons}
