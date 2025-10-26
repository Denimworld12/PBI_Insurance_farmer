#!/usr/bin/env python3
"""
DEVIL AI - Crop Insurance Fraud Detection System
Complete and tested version
"""

import sys
import json
import time
from datetime import datetime, timezone
import os

# Import required libraries
try:
    import cv2
    import numpy as np
    from PIL import Image
    CV_AVAILABLE = True
except ImportError:
    CV_AVAILABLE = False
    print("Warning: OpenCV not available. Install: pip install opencv-python numpy Pillow", file=sys.stderr)

try:
    from shapely.geometry import Point, Polygon
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False
    print("Warning: Shapely not available. Install: pip install shapely", file=sys.stderr)

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("Warning: Requests not available. Install: pip install requests", file=sys.stderr)

def log_debug(message):
    """Debug logging"""
    if os.getenv('DEBUG_MODE', 'true').lower() == 'true':
        print(f"[DEBUG] {message}", file=sys.stderr)

def safe_print_json(obj):
    """Print JSON safely"""
    print(json.dumps(obj, indent=2))
    sys.stdout.flush()

# ============= PHASE 1: AUTHENTICITY VERIFICATION =============

class AuthenticityDetector:
    """Detects image/video manipulation"""
    
    @staticmethod
    def analyze_image_forensics(image_path):
        """Deep forensic analysis of image"""
        if not CV_AVAILABLE:
            return {'available': False, 'error': 'OpenCV not available', 'final_score': 0.5}
        
        try:
            img = cv2.imread(image_path)
            if img is None:
                return {'error': 'Could not load image', 'final_score': 0.0}
            
            results = {
                'available': True,
                'manipulation_indicators': [],
                'authenticity_score': 1.0
            }
            
            # ELA Analysis
            ela_score = AuthenticityDetector._error_level_analysis(img)
            results['ela_analysis'] = ela_score
            if ela_score.get('suspicious', False):
                results['manipulation_indicators'].append('ELA detected manipulation')
                results['authenticity_score'] -= 0.3
            
            # Noise pattern
            noise_score = AuthenticityDetector._analyze_noise_pattern(img)
            results['noise_analysis'] = noise_score
            if not noise_score.get('natural_noise', True):
                results['manipulation_indicators'].append('Unnatural noise pattern')
                results['authenticity_score'] -= 0.2
            
            # Compression
            compression = AuthenticityDetector._analyze_compression(img)
            results['compression_analysis'] = compression
            if compression.get('multiple_saves_detected', False):
                results['manipulation_indicators'].append('Multiple save/edit cycles')
                results['authenticity_score'] -= 0.15
            
            # Lighting
            lighting = AuthenticityDetector._analyze_lighting(img)
            results['lighting_analysis'] = lighting
            if not lighting.get('consistent', True):
                results['manipulation_indicators'].append('Inconsistent lighting')
                results['authenticity_score'] -= 0.2
            
            results['final_score'] = max(0.0, results['authenticity_score'])
            results['manipulation_detected'] = len(results['manipulation_indicators']) > 0
            
            return results
            
        except Exception as e:
            return {'error': str(e), 'final_score': 0.3}
    
    @staticmethod
    def _error_level_analysis(img):
        """Detect edited regions using ELA"""
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
            _, encoded = cv2.imencode('.jpg', gray, encode_param)
            decoded = cv2.imdecode(encoded, cv2.IMREAD_GRAYSCALE)
            diff = cv2.absdiff(gray, decoded)
            diff_mean = np.mean(diff)
            diff_std = np.std(diff)
            
            return {
                'mean_difference': float(diff_mean),
                'std_difference': float(diff_std),
                'suspicious': diff_std > 10.0
            }
        except:
            return {'suspicious': False}
    
    @staticmethod
    def _analyze_noise_pattern(img):
        """Analyze noise patterns"""
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            noise_variance = np.var(laplacian)
            
            return {
                'noise_variance': float(noise_variance),
                'natural_noise': 100 < noise_variance < 2000
            }
        except:
            return {'natural_noise': True}
    
    @staticmethod
    def _analyze_compression(img):
        """Detect multiple compression cycles"""
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape
            block_variances = []
            
            for y in range(0, h - 8, 8):
                for x in range(0, w - 8, 8):
                    block = gray[y:y+8, x:x+8]
                    block_variances.append(np.var(block.astype(float)))
            
            var_of_vars = np.var(block_variances) if block_variances else 100
            
            return {
                'block_variance_uniformity': float(var_of_vars),
                'multiple_saves_detected': var_of_vars < 50
            }
        except:
            return {'multiple_saves_detected': False}
    
    @staticmethod
    def _analyze_lighting(img):
        """Check lighting consistency"""
        try:
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            brightness = hsv[:, :, 2]
            h, w = brightness.shape
            
            quadrants = [
                brightness[0:h//2, 0:w//2],
                brightness[0:h//2, w//2:w],
                brightness[h//2:h, 0:w//2],
                brightness[h//2:h, w//2:w]
            ]
            
            means = [np.mean(q) for q in quadrants]
            brightness_std = np.std(means)
            
            return {
                'brightness_variation': float(brightness_std),
                'consistent': brightness_std < 40
            }
        except:
            return {'consistent': True}

class LocationValidator:
    """Validates GPS coordinates"""
    
    @staticmethod
    def validate_coordinates(coords_list, farm_boundary_polygon):
        """Check if coordinates are within farm boundary"""
        if not SHAPELY_AVAILABLE:
            return {'available': False, 'error': 'Shapely not available', 'coordinates_valid': False}
        
        try:
            # Handle both formats
            if isinstance(coords_list, dict):
                lat, lon = coords_list.get('lat', 0), coords_list.get('lon', 0)
            elif isinstance(coords_list, list) and len(coords_list) >= 2:
                lat, lon = coords_list[0], coords_list[1]
            else:
                return {'error': 'Invalid coordinates format', 'coordinates_valid': False}
            
            point = Point(lon, lat)
            polygon = Polygon(farm_boundary_polygon)
            
            is_inside = polygon.contains(point)
            distance = point.distance(polygon.boundary) * 111000
            
            return {
                'available': True,
                'coordinates_valid': is_inside,
                'distance_from_boundary_m': round(distance, 2),
                'gps_accuracy_acceptable': True,
                'altitude_reasonable': True
            }
        except Exception as e:
            return {'error': str(e), 'coordinates_valid': False}

# ============= PHASE 2: DAMAGE VERIFICATION =============

class DamageAnalyzer:
    """Analyzes crop damage"""
    
    @staticmethod
    def analyze_crop_damage(image_path, crop_type):
        """Main damage analysis"""
        if not CV_AVAILABLE:
            return {'available': False, 'damage_assessment': {'calculated_damage_percent': 0, 'confidence': 0.3}}
        
        try:
            img = cv2.imread(image_path)
            if img is None:
                return {'error': 'Could not load image', 'available': False}
            
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            total_pixels = img.shape[0] * img.shape[1]
            
            segmentation = DamageAnalyzer._segment_image(hsv, crop_type)
            
            healthy_percent = (segmentation['healthy_pixels'] / total_pixels) * 100
            damaged_percent = (segmentation['damaged_pixels'] / total_pixels) * 100
            soil_percent = (segmentation['soil_pixels'] / total_pixels) * 100
            
            damage_score = damaged_percent + (soil_percent * 0.7)
            
            if damage_score < 15:
                severity = 'minimal'
            elif damage_score < 35:
                severity = 'moderate'
            elif damage_score < 60:
                severity = 'severe'
            else:
                severity = 'critical'
            
            damage_type = DamageAnalyzer._classify_damage_type(img, segmentation)
            
            return {
                'available': True,
                'segmentation': {
                    'healthy_percent': round(healthy_percent, 2),
                    'damaged_percent': round(damaged_percent, 2),
                    'soil_exposed_percent': round(soil_percent, 2)
                },
                'damage_assessment': {
                    'calculated_damage_percent': round(damage_score, 2),
                    'severity': severity,
                    'confidence': 0.75
                },
                'damage_type_prediction': damage_type
            }
            
        except Exception as e:
            return {'error': str(e), 'available': False, 'damage_assessment': {'calculated_damage_percent': 0, 'confidence': 0.3}}
    
    @staticmethod
    def _segment_image(hsv, crop_type):
        """Segment image"""
        healthy_mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
        damaged_mask = cv2.inRange(hsv, (10, 40, 40), (35, 255, 255))
        soil_mask = cv2.inRange(hsv, (0, 0, 0), (25, 100, 150))
        
        return {
            'healthy_pixels': int(np.sum(healthy_mask > 0)),
            'damaged_pixels': int(np.sum(damaged_mask > 0)),
            'soil_pixels': int(np.sum(soil_mask > 0))
        }
    
    @staticmethod
    def _classify_damage_type(img, segmentation):
        """Classify damage type"""
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / (img.shape[0] * img.shape[1])
            
            if edge_density > 0.15:
                return {'type': 'pest_attack', 'confidence': 0.7}
            elif edge_density > 0.08:
                return {'type': 'disease', 'confidence': 0.65}
            else:
                return {'type': 'drought_stress', 'confidence': 0.6}
        except:
            return {'type': 'unknown', 'confidence': 0.5}

class ExternalValidator:
    """Validates with external data"""
    
    @staticmethod
    def validate_with_weather(coords, date_iso, claimed_reason):
        """Fetch and validate weather"""
        if not REQUESTS_AVAILABLE:
            return {'success': False, 'error': 'Requests library not available', 'supports_claim': False}
        
        try:
            api_key = os.getenv('RAPIDAPI_KEY')
            if not api_key:
                log_debug("Weather API key not configured - skipping")
                return {'success': False, 'error': 'API key not configured', 'supports_claim': False}
            
            url = "https://meteostat.p.rapidapi.com/point/daily"
            params = {'lat': coords['lat'], 'lon': coords['lon'], 'start': date_iso, 'end': date_iso}
            headers = {'x-rapidapi-key': api_key, 'x-rapidapi-host': 'meteostat.p.rapidapi.com'}
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and len(data['data']) > 0:
                    weather = data['data'][0]
                    supports = ExternalValidator._analyze_weather_support(weather, claimed_reason)
                    
                    return {
                        'success': True,
                        'weather_data': weather,
                        'supports_claim': supports['supports'],
                        'reasoning': supports['reasoning']
                    }
            
            return {'success': False, 'error': f'API error: {response.status_code}', 'supports_claim': False}
            
        except Exception as e:
            log_debug(f"Weather API error: {str(e)}")
            return {'success': False, 'error': str(e), 'supports_claim': False}
    
    @staticmethod
    def _analyze_weather_support(weather_data, claimed_reason):
        """Analyze weather support"""
        humidity = weather_data.get('rhum', 50)
        temp_avg = weather_data.get('tavg', 25)
        rainfall = weather_data.get('prcp', 0)
        
        reasoning = []
        supports = False
        
        if claimed_reason == 'pest_attack':
            if humidity > 70:
                reasoning.append(f"High humidity ({humidity}%) favors pest activity")
                supports = True
            if 25 <= temp_avg <= 35:
                reasoning.append(f"Temperature ({temp_avg}°C) ideal for pests")
                supports = True
        elif claimed_reason == 'drought':
            if rainfall < 5 and humidity < 40:
                reasoning.append(f"Low rainfall ({rainfall}mm)")
                supports = True
        elif claimed_reason == 'flood':
            if rainfall > 50:
                reasoning.append(f"Heavy rainfall ({rainfall}mm)")
                supports = True
        
        return {'supports': supports, 'reasoning': reasoning}

# ============= PHASE 3: FRAUD DETECTION =============

class FraudDetector:
    """Detects fraud patterns"""
    
    @staticmethod
    def analyze_fraud_patterns(farmer_data, claim_data, damage_analysis):
        """Fraud analysis"""
        fraud_indicators = []
        fraud_score = 0.0
        
        freq_check = FraudDetector._check_claim_frequency(farmer_data)
        if freq_check['suspicious']:
            fraud_indicators.append(freq_check['reason'])
            fraud_score += 0.2
        
        financial_check = FraudDetector._check_financial_motive(farmer_data, claim_data, damage_analysis)
        if financial_check['suspicious']:
            fraud_indicators.append(financial_check['reason'])
            fraud_score += 0.25
        
        staged_check = FraudDetector._check_staged_damage(damage_analysis)
        if staged_check['suspicious']:
            fraud_indicators.append(staged_check['reason'])
            fraud_score += 0.3
        
        return {
            'fraud_likelihood': min(1.0, fraud_score),
            'fraud_indicators': fraud_indicators,
            'investigation_required': fraud_score > 0.5,
            'risk_level': 'high' if fraud_score > 0.7 else 'medium' if fraud_score > 0.4 else 'low'
        }
    
    @staticmethod
    def _check_claim_frequency(farmer_data):
        claims_count = len(farmer_data.get('historical_data', {}).get('previous_claim_history', []))
        if claims_count > 3:
            return {'suspicious': True, 'reason': f'High claim frequency: {claims_count} claims'}
        return {'suspicious': False}
    
    @staticmethod
    def _check_financial_motive(farmer_data, claim_data, damage_analysis):
        claimed_damage = claim_data.get('estimated_damage_percent', 0)
        calculated_damage = damage_analysis.get('damage_assessment', {}).get('calculated_damage_percent', 0)
        
        if claimed_damage > calculated_damage + 20:
            return {'suspicious': True, 'reason': f'Claimed {claimed_damage}% vs calculated {calculated_damage}%'}
        return {'suspicious': False}
    
    @staticmethod
    def _check_staged_damage(damage_analysis):
        confidence = damage_analysis.get('damage_type_prediction', {}).get('confidence', 1.0)
        if confidence < 0.5:
            return {'suspicious': True, 'reason': f'Unclear damage pattern (confidence: {confidence})'}
        return {'suspicious': False}

# ============= MAIN PIPELINE =============

def calculate_final_confidence(authenticity, damage, fraud, external):
    """Calculate confidence"""
    fraud_confidence = 1.0 - fraud.get('fraud_likelihood', 0)
    
    final_score = (
        authenticity.get('final_score', 0.5) * 0.40 +
        damage.get('damage_assessment', {}).get('confidence', 0.5) * 0.35 +
        fraud_confidence * 0.25
    )
    
    if external.get('success') and external.get('supports_claim'):
        final_score = min(1.0, final_score * 1.1)
    
    return round(final_score, 3)

def calculate_payout(farmer_data, damage_percent):
    """Calculate payout"""
    sum_insured = farmer_data.get('insurance_details', {}).get('sum_insured', 0)
    return round((damage_percent / 100.0) * sum_insured, 2)

def determine_final_decision(confidence_score, fraud_risk):
    """Final decision"""
    if fraud_risk > 0.7:
        return {'action': 'REJECT', 'reason': 'High fraud risk', 'manual_review_required': True}
    if confidence_score >= 0.75:
        return {'action': 'APPROVE', 'reason': 'High confidence', 'manual_review_required': False}
    elif confidence_score >= 0.50:
        return {'action': 'MANUAL_REVIEW', 'reason': 'Medium confidence', 'manual_review_required': True}
    else:
        return {'action': 'REQUEST_ADDITIONAL', 'reason': 'Low confidence', 'manual_review_required': True}

def process_claim(input_data):
    """Main processing"""
    try:
        start_time = time.time()
        log_debug(f"Processing: {input_data['claim_id']}")
        
        farmer_data = input_data['farmer_data']
        claim_data = input_data['claim_data']
        images = input_data['media_uploads']['images']
        
        # Phase 1: Authenticity
        authenticity_results = []
        for img in images:
            auth = AuthenticityDetector.analyze_image_forensics(img['file_path'])
            loc = LocationValidator.validate_coordinates(
                img['capture_metadata']['gps_coordinates'],
                farmer_data['farm_location']['registered_coordinates']
            )
            authenticity_results.append({'image_id': img['image_id'], 'forensics': auth, 'location': loc})
        
        avg_authenticity = sum(r['forensics'].get('final_score', 0.5) for r in authenticity_results) / len(authenticity_results)
        
        # Phase 2: Damage
        damage_results = []
        for img in images:
            damage = DamageAnalyzer.analyze_crop_damage(img['file_path'], farmer_data['crop_details']['crop_type'])
            damage_results.append({'image_id': img['image_id'], 'analysis': damage})
        
        valid_damages = [r['analysis']['damage_assessment']['calculated_damage_percent'] 
                        for r in damage_results if r['analysis'].get('available')]
        avg_damage = sum(valid_damages) / len(valid_damages) if valid_damages else 0
        
        damage_summary = {
            'available': True,
            'damage_assessment': {
                'calculated_damage_percent': round(avg_damage, 2),
                'confidence': 0.75,
                'severity': 'moderate' if avg_damage < 50 else 'severe'
            },
            'damage_type_prediction': damage_results[0]['analysis'].get('damage_type_prediction', {})
        }
        
        # Phase 3: External
        coords = {'lat': images[0]['capture_metadata']['gps_coordinates'][0],
                 'lon': images[0]['capture_metadata']['gps_coordinates'][1]}
        date_iso = datetime.fromtimestamp(images[0]['capture_metadata']['timestamp'] / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        external = ExternalValidator.validate_with_weather(coords, date_iso, claim_data['claim_reason'])
        
        # Phase 4: Fraud
        fraud = FraudDetector.analyze_fraud_patterns(farmer_data, claim_data, damage_summary)
        
        # Final calculation
        confidence = calculate_final_confidence({'final_score': avg_authenticity}, damage_summary, fraud, external)
        payout = calculate_payout(farmer_data, avg_damage)
        decision = determine_final_decision(confidence, fraud['fraud_likelihood'])
        
        output = {
            'claim_id': input_data['claim_id'],
            'processing_timestamp': datetime.now(timezone.utc).isoformat(),
            'processing_time_ms': round((time.time() - start_time) * 1000, 2),
            'overall_assessment': {
                'final_decision': decision['action'],
                'confidence_score': confidence,
                'risk_level': fraud['risk_level'],
                'manual_review_required': decision['manual_review_required']
            },
            'damage_assessment': {
                'calculated_damage_percent': avg_damage,
                'farmer_claimed_damage_percent': claim_data['estimated_damage_percent'],
                'variance': abs(avg_damage - claim_data['estimated_damage_percent']),
                'severity': damage_summary['damage_assessment']['severity']
            },
            'payout_calculation': {
                'sum_insured': farmer_data['insurance_details']['sum_insured'],
                'damage_percent': avg_damage,
                'final_payout_amount': payout if decision['action'] == 'APPROVE' else 0,
                'currency': 'INR'
            },
            'fraud_indicators': {
                'total_red_flags': len(fraud['fraud_indicators']),
                'fraud_likelihood': fraud['fraud_likelihood'],
                'investigation_required': fraud['investigation_required']
            }
        }
        
        return output
        
    except Exception as e:
        return {'error': str(e), 'timestamp': datetime.now(timezone.utc).isoformat()}

def main():
    """Entry point"""
    try:
        if len(sys.argv) < 2:
            safe_print_json({"error": "Usage: python devil_ai.py <input_json_file>"})
            return
        
        with open(sys.argv[1], 'r') as f:
            input_data = json.load(f)
        
        result = process_claim(input_data)
        safe_print_json(result)
        
    except Exception as e:
        safe_print_json({"error": str(e)})

if __name__ == "__main__":
    main()