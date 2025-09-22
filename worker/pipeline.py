#!/usr/bin/env python3
# worker/pipeline.py - Complete PBI Agriculture Insurance System
import sys
import json
import time
import math
import io
import hashlib
import os
import traceback
import requests
import http.client
from datetime import datetime, timezone
from pathlib import Path

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
    ENV_AVAILABLE = True
except ImportError:
    ENV_AVAILABLE = False

# Try to import required libraries with fallbacks
try:
    from PIL import Image, ImageOps, ImageChops, ImageStat, ImageEnhance
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

try:
    from exif import Image as ExifImage
    EXIF_AVAILABLE = True
except ImportError:
    EXIF_AVAILABLE = False

try:
    import shapely.geometry as geom
    from shapely import Point, Polygon
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False

# Environment configuration
RAPIDAPI_KEY = os.getenv('RAPIDAPI_KEY', 'd2abc61cabmshbfccea6298fb9cfp12cf84jsncbf194b10aba')
RAPIDAPI_HOST = os.getenv('RAPIDAPI_HOST', 'meteostat.p.rapidapi.com')
DEFAULT_ALTITUDE = int(os.getenv('DEFAULT_ALTITUDE', '100'))
WEATHER_TIMEOUT = int(os.getenv('WEATHER_TIMEOUT_SECONDS', '10'))
DEBUG_MODE = os.getenv('DEBUG_MODE', 'false').lower() == 'true'

def check_dependencies():
    """Check if required dependencies are available"""
    missing = []
    if not PIL_AVAILABLE:
        missing.append("Pillow (pip install Pillow)")
    if not NUMPY_AVAILABLE:
        missing.append("NumPy (pip install numpy)")
    if not EXIF_AVAILABLE:
        missing.append("exif (pip install exif)")
    if not SHAPELY_AVAILABLE:
        missing.append("Shapely (pip install shapely)")
    
    if missing:
        return False, missing
    return True, []

def safe_print_json(obj):
    """Safely print JSON to stdout for Node.js to parse"""
    try:
        print(json.dumps(obj, indent=None, separators=(',', ':')))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"error": "JSON serialization failed", "details": str(e)}))

def read_exif_data(image_path):
    """Extract EXIF data from image with error handling"""
    if not EXIF_AVAILABLE:
        return None, {}
    
    try:
        with open(image_path, "rb") as f:
            img = ExifImage(f)
        
        if not img.has_exif:
            return None, {"error": "No EXIF data found"}
        
        return img, {}
    except Exception as e:
        return None, {"error": f"Failed to read EXIF: {str(e)}"}

def extract_gps_coordinates(exif_img):
    """Extract GPS coordinates from EXIF data"""
    if not exif_img:
        return None, None
    
    def dms_to_decimal(dms_tuple, reference):
        """Convert DMS (degrees, minutes, seconds) to decimal degrees"""
        try:
            degrees, minutes, seconds = dms_tuple
            decimal = float(degrees) + float(minutes)/60.0 + float(seconds)/3600.0
            if reference in ['S', 'W']:
                decimal = -decimal
            return decimal
        except (TypeError, ValueError, IndexError):
            return None
    
    try:
        if hasattr(exif_img, 'gps_latitude') and hasattr(exif_img, 'gps_longitude'):
            lat = dms_to_decimal(exif_img.gps_latitude, exif_img.gps_latitude_ref)
            lon = dms_to_decimal(exif_img.gps_longitude, exif_img.gps_longitude_ref)
            return lat, lon
    except Exception:
        pass
    
    return None, None

def extract_datetime_from_exif(exif_img):
    """Extract datetime from EXIF data"""
    if not exif_img:
        return None
    
    datetime_tags = ['datetime_original', 'datetime_digitized', 'datetime']
    
    for tag in datetime_tags:
        if hasattr(exif_img, tag):
            try:
                date_str = getattr(exif_img, tag)
                dt = datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
                return dt.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                continue
    
    return None

def validate_gps_precision(exif_img):
    """Check if GPS data has sufficient precision markers"""
    if not exif_img:
        return False
    
    precision_indicators = [
        'gps_dop',  # Dilution of precision
        'gps_map_datum',  # Map datum
        'gps_processing_method',  # Processing method
        'gps_satellites',  # Number of satellites
    ]
    
    found_indicators = sum(1 for indicator in precision_indicators if hasattr(exif_img, indicator))
    return found_indicators >= 1

def point_in_polygon_check(lat, lon, geojson_path):
    """Check if coordinates are within any polygon in GeoJSON"""
    if not SHAPELY_AVAILABLE:
        return False, {"error": "Shapely not available for geofencing"}
    
    try:
        if not os.path.exists(geojson_path):
            # Create default parcel if file doesn't exist
            default_parcel = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {
                        "parcel_id": "DEFAULT_PARCEL",
                        "owner": "Sample Farmer",
                        "area_hectares": 2.23,  # 5.5 acres = ~2.23 hectares
                        "crop_type": "Rice",
                        "district": "Sample District",
                        "state": "Maharashtra"
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[lon-0.005, lat-0.005], [lon+0.005, lat-0.005], [lon+0.005, lat+0.005], [lon-0.005, lat+0.005], [lon-0.005, lat-0.005]]]
                    }
                }]
            }
            with open(geojson_path, 'w') as f:
                json.dump(default_parcel, f, indent=2)
        
        with open(geojson_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        point = Point(lon, lat)
        
        for feature in geojson_data.get('features', []):
            try:
                geometry = feature.get('geometry', {})
                polygon = geom.shape(geometry)
                
                if polygon.contains(point) or polygon.touches(point):
                    return True, feature.get('properties', {})
            except Exception as e:
                continue
        
        return False, {"error": "Point not in any parcel"}
    
    except Exception as e:
        return False, {"error": f"Geofencing failed: {str(e)}"}

def compute_image_hash(image, hash_size=16):
    """Compute average hash for duplicate detection"""
    if not NUMPY_AVAILABLE:
        return "hash_unavailable_no_numpy"
    
    try:
        # Convert to grayscale and resize
        gray = image.convert('L').resize((hash_size, hash_size), Image.LANCZOS)
        pixels = np.array(gray)
        
        # Calculate average
        avg = pixels.mean()
        
        # Create binary hash
        binary_hash = pixels > avg
        hash_string = ''.join('1' if pixel else '0' for pixel in binary_hash.flatten())
        
        return hash_string
    except Exception:
        return "hash_computation_failed"

def detect_tampering_indicators(image):
    """Detect potential image tampering using various techniques"""
    tampering_score = 0.0
    indicators = {}
    
    try:
        if NUMPY_AVAILABLE:
            # ELA (Error Level Analysis) approximation
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=90)
            buffer.seek(0)
            resaved_image = Image.open(buffer)
            
            # Calculate difference
            diff = ImageChops.difference(image.convert('RGB'), resaved_image.convert('RGB'))
            stat = ImageStat.Stat(diff)
            ela_score = sum(stat.mean) / len(stat.mean)
            indicators['ela_score'] = ela_score
            
            if ela_score > 10:  # Threshold for suspicious ELA
                tampering_score += 0.3
            
            # Shadow inconsistency detection
            gray = ImageOps.grayscale(image)
            pixels = np.array(gray).astype(np.float32) / 255.0
            variance = np.var(pixels)
            indicators['shadow_variance'] = float(variance)
            
            # Low variance might indicate artificial lighting
            if variance < 0.05:
                tampering_score += 0.2
            
            # Check for unusual color distribution
            rgb_image = image.convert('RGB')
            r_stat = ImageStat.Stat(rgb_image.split()[0])
            g_stat = ImageStat.Stat(rgb_image.split()[1])
            b_stat = ImageStat.Stat(rgb_image.split()[2])
            
            color_balance = [r_stat.mean[0], g_stat.mean[0], b_stat.mean[0]]
            indicators['color_balance'] = color_balance
            
            # Check for extreme color bias
            max_color = max(color_balance)
            min_color = min(color_balance)
            if max_color - min_color > 50:  # Significant color bias
                tampering_score += 0.2
    
    except Exception as e:
        indicators['error'] = str(e)
    
    indicators['tampering_score'] = min(1.0, tampering_score)
    return tampering_score > 0.5, indicators

def validate_overlay_consistency(overlay_text, lat, lon, timestamp_ms):
    """Validate that overlay text matches the provided metadata"""
    try:
        # Convert timestamp to expected format
        dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
        expected_date = dt.strftime("%d/%m/%Y")
        expected_day = dt.strftime("%A")
        
        # Format coordinates to 6 decimal places (matching frontend)
        expected_lat = f"{lat:.6f}"
        expected_lon = f"{lon:.6f}"
        
        # Check if all expected elements are in overlay
        checks = {
            'date_match': expected_date in overlay_text,
            'day_match': expected_day in overlay_text,
            'lat_match': expected_lat in overlay_text,
            'lon_match': expected_lon in overlay_text
        }
        
        consistency_score = sum(checks.values()) / len(checks)
        
        return {
            'consistent': consistency_score >= 0.75,  # At least 3 out of 4 must match
            'score': consistency_score,
            'checks': checks,
            'expected': {
                'date': expected_date,
                'day': expected_day,
                'coordinates': f"{expected_lat}, {expected_lon}"
            }
        }
    
    except Exception as e:
        return {
            'consistent': False,
            'error': str(e)
        }

def determine_weather_conditions(daily_data):
    """Determine weather conditions from daily data"""
    precipitation = daily_data.get('prcp', 0) or 0
    temperature = daily_data.get('tavg')
    humidity = daily_data.get('rhum')
    wind_speed = daily_data.get('wspd', 0) or 0
    
    # Enhanced conditions logic
    if precipitation > 25:
        return 'heavy_rain'
    elif precipitation > 10:
        return 'moderate_rain'  
    elif precipitation > 2:
        return 'light_rain'
    elif wind_speed > 20:
        return 'windy'
    elif humidity and humidity > 90:
        return 'very_humid'
    elif humidity and humidity > 75:
        return 'humid'
    elif temperature and temperature > 40:
        return 'extreme_heat'
    elif temperature and temperature > 35:
        return 'hot'
    elif temperature and temperature < 0:
        return 'freezing'
    elif temperature and temperature < 10:
        return 'cold'
    else:
        return 'clear'

def fetch_weather_data(lat, lon, date_iso):
    """Fetch weather data from Meteostat API via RapidAPI"""
    weather_data = {}
    
    if DEBUG_MODE:
        print(f"🌤️ Fetching weather for {lat}, {lon} on {date_iso}", file=sys.stderr)
    
    try:
        # Create HTTPS connection to RapidAPI
        conn = http.client.HTTPSConnection(RAPIDAPI_HOST)
        
        headers = {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': RAPIDAPI_HOST
        }
        
        # Build API endpoint for daily data
        endpoint = f"/point/daily?lat={lat}&lon={lon}&alt={DEFAULT_ALTITUDE}&start={date_iso}&end={date_iso}"
        
        if DEBUG_MODE:
            print(f"🔗 API Endpoint: {endpoint}", file=sys.stderr)
        
        # Make the request
        conn.request("GET", endpoint, headers=headers)
        response = conn.getresponse()
        raw_data = response.read().decode("utf-8")
        
        if DEBUG_MODE:
            print(f"📡 API Response Status: {response.status}", file=sys.stderr)
            print(f"📊 Raw API Data: {raw_data[:300]}...", file=sys.stderr)
        
        if response.status == 200:
            api_data = json.loads(raw_data)
            
            # Parse Meteostat response
            if 'data' in api_data and len(api_data['data']) > 0:
                daily_data = api_data['data'][0]  # First (and only) day
                
                weather_data = {
                    'temperature_avg': daily_data.get('tavg'),
                    'temperature_min': daily_data.get('tmin'),
                    'temperature_max': daily_data.get('tmax'),
                    'precipitation': daily_data.get('prcp', 0),
                    'humidity': daily_data.get('rhum'),
                    'pressure': daily_data.get('pres'),
                    'wind_speed': daily_data.get('wspd'),
                    'wind_direction': daily_data.get('wdir'),
                    'sunshine_duration': daily_data.get('tsun'),
                    'conditions': determine_weather_conditions(daily_data),
                    'source': 'meteostat_rapidapi',
                    'date': date_iso,
                    'coordinates': {'lat': lat, 'lon': lon},
                    'altitude': DEFAULT_ALTITUDE,
                    'raw_data': daily_data,
                    'api_success': True
                }
                
                if DEBUG_MODE:
                    print(f"✅ Weather data processed successfully", file=sys.stderr)
                    
            else:
                # No data available for this date/location
                weather_data = {
                    'error': 'No weather data available',
                    'source': 'meteostat_rapidapi',
                    'date': date_iso,
                    'coordinates': {'lat': lat, 'lon': lon},
                    'message': 'Data might not be available for this date/location',
                    'api_success': False
                }
                
        else:
            # API error
            weather_data = {
                'error': f'API request failed with status {response.status}',
                'source': 'meteostat_rapidapi',
                'details': raw_data[:500],  # First 500 chars of error response
                'date': date_iso,
                'api_success': False
            }
            
        conn.close()
        
    except json.JSONDecodeError as e:
        weather_data = {
            'error': 'Failed to parse weather API response',
            'source': 'meteostat_rapidapi',
            'details': str(e),
            'date': date_iso,
            'api_success': False
        }
        
    except Exception as e:
        weather_data = {
            'error': 'Weather API request failed',
            'source': 'meteostat_rapidapi',
            'details': str(e),
            'date': date_iso,
            'api_success': False
        }
        
        if DEBUG_MODE:
            print(f"❌ Weather API Error: {str(e)}", file=sys.stderr)
    
    return weather_data

def analyze_weather_consistency(weather_data, overlay_text, damage_claim_type=None):
    """Analyze if weather data is consistent with damage claims"""
    inconsistencies = []
    weather_score = 1.0  # Start with perfect score
    
    if 'error' in weather_data or not weather_data.get('api_success'):
        return {
            'inconsistent': False,  # Cannot verify, assume consistent
            'score': 0.5,
            'reason': 'Weather data unavailable',
            'details': weather_data.get('error', 'API failed'),
            'verifiable': False
        }
    
    precipitation = weather_data.get('precipitation', 0) or 0
    conditions = weather_data.get('conditions', 'unknown')
    temperature_avg = weather_data.get('temperature_avg')
    temperature_max = weather_data.get('temperature_max')
    wind_speed = weather_data.get('wind_speed', 0) or 0
    
    # Check for precipitation-related claims
    overlay_lower = overlay_text.lower()
    
    # Flood/Water damage claims
    flood_keywords = ['flood', 'waterlog', 'rain damage', 'water damage', 'inundation']
    if any(word in overlay_lower for word in flood_keywords):
        if precipitation < 5:  # Less than 5mm rain
            inconsistencies.append('Flood/rain damage claimed but no significant precipitation recorded')
            weather_score -= 0.5
        elif precipitation < 10:  # Light rain but flood claimed
            inconsistencies.append('Flood damage claimed but only light precipitation recorded')
            weather_score -= 0.3
            
    # Drought claims
    drought_keywords = ['drought', 'water shortage', 'dry', 'no water']
    if any(word in overlay_lower for word in drought_keywords):
        if precipitation > 15:  # More than 15mm rain
            inconsistencies.append('Drought claimed but significant precipitation recorded')
            weather_score -= 0.6
        elif precipitation > 5:  # Moderate rain
            inconsistencies.append('Drought claimed but moderate precipitation recorded')
            weather_score -= 0.4
            
    # Storm/Wind damage claims
    storm_keywords = ['hail', 'storm', 'cyclone', 'wind damage', 'strong wind']
    if any(word in overlay_lower for word in storm_keywords):
        if wind_speed < 10 and 'heavy_rain' not in conditions:
            inconsistencies.append('Storm/wind damage claimed but no severe weather recorded')
            weather_score -= 0.4
        elif wind_speed < 20 and precipitation < 10:
            inconsistencies.append('Storm damage claimed but weather conditions were mild')
            weather_score -= 0.2
            
    # Temperature-related checks
    if temperature_avg or temperature_max:
        temp_check = temperature_max if temperature_max else temperature_avg
        
        heat_keywords = ['heat', 'scorch', 'sun damage', 'heat wave', 'extreme heat']
        if any(word in overlay_lower for word in heat_keywords):
            if temp_check < 35:
                inconsistencies.append('Heat damage claimed but temperature not extreme')
                weather_score -= 0.3
                
        cold_keywords = ['frost', 'cold', 'freeze', 'winter damage']
        if any(word in overlay_lower for word in cold_keywords):
            if temp_check > 15:
                inconsistencies.append('Cold/frost damage claimed but temperature not low')
                weather_score -= 0.3
    
    # Seasonal consistency checks
    current_date = datetime.fromisoformat(weather_data['date'])
    month = current_date.month
    
    # Monsoon season checks (June-September in India)
    if month in [6, 7, 8, 9]:  # Monsoon months
        if any(word in overlay_lower for word in drought_keywords) and precipitation > 20:
            inconsistencies.append('Drought claimed during monsoon season with heavy rainfall')
            weather_score -= 0.4
    
    # Winter season checks (December-February in India)
    if month in [12, 1, 2]:  # Winter months
        if any(word in overlay_lower for word in heat_keywords):
            inconsistencies.append('Heat damage claimed during winter season')
            weather_score -= 0.3
    
    weather_score = max(0.0, weather_score)  # Don't go below 0
    
    return {
        'inconsistent': len(inconsistencies) > 0,
        'score': weather_score,
        'inconsistencies': inconsistencies,
        'weather_conditions': conditions,
        'precipitation_mm': precipitation,
        'temperature_c': temperature_avg,
        'wind_speed_kmh': wind_speed,
        'analysis_date': weather_data.get('date'),
        'verifiable': True,
        'weather_summary': f"{conditions.replace('_', ' ').title()} - {precipitation}mm rain, {temperature_avg}°C avg"
    }

def assess_crop_damage(image, parcel_properties=None):
    """Assess crop damage percentage from image analysis"""
    try:
        if not NUMPY_AVAILABLE:
            return {
                'damage_percentage': 0.15,  # Default estimate
                'method': 'default_no_numpy',
                'confidence': 0.3
            }
        
        # Convert to different color spaces for analysis
        rgb_image = image.convert('RGB')
        hsv_image = rgb_image.convert('HSV')
        
        # Analyze green content (healthy vegetation)
        rgb_array = np.array(rgb_image)
        
        # Simple vegetation index (more green = healthier)
        green_channel = rgb_array[:, :, 1].astype(np.float32)
        red_channel = rgb_array[:, :, 0].astype(np.float32)
        blue_channel = rgb_array[:, :, 2].astype(np.float32)
        
        # Calculate normalized difference vegetation index (NDVI) approximation
        # NDVI = (NIR - Red) / (NIR + Red), we approximate with Green - Red
        vegetation_index = (green_channel - red_channel) / (green_channel + red_channel + 1e-8)
        
        # Calculate healthy vegetation percentage
        healthy_threshold = 0.1
        healthy_pixels = np.sum(vegetation_index > healthy_threshold)
        total_pixels = vegetation_index.size
        healthy_percentage = healthy_pixels / total_pixels
        
        # Estimate damage (inverse of healthy vegetation)
        damage_percentage = max(0.0, min(1.0, 1.0 - healthy_percentage))
        
        # Adjust based on parcel information if available
        if parcel_properties:
            crop_type = parcel_properties.get('crop_type', '').lower()
            # Different crops have different healthy color profiles
            if crop_type in ['wheat', 'barley', 'oats']:
                damage_percentage *= 0.8  # These crops can look less green when healthy
            elif crop_type in ['rice', 'sugarcane', 'corn']:
                damage_percentage *= 1.1  # These should be very green when healthy
        
        damage_percentage = max(0.0, min(1.0, damage_percentage))
        
        return {
            'damage_percentage': float(damage_percentage),
            'method': 'vegetation_index_analysis',
            'confidence': 0.7,
            'vegetation_health': float(healthy_percentage),
            'analysis_pixels': int(total_pixels)
        }
    
    except Exception as e:
        return {
            'damage_percentage': 0.2,  # Conservative estimate
            'method': 'error_fallback',
            'confidence': 0.3,
            'error': str(e)
        }

def make_claim_decision(analysis_results):
    """Make final decision on claim based on all analysis results"""
    flags = analysis_results.get('phases', {})
    
    risk_level = 'low'
    verification_level = 'auto-approve'
    needs_physical_check = False
    decision_reasons = []
    
    # High-risk conditions that require rejection
    if not flags.get('meta_validation', {}).get('valid', True):
        risk_level = 'high'
        verification_level = 'reject'
        decision_reasons.append('Invalid metadata or EXIF data')
        return {
            'risk': risk_level,
            'verification_level': verification_level,
            'need_physical_check': needs_physical_check,
            'reasons': decision_reasons
        }
    
    if not flags.get('geofencing', {}).get('location_valid', True):
        risk_level = 'high'
        verification_level = 'reject'
        decision_reasons.append('Location outside registered farm boundaries')
        return {
            'risk': risk_level,
            'verification_level': verification_level,
            'need_physical_check': needs_physical_check,
            'reasons': decision_reasons
        }
    
    # Medium-risk conditions
    forensics = flags.get('forensics', {})
    if forensics.get('tampering_detected', False):
        risk_level = 'high'
        verification_level = 'manual-review'
        needs_physical_check = True
        decision_reasons.append('Image tampering detected')
    
    # Weather consistency checks
    weather = flags.get('weather_correlation', {})
    if weather.get('consistency_analysis', {}).get('inconsistent', False):
        if risk_level == 'low':
            risk_level = 'medium'
        verification_level = 'manual-review'
        decision_reasons.append('Weather conditions inconsistent with claimed damage')
    
    # Damage-based decisions
    damage_assessment = flags.get('damage_assessment', {})
    damage_pct = damage_assessment.get('damage_percentage', 0)
    
    if damage_pct >= 0.8:  # Very high damage (80%+)
        if risk_level == 'low':
            verification_level = 'expedite-payout'
        needs_physical_check = True
        decision_reasons.append('High damage percentage requires verification')
    elif damage_pct >= 0.5:  # Significant damage (50%+)
        if risk_level == 'low':
            risk_level = 'medium'
        needs_physical_check = True
        decision_reasons.append('Moderate damage requires field verification')
    elif damage_pct < 0.05:  # Very low damage (less than 5%)
        if verification_level == 'auto-approve':
            verification_level = 'manual-review'
        decision_reasons.append('Low damage claims require manual review')
    
    # Overlay consistency
    overlay_check = forensics.get('overlay_validation', {})
    if not overlay_check.get('consistent', True):
        risk_level = 'medium' if risk_level == 'low' else risk_level
        verification_level = 'manual-review'
        decision_reasons.append('Overlay information inconsistent')
    
    # Final risk adjustment based on multiple factors
    total_risk_factors = len([r for r in decision_reasons if 'high' in r.lower() or 'tamper' in r.lower()])
    if total_risk_factors >= 2:
        risk_level = 'high'
        verification_level = 'manual-review'
        needs_physical_check = True
    
    return {
        'risk': risk_level,
        'verification_level': verification_level,
        'need_physical_check': needs_physical_check,
        'reasons': decision_reasons,
        'damage_threshold': damage_pct,
        'confidence_score': damage_assessment.get('confidence', 0.5)
    }

def main():
    """Main pipeline execution with comprehensive analysis"""
    try:
        # Validate arguments
        if len(sys.argv) < 8:
            safe_print_json({
                "error": "Invalid arguments",
                "expected": "python pipeline.py <image_path> <lat> <lon> <timestamp_ms> <geojson_path> <overlay_text> <parcel_id>",
                "received": sys.argv[1:] if len(sys.argv) > 1 else []
            })
            return
        
        # Parse arguments
        image_path, lat_str, lon_str, timestamp_str, geojson_path, overlay_text, parcel_id = sys.argv[1:8]
        
        try:
            lat = float(lat_str)
            lon = float(lon_str)
            timestamp_ms = int(timestamp_str)
        except ValueError as e:
            safe_print_json({
                "error": "Invalid numeric arguments",
                "details": str(e)
            })
            return
        
        # Check dependencies
        deps_ok, missing_deps = check_dependencies()
        if not deps_ok:
            safe_print_json({
                "error": "Missing required dependencies",
                "missing": missing_deps,
                "note": "Install with: pip install " + " ".join(missing_deps)
            })
            return
        
        # Load and validate image
        try:
            image = Image.open(image_path).convert('RGB')
        except Exception as e:
            safe_print_json({
                "error": "Failed to load image",
                "path": image_path,
                "details": str(e)
            })
            return
        
        # Initialize results structure
        results = {
            "final": {},
            "phases": {},
            "processing_info": {
                "timestamp": int(time.time() * 1000),
                "processing_version": "2.0",
                "input": {
                    "image_path": image_path,
                    "coordinates": {"lat": lat, "lon": lon},
                    "timestamp_ms": timestamp_ms,
                    "parcel_id": parcel_id,
                    "overlay_text": overlay_text
                }
            }
        }
        
        # Phase 1: Metadata Validation
        if DEBUG_MODE:
            print("🔍 Phase 1: Metadata Validation", file=sys.stderr)
            
        exif_img, exif_error = read_exif_data(image_path)
        exif_lat, exif_lon = extract_gps_coordinates(exif_img)
        exif_datetime = extract_datetime_from_exif(exif_img)
        gps_precision_ok = validate_gps_precision(exif_img)
        
        # Validate coordinates match (within 100m ~ 0.001 degrees)
        coords_match = False
        if exif_lat is not None and exif_lon is not None:
            coords_match = (abs(exif_lat - lat) < 0.001 and abs(exif_lon - lon) < 0.001)
        
        # Validate timestamp (within 24 hours)
        time_match = False
        if exif_datetime:
            current_time = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
            time_diff = abs((current_time - exif_datetime).total_seconds())
            time_match = time_diff < 24 * 3600  # 24 hours
        
        meta_valid = bool(exif_img and coords_match and time_match and gps_precision_ok)
        
        results["phases"]["meta_validation"] = {
            "valid": meta_valid,
            "exif_available": bool(exif_img),
            "coordinates_match": coords_match,
            "timestamp_match": time_match,
            "gps_precision_ok": gps_precision_ok,
            "exif_coordinates": {"lat": exif_lat, "lon": exif_lon} if exif_lat else None,
            "exif_datetime": exif_datetime.isoformat() if exif_datetime else None
        }
        
        # Phase 2: Geofencing
        if DEBUG_MODE:
            print("🗺️ Phase 2: Geofencing", file=sys.stderr)
            
        location_valid, parcel_props = point_in_polygon_check(lat, lon, geojson_path)
        
        results["phases"]["geofencing"] = {
            "location_valid": location_valid,
            "parcel_properties": parcel_props,
            "coordinates_checked": {"lat": lat, "lon": lon}
        }
        
        # Phase 3: Forensics Analysis
        if DEBUG_MODE:
            print("🔬 Phase 3: Forensics Analysis", file=sys.stderr)
            
        image_hash = compute_image_hash(image)
        tampering_detected, tampering_indicators = detect_tampering_indicators(image)
        overlay_validation = validate_overlay_consistency(overlay_text, lat, lon, timestamp_ms)
        
        results["phases"]["forensics"] = {
            "tampering_detected": tampering_detected,
            "tampering_indicators": tampering_indicators,
            "image_hash": image_hash,
            "overlay_validation": overlay_validation
        }
        
        # Phase 4: Enhanced Weather Correlation
        if DEBUG_MODE:
            print("🌤️ Phase 4: Weather Correlation", file=sys.stderr)
            
        date_iso = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        weather_data = fetch_weather_data(lat, lon, date_iso)
        weather_consistency = analyze_weather_consistency(weather_data, overlay_text, parcel_id)
        
        results["phases"]["weather_correlation"] = {
            "weather_data": weather_data,
            "consistency_analysis": weather_consistency,
            "analysis_date": date_iso
        }
        
        # Phase 5: Damage Assessment
        if DEBUG_MODE:
            print("🌾 Phase 5: Damage Assessment", file=sys.stderr)
            
        damage_analysis = assess_crop_damage(image, parcel_props)
        
        results["phases"]["damage_assessment"] = damage_analysis
        
        # Final Decision
        if DEBUG_MODE:
            print("⚖️ Making final claim decision", file=sys.stderr)
            
        final_decision = make_claim_decision(results)
        results["final"] = final_decision
        
        # Processing summary
        results["processing_info"]["summary"] = {
            "phases_completed": len(results["phases"]),
            "processing_time_ms": int(time.time() * 1000) - results["processing_info"]["timestamp"],
            "weather_api_success": weather_data.get('api_success', False),
            "all_validations_passed": all([
                results["phases"]["meta_validation"]["valid"],
                results["phases"]["geofencing"]["location_valid"],
                not results["phases"]["forensics"]["tampering_detected"],
                not results["phases"]["weather_correlation"]["consistency_analysis"]["inconsistent"]
            ])
        }
        
        # Output results
        safe_print_json(results)
        
    except Exception as e:
        error_output = {
            "error": "Pipeline execution failed",
            "details": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": int(time.time() * 1000)
        }
        safe_print_json(error_output)

if __name__ == "__main__":
    main()
