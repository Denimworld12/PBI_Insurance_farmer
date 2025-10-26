#!/usr/bin/env python3
# Enhanced pipeline - Real data extraction with multiple fallbacks and improved analysis
import sys
import json
import time
import http.client
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
import os

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Try to import required libraries with better error handling
try:
    from PIL import Image, ExifTags
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Warning: PIL/Pillow not available - basic EXIF extraction disabled", file=sys.stderr)

try:
    from exif import Image as ExifImage
    EXIF_AVAILABLE = True
except ImportError:
    EXIF_AVAILABLE = False
    print("Warning: exif library not available - GPS extraction limited", file=sys.stderr)

try:
    import shapely.geometry as geom
    from shapely import Point, Polygon
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False
    print("Warning: Shapely not available - geofencing disabled", file=sys.stderr)

try:
    import exifread
    EXIFREAD_AVAILABLE = True
except ImportError:
    EXIFREAD_AVAILABLE = False
    print("Warning: exifread not available - fallback EXIF extraction disabled", file=sys.stderr)

# API Configuration
RAPIDAPI_KEY = os.getenv('RAPIDAPI_KEY', 'd2abc61cabmshbfccea6298fb9cfp12cf84jsncbf194b10aba')
RAPIDAPI_HOST = os.getenv('RAPIDAPI_HOST', 'meteostat.p.rapidapi.com')
DEBUG_MODE = os.getenv('DEBUG_MODE', 'true').lower() == 'true'

def safe_print_json(obj):
    """Print JSON safely for Node.js"""
    print(json.dumps(obj, indent=None, separators=(',', ':')))
    sys.stdout.flush()

def dms_to_decimal(dms_tuple, reference):
    """Convert DMS to decimal degrees"""
    try:
        degrees, minutes, seconds = dms_tuple
        decimal = float(degrees) + float(minutes)/60.0 + float(seconds)/3600.0
        if reference in ['S', 'W']:
            decimal = -decimal
        return decimal
    except Exception as e:
        if DEBUG_MODE:
            print(f"DMS conversion error: {e}", file=sys.stderr)
        return None

def extract_comprehensive_exif(image_path):
    """Extract all available EXIF data using multiple methods with enhanced error handling"""
    exif_data = {}
    extraction_log = []
    
    if not os.path.exists(image_path):
        return {}, {"error": f"Image file not found: {image_path}"}
    
    file_size = os.path.getsize(image_path)
    extraction_log.append(f"Processing file: {image_path} ({file_size:,} bytes)")
    
    # Method 1: PIL/Pillow (most reliable for basic EXIF)
    if PIL_AVAILABLE:
        try:
            extraction_log.append("🔍 Trying PIL/Pillow extraction...")
            
            with Image.open(image_path) as img:
                # Get basic image info
                exif_data['Image_Info'] = {
                    'format': img.format,
                    'mode': img.mode,
                    'size': list(img.size),  # Convert tuple to list for JSON
                    'has_transparency': img.mode in ('RGBA', 'LA') or 'transparency' in img.info
                }
                
                # Try to get EXIF dictionary
                exif_dict = img._getexif()
                if exif_dict:
                    extraction_log.append(f"✅ PIL found {len(exif_dict)} EXIF tags")
                    for tag_id, value in exif_dict.items():
                        tag = ExifTags.TAGS.get(tag_id, f"Tag_{tag_id}")
                        try:
                            # Handle different value types more robustly
                            if isinstance(value, bytes):
                                try:
                                    exif_data[f'PIL_{tag}'] = value.decode('utf-8')
                                except UnicodeDecodeError:
                                    exif_data[f'PIL_{tag}'] = value.decode('utf-8', errors='replace')
                            elif isinstance(value, (tuple, list)):
                                # Handle GPS and other tuple data
                                if len(value) > 10:  # Truncate very long tuples
                                    exif_data[f'PIL_{tag}'] = f"{str(value[:10])}... (truncated)"
                                else:
                                    exif_data[f'PIL_{tag}'] = str(value)
                            else:
                                exif_data[f'PIL_{tag}'] = str(value)
                        except Exception as e:
                            exif_data[f'PIL_{tag}_ERROR'] = f"Processing error: {str(e)[:100]}"
                else:
                    extraction_log.append("⚠️ PIL found no EXIF data")
                    
        except Exception as e:
            extraction_log.append(f"❌ PIL extraction failed: {str(e)}")
    else:
        extraction_log.append("❌ PIL/Pillow not available")
    
    # Method 2: exif library (specialized for GPS data)
    if EXIF_AVAILABLE:
        try:
            extraction_log.append("🔍 Trying exif library extraction...")
            
            with open(image_path, "rb") as f:
                exif_img = ExifImage(f)
            
            if exif_img.has_exif:
                extraction_log.append("✅ exif library found EXIF data")
                
                # Get all available attributes
                extracted_attrs = 0
                for attr in dir(exif_img):
                    if not attr.startswith('_') and not callable(getattr(exif_img, attr, None)):
                        try:
                            value = getattr(exif_img, attr)
                            if value is not None and value != '':
                                exif_data[f'EXIF_{attr}'] = str(value)
                                extracted_attrs += 1
                        except Exception as e:
                            if DEBUG_MODE:
                                exif_data[f'EXIF_{attr}_ERROR'] = str(e)[:50]
                
                extraction_log.append(f"✅ Extracted {extracted_attrs} EXIF attributes")
                
                # Specifically try to extract GPS coordinates
                try:
                    if hasattr(exif_img, 'gps_latitude') and hasattr(exif_img, 'gps_longitude'):
                        lat_ref = getattr(exif_img, 'gps_latitude_ref', 'N')
                        lon_ref = getattr(exif_img, 'gps_longitude_ref', 'E')
                        
                        lat = dms_to_decimal(exif_img.gps_latitude, lat_ref)
                        lon = dms_to_decimal(exif_img.gps_longitude, lon_ref)
                        
                        if lat is not None and lon is not None:
                            exif_data['GPS_Latitude_Decimal'] = lat
                            exif_data['GPS_Longitude_Decimal'] = lon
                            exif_data['GPS_Latitude_Ref'] = lat_ref
                            exif_data['GPS_Longitude_Ref'] = lon_ref
                            exif_data['GPS_Source'] = 'exif_library'
                            extraction_log.append(f"🌍 GPS coordinates extracted: {lat:.6f}, {lon:.6f}")
                            
                            # Also try to get GPS precision data
                            try:
                                if hasattr(exif_img, 'gps_dop'):
                                    exif_data['GPS_DOP'] = str(exif_img.gps_dop)
                                if hasattr(exif_img, 'gps_satellites'):
                                    exif_data['GPS_Satellites'] = str(exif_img.gps_satellites)
                            except:
                                pass
                except Exception as e:
                    extraction_log.append(f"❌ GPS extraction from exif failed: {str(e)}")
            else:
                extraction_log.append("⚠️ exif library found no EXIF data")
                
        except Exception as e:
            extraction_log.append(f"❌ exif library extraction failed: {str(e)}")
    else:
        extraction_log.append("❌ exif library not available")
    
    # Method 3: exifread library (comprehensive fallback)
    if EXIFREAD_AVAILABLE:
        try:
            extraction_log.append("🔍 Trying exifread library...")
            
            with open(image_path, 'rb') as f:
                tags = exifread.process_file(f, details=True)
                
            if tags:
                extraction_log.append(f"✅ exifread found {len(tags)} tags")
                for key, value in tags.items():
                    try:
                        # Filter out some very verbose tags
                        if not any(skip in str(key) for skip in ['Thumbnail', 'EXIF MakerNote', 'JPEGThumbnail']):
                            exif_data[f'EXIFREAD_{str(key).replace(" ", "_")}'] = str(value)
                    except:
                        pass
                
                # Try to extract GPS from exifread format
                try:
                    if 'GPS GPSLatitude' in tags and 'GPS GPSLongitude' in tags:
                        lat_tag = str(tags['GPS GPSLatitude'])
                        lon_tag = str(tags['GPS GPSLongitude'])
                        lat_ref = str(tags.get('GPS GPSLatitudeRef', 'N'))
                        lon_ref = str(tags.get('GPS GPSLongitudeRef', 'E'))
                        
                        # Parse exifread GPS format [deg, min, sec]
                        lat_parts = lat_tag.replace('[', '').replace(']', '').split(', ')
                        lon_parts = lon_tag.replace('[', '').replace(']', '').split(', ')
                        
                        if len(lat_parts) >= 3 and len(lon_parts) >= 3:
                            lat = float(lat_parts[0]) + float(lat_parts[1])/60.0 + float(lat_parts[2])/3600.0
                            lon = float(lon_parts[0]) + float(lon_parts[1])/60.0 + float(lon_parts[2])/3600.0
                            
                            if lat_ref.upper() == 'S':
                                lat = -lat
                            if lon_ref.upper() == 'W':
                                lon = -lon
                                
                            # Only use if we haven't already found GPS coordinates
                            if not exif_data.get('GPS_Latitude_Decimal'):
                                exif_data['GPS_Latitude_Decimal'] = lat
                                exif_data['GPS_Longitude_Decimal'] = lon
                                exif_data['GPS_Source'] = 'exifread_library'
                                extraction_log.append(f"🌍 GPS coordinates from exifread: {lat:.6f}, {lon:.6f}")
                except Exception as e:
                    extraction_log.append(f"❌ exifread GPS extraction failed: {str(e)}")
            else:
                extraction_log.append("⚠️ exifread found no tags")
                
        except Exception as e:
            extraction_log.append(f"❌ exifread extraction failed: {str(e)}")
    else:
        extraction_log.append("❌ exifread library not available")
    
    # Log summary if debugging
    if DEBUG_MODE:
        for log_entry in extraction_log:
            print(f"EXIF: {log_entry}", file=sys.stderr)
    
    # Create backward compatibility mappings
    if exif_data.get('GPS_Latitude_Decimal'):
        exif_data['GPS_Latitude'] = exif_data['GPS_Latitude_Decimal']
        exif_data['GPS_Longitude'] = exif_data['GPS_Longitude_Decimal']
    
    return exif_data, {
        'extraction_log': extraction_log,
        'total_fields_extracted': len(exif_data),
        'gps_found': bool(exif_data.get('GPS_Latitude_Decimal')),
        'file_size_bytes': file_size
    }

def fetch_weather_data_openmeteo(lat, lon, date_iso):
    """Fetch weather data from Open-Meteo (free, no API key required)"""
    try:
        if DEBUG_MODE:
            print(f"🌤️ Fetching weather from Open-Meteo for {lat}, {lon} on {date_iso}", file=sys.stderr)
        
        # Build Open-Meteo API URL
        base_url = "https://api.open-meteo.com/v1/forecast"
        params = {
            'latitude': lat,
            'longitude': lon,
            'start_date': date_iso,
            'end_date': date_iso,
            'daily': 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,surface_pressure_mean,wind_speed_10m_max,wind_direction_10m_dominant',
            'timezone': 'auto'
        }
        
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        
        with urllib.request.urlopen(url, timeout=10) as response:
            if response.getcode() == 200:
                raw_data = response.read().decode('utf-8')
                api_data = json.loads(raw_data)
                
                if 'daily' in api_data and api_data['daily']:
                    daily = api_data['daily']
                    
                    weather_result = {
                        'api_success': True,
                        'source': 'open_meteo_free',
                        'date_requested': date_iso,
                        'coordinates': {'lat': lat, 'lon': lon},
                        'raw_api_response': api_data,
                        'processed_data': {
                            'temperature_avg': daily.get('temperature_2m_mean', [None])[0],
                            'temperature_min': daily.get('temperature_2m_min', [None])[0],
                            'temperature_max': daily.get('temperature_2m_max', [None])[0],
                            'precipitation_mm': daily.get('precipitation_sum', [None])[0] or 0,
                            'humidity_percent': daily.get('relative_humidity_2m_mean', [None])[0],
                            'pressure_mb': daily.get('surface_pressure_mean', [None])[0],
                            'wind_speed_kmh': daily.get('wind_speed_10m_max', [None])[0],
                            'wind_direction': daily.get('wind_direction_10m_dominant', [None])[0]
                        },
                        'meta_info': {
                            'timezone': api_data.get('timezone'),
                            'elevation': api_data.get('elevation'),
                            'api_source': 'Open-Meteo (Free)',
                            'data_models': 'Multiple global weather models'
                        },
                        'stations_used': ['open_meteo_ensemble']
                    }
                    
                    if DEBUG_MODE:
                        print(f"✅ Open-Meteo weather data retrieved successfully", file=sys.stderr)
                    
                    return weather_result
                else:
                    return {
                        'api_success': False,
                        'error': 'No weather data available for this location/date from Open-Meteo',
                        'date_requested': date_iso,
                        'coordinates': {'lat': lat, 'lon': lon}
                    }
            else:
                return {
                    'api_success': False,
                    'error': f'Open-Meteo API returned status {response.getcode()}'
                }
                
    except Exception as e:
        if DEBUG_MODE:
            print(f"❌ Open-Meteo API error: {str(e)}", file=sys.stderr)
        return {
            'api_success': False,
            'error': f'Open-Meteo error: {str(e)}',
            'date_requested': date_iso,
            'source_attempted': 'open_meteo_free'
        }

def fetch_weather_data_meteostat(lat, lon, date_iso):
    """Fetch weather data from Meteostat via RapidAPI (fallback)"""
    try:
        if DEBUG_MODE:
            print(f"🌤️ Trying Meteostat via RapidAPI for {lat}, {lon} on {date_iso}", file=sys.stderr)
        
        conn = http.client.HTTPSConnection(RAPIDAPI_HOST)
        headers = {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': RAPIDAPI_HOST
        }
        
        endpoint = f"/point/daily?lat={lat}&lon={lon}&alt=100&start={date_iso}&end={date_iso}"
        conn.request("GET", endpoint, headers=headers)
        response = conn.getresponse()
        raw_data = response.read().decode("utf-8")
        
        if response.status == 200:
            api_data = json.loads(raw_data)
            
            if 'data' in api_data and len(api_data['data']) > 0:
                daily_data = api_data['data'][0]
                weather_result = {
                    'api_success': True,
                    'source': 'meteostat_rapidapi',
                    'date_requested': date_iso,
                    'coordinates': {'lat': lat, 'lon': lon},
                    'raw_api_response': daily_data,
                    'processed_data': {
                        'temperature_avg': daily_data.get('tavg'),
                        'temperature_min': daily_data.get('tmin'),
                        'temperature_max': daily_data.get('tmax'),
                        'precipitation_mm': daily_data.get('prcp'),
                        'humidity_percent': daily_data.get('rhum'),
                        'pressure_mb': daily_data.get('pres'),
                        'wind_speed_kmh': daily_data.get('wspd'),
                        'wind_direction': daily_data.get('wdir'),
                        'sunshine_hours': daily_data.get('tsun')
                    },
                    'meta_info': api_data.get('meta', {}),
                    'stations_used': api_data.get('meta', {}).get('stations', [])
                }
                
                if DEBUG_MODE:
                    stations_count = len(api_data.get('meta', {}).get('stations', []))
                    print(f"✅ Meteostat data retrieved: {stations_count} stations", file=sys.stderr)
                
                return weather_result
            else:
                return {
                    'api_success': False,
                    'error': 'No weather data available from Meteostat',
                    'date_requested': date_iso,
                    'coordinates': {'lat': lat, 'lon': lon}
                }
        else:
            return {
                'api_success': False,
                'error': f'Meteostat API returned status {response.status}',
                'response_body': raw_data[:200]
            }
            
    except Exception as e:
        if DEBUG_MODE:
            print(f"❌ Meteostat API error: {str(e)}", file=sys.stderr)
        return {
            'api_success': False,
            'error': f'Meteostat error: {str(e)}',
            'date_requested': date_iso
        }

def fetch_real_weather_data(lat, lon, date_iso):
    """Fetch weather data with multiple API fallbacks"""
    # Try Open-Meteo first (free, reliable)
    weather_data = fetch_weather_data_openmeteo(lat, lon, date_iso)
    
    if weather_data.get('api_success'):
        return weather_data
    
    if DEBUG_MODE:
        print("🔄 Open-Meteo failed, trying Meteostat...", file=sys.stderr)
    
    # Fallback to Meteostat if Open-Meteo fails
    weather_data_fallback = fetch_weather_data_meteostat(lat, lon, date_iso)
    
    if weather_data_fallback.get('api_success'):
        return weather_data_fallback
    
    # If both fail, return combined error info
    return {
        'api_success': False,
        'error': 'All weather APIs failed',
        'attempted_sources': ['open_meteo', 'meteostat_rapidapi'],
        'open_meteo_error': weather_data.get('error'),
        'meteostat_error': weather_data_fallback.get('error'),
        'date_requested': date_iso,
        'coordinates': {'lat': lat, 'lon': lon}
    }

def analyze_coordinate_consistency(exif_coords, claimed_coords):
    """Compare EXIF coordinates with claimed coordinates with enhanced analysis"""
    if not exif_coords.get('GPS_Latitude') or not exif_coords.get('GPS_Longitude'):
        return {
            'coordinates_available': False,
            'error': 'No GPS coordinates found in EXIF data - likely browser-captured image',
            'analysis_note': 'Browser canvas.toBlob() strips EXIF GPS data automatically'
        }
    
    try:
        exif_lat = float(exif_coords['GPS_Latitude'])
        exif_lon = float(exif_coords['GPS_Longitude'])
        claimed_lat = float(claimed_coords['lat'])
        claimed_lon = float(claimed_coords['lon'])
        
        # Calculate distance using Haversine approximation
        import math
        
        # Convert to radians
        lat1, lon1 = math.radians(exif_lat), math.radians(exif_lon)
        lat2, lon2 = math.radians(claimed_lat), math.radians(claimed_lon)
        
        # Haversine formula for more accurate distance
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        distance_meters = 6371000 * c  # Earth radius in meters
        
        # Define tolerance levels
        tolerance_levels = {
            'exact_match': 10,      # 10 meters
            'close_match': 50,      # 50 meters
            'approximate_match': 200,  # 200 meters
            'distant_match': 1000   # 1 km
        }
        
        if distance_meters <= tolerance_levels['exact_match']:
            match_level = 'exact_match'
        elif distance_meters <= tolerance_levels['close_match']:
            match_level = 'close_match'
        elif distance_meters <= tolerance_levels['approximate_match']:
            match_level = 'approximate_match'
        elif distance_meters <= tolerance_levels['distant_match']:
            match_level = 'distant_match'
        else:
            match_level = 'no_match'
        
        return {
            'coordinates_available': True,
            'exif_coordinates': {'lat': exif_lat, 'lon': exif_lon},
            'claimed_coordinates': {'lat': claimed_lat, 'lon': claimed_lon},
            'distance_meters': round(distance_meters, 2),
            'distance_km': round(distance_meters / 1000, 3),
            'match_level': match_level,
            'coordinates_match': distance_meters <= tolerance_levels['approximate_match'],
            'tolerance_levels': tolerance_levels,
            'calculation_method': 'haversine_formula',
            'gps_source': exif_coords.get('GPS_Source', 'unknown')
        }
        
    except Exception as e:
        return {
            'coordinates_available': False,
            'error': f'Error analyzing coordinates: {str(e)}',
            'exif_coords_raw': exif_coords,
            'claimed_coords_raw': claimed_coords
        }

def perform_geofencing_analysis(lat, lon, geojson_path):
    """Enhanced geofencing analysis with Shapely"""
    if not SHAPELY_AVAILABLE:
        return {
            'geofencing_available': False,
            'error': 'Shapely library not available for geofencing',
            'recommendation': 'Install shapely: pip install shapely'
        }
    
    try:
        # Ensure geofence data exists
        if not os.path.exists(geojson_path):
            # Create more realistic test boundary
            boundary_size = 0.005  # ~500m radius
            boundary_coords = [
                [lon - boundary_size, lat - boundary_size],     # SW
                [lon + boundary_size, lat - boundary_size],     # SE  
                [lon + boundary_size, lat + boundary_size],     # NE
                [lon - boundary_size, lat + boundary_size],     # NW
                [lon - boundary_size, lat - boundary_size]      # Close polygon
            ]
            
            test_parcel = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {
                        "parcel_id": f"AUTO_GENERATED_{int(time.time())}",
                        "area_hectares": round((boundary_size * 2 * 111000) ** 2 / 10000, 2),
                        "created": datetime.now().isoformat(),
                        "note": "Auto-generated boundary for testing",
                        "center_lat": lat,
                        "center_lon": lon
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [boundary_coords]
                    }
                }]
            }
            
            os.makedirs(os.path.dirname(geojson_path), exist_ok=True)
            with open(geojson_path, 'w') as f:
                json.dump(test_parcel, f, indent=2)
                
            if DEBUG_MODE:
                print(f"🗺️ Created test boundary: {len(boundary_coords)} points", file=sys.stderr)
        
        # Load and analyze geofence data
        with open(geojson_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        test_point = Point(lon, lat)
        result = {
            'geofencing_available': True,
            'test_point': {'lat': lat, 'lon': lon},
            'parcels_checked': [],
            'point_inside_boundary': False,
            'closest_boundary_distance': float('inf'),
            'boundary_analysis': {},
            'geojson_file_info': {
                'path': geojson_path,
                'feature_count': len(geojson_data.get('features', []))
            }
        }
        
        for idx, feature in enumerate(geojson_data.get('features', [])):
            geometry = feature.get('geometry', {})
            properties = feature.get('properties', {})
            
            try:
                polygon = geom.shape(geometry)
                
                # Validate polygon
                if not polygon.is_valid:
                    polygon = polygon.buffer(0)  # Fix invalid geometry
                
                is_inside = polygon.contains(test_point)
                distance_to_boundary = test_point.distance(polygon.boundary) * 111000  # Convert to meters
                
                parcel_result = {
                    'parcel_id': properties.get('parcel_id', f'parcel_{idx}'),
                    'is_inside': is_inside,
                    'distance_to_boundary_meters': round(distance_to_boundary, 2),
                    'parcel_properties': properties,
                    'geometry_info': {
                        'type': geometry.get('type'),
                        'area_calculated': round(polygon.area * (111000 ** 2) / 10000, 4),  # Convert to hectares
                        'perimeter_calculated': round(polygon.length * 111000, 2)  # Convert to meters
                    }
                }
                
                result['parcels_checked'].append(parcel_result)
                
                if is_inside:
                    result['point_inside_boundary'] = True
                    result['matched_parcel'] = parcel_result
                
                # Track closest boundary
                if distance_to_boundary < result['closest_boundary_distance']:
                    result['closest_boundary_distance'] = round(distance_to_boundary, 2)
                    
                if DEBUG_MODE:
                    status = 'INSIDE' if is_inside else 'OUTSIDE'
                    parcel_id = properties.get('parcel_id', f'parcel_{idx}')
                    print(f"🗺️ {parcel_id}: {status} ({distance_to_boundary:.1f}m)", file=sys.stderr)
                
            except Exception as e:
                result['parcels_checked'].append({
                    'parcel_id': properties.get('parcel_id', f'parcel_{idx}'),
                    'error': f'Geometry analysis failed: {str(e)}'
                })
        
        # Generate analysis summary
        successful_checks = [p for p in result['parcels_checked'] if 'error' not in p]
        result['boundary_analysis'] = {
            'total_parcels': len(result['parcels_checked']),
            'successful_checks': len(successful_checks),
            'failed_checks': len(result['parcels_checked']) - len(successful_checks),
            'point_location_status': 'inside_boundary' if result['point_inside_boundary'] else 'outside_boundary',
            'closest_boundary_meters': result['closest_boundary_distance'] if result['closest_boundary_distance'] != float('inf') else None
        }
        
        return result
        
    except Exception as e:
        return {
            'geofencing_available': False,
            'error': f'Geofencing analysis failed: {str(e)}',
            'geojson_path': geojson_path,
            'test_point': {'lat': lat, 'lon': lon}
        }

def calculate_confidence_score(exif_data, coord_analysis, weather_data, geofencing_result):
    """Enhanced confidence scoring with detailed breakdown"""
    confidence_factors = {}
    
    # EXIF Data Quality (30% weight)
    exif_score = 0.0
    exif_details = {
        'device_info_available': False,
        'gps_data_available': False,
        'timestamp_data_available': False,
        'precision_data_available': False
    }
    
    if exif_data:
        # Check for device information
        if any(key for key in exif_data.keys() if any(term in key.lower() for term in ['make', 'model', 'software'])):
            exif_score += 0.3
            exif_details['device_info_available'] = True
        
        # Check for GPS data
        if exif_data.get('GPS_Latitude') and exif_data.get('GPS_Longitude'):
            exif_score += 0.4
            exif_details['gps_data_available'] = True
        
        # Check for timestamp data
        if any(key for key in exif_data.keys() if 'datetime' in key.lower()):
            exif_score += 0.2
            exif_details['timestamp_data_available'] = True
        
        # Check for GPS precision indicators
        if any(key in exif_data for key in ['GPS_DOP', 'GPS_Satellites']):
            exif_score += 0.1
            exif_details['precision_data_available'] = True
    
    confidence_factors['exif_data_quality'] = {
        'score': min(1.0, exif_score),
        'details': exif_details,
        'weight': 0.30
    }
    
    # Coordinate Consistency (25% weight)
    coord_score = 0.0
    coord_details = {'status': 'no_gps_data'}
    
    if coord_analysis.get('coordinates_available'):
        match_level = coord_analysis.get('match_level', 'no_match')
        if match_level == 'exact_match':
            coord_score = 1.0
            coord_details = {'status': 'exact_match', 'distance_m': coord_analysis.get('distance_meters')}
        elif match_level == 'close_match':
            coord_score = 0.8
            coord_details = {'status': 'close_match', 'distance_m': coord_analysis.get('distance_meters')}
        elif match_level == 'approximate_match':
            coord_score = 0.6
            coord_details = {'status': 'approximate_match', 'distance_m': coord_analysis.get('distance_meters')}
        elif match_level == 'distant_match':
            coord_score = 0.3
            coord_details = {'status': 'distant_match', 'distance_m': coord_analysis.get('distance_meters')}
        else:
            coord_score = 0.1
            coord_details = {'status': 'no_match', 'distance_m': coord_analysis.get('distance_meters')}
    
    confidence_factors['coordinate_consistency'] = {
        'score': coord_score,
        'details': coord_details,
        'weight': 0.25
    }
    
    # Weather Data Quality (20% weight)
    weather_score = 0.0
    weather_details = {'status': 'failed'}
    
    if weather_data.get('api_success'):
        weather_score = 0.9
        weather_details = {
            'status': 'success',
            'source': weather_data.get('source'),
            'stations': len(weather_data.get('stations_used', [])),
            'data_completeness': sum(1 for v in weather_data.get('processed_data', {}).values() if v is not None) / max(len(weather_data.get('processed_data', {})), 1)
        }
    else:
        weather_details = {
            'status': 'failed',
            'error': weather_data.get('error', 'Unknown error')
        }
    
    confidence_factors['weather_data_quality'] = {
        'score': weather_score,
        'details': weather_details,
        'weight': 0.20
    }
    
    # Geofencing Analysis (25% weight)
    geo_score = 0.0
    geo_details = {'status': 'unavailable'}
    
    if geofencing_result.get('geofencing_available'):
        if geofencing_result.get('point_inside_boundary'):
            geo_score = 1.0
            geo_details = {'status': 'inside_boundary', 'parcels_checked': len(geofencing_result.get('parcels_checked', []))}
        elif geofencing_result.get('parcels_checked'):
            # Partial credit based on proximity
            closest_distance = geofencing_result.get('closest_boundary_distance', float('inf'))
            if closest_distance <= 50:  # Within 50m
                geo_score = 0.7
                geo_details = {'status': 'near_boundary', 'distance_m': closest_distance}
            elif closest_distance <= 200:  # Within 200m
                geo_score = 0.5
                geo_details = {'status': 'close_to_boundary', 'distance_m': closest_distance}
            else:
                geo_score = 0.3
                geo_details = {'status': 'outside_boundary', 'distance_m': closest_distance}
        else:
            geo_score = 0.2
            geo_details = {'status': 'no_boundaries_found'}
    else:
        geo_details = {'status': 'unavailable', 'error': geofencing_result.get('error')}
    
    confidence_factors['geofencing_reliability'] = {
        'score': geo_score,
        'details': geo_details,
        'weight': 0.25
    }
    
    # Calculate weighted overall confidence
    weights = {
        'exif_data_quality': 0.30,
        'coordinate_consistency': 0.25,
        'weather_data_quality': 0.20,
        'geofencing_reliability': 0.25
    }
    
    overall_confidence = sum(
        confidence_factors[factor]['score'] * weights[factor] 
        for factor in weights.keys()
    )
    
    return {
        'overall_confidence': round(overall_confidence, 3),
        'confidence_breakdown': confidence_factors,
        'weights_used': weights,
        'recommendation': get_recommendation(overall_confidence),
        'analysis_summary': {
            'strongest_factor': max(confidence_factors.keys(), key=lambda k: confidence_factors[k]['score']),
            'weakest_factor': min(confidence_factors.keys(), key=lambda k: confidence_factors[k]['score']),
            'total_factors_analyzed': len(confidence_factors)
        }
    }

def get_recommendation(confidence_score):
    """Enhanced recommendation system"""
    if confidence_score >= 0.8:
        return {
            'status': 'approve',
            'reason': f'High confidence ({confidence_score:.1%}) - All verification checks passed',
            'action': 'Process claim automatically',
            'priority': 'high',
            'estimated_processing_time': '< 1 hour'
        }
    elif confidence_score >= 0.6:
        return {
            'status': 'manual_review',
            'reason': f'Moderate confidence ({confidence_score:.1%}) - Human verification recommended',
            'action': 'Schedule manual review within 24 hours',
            'priority': 'medium',
            'estimated_processing_time': '1-2 days'
        }
    elif confidence_score >= 0.4:
        return {
            'status': 'additional_evidence',
            'reason': f'Low confidence ({confidence_score:.1%}) - Insufficient verification data',
            'action': 'Request additional documentation from claimant',
            'priority': 'low',
            'estimated_processing_time': '3-5 days'
        }
    else:
        return {
            'status': 'reject',
            'reason': f'Very low confidence ({confidence_score:.1%}) - Multiple verification failures',
            'action': 'Reject claim and initiate fraud investigation',
            'priority': 'urgent',
            'estimated_processing_time': 'immediate'
        }

def main():
    """Enhanced main processing pipeline"""
    start_time = time.time()
    
    try:
        if len(sys.argv) < 8:
            safe_print_json({
                "error": "Insufficient arguments",
                "required": ["image_path", "lat", "lon", "timestamp_ms", "geojson_path", "overlay_text", "parcel_id"],
                "provided": len(sys.argv) - 1
            })
            return
        
        image_path, lat_str, lon_str, timestamp_str, geojson_path, overlay_text, parcel_id = sys.argv[1:8]
        
        # Validate and parse input parameters
        try:
            lat = float(lat_str)
            lon = float(lon_str)
            timestamp_ms = int(timestamp_str)
            
            # Validate coordinate ranges
            if not (-90 <= lat <= 90):
                raise ValueError(f"Invalid latitude: {lat} (must be between -90 and 90)")
            if not (-180 <= lon <= 180):
                raise ValueError(f"Invalid longitude: {lon} (must be between -180 and 180)")
                
        except ValueError as e:
            safe_print_json({
                "error": "Invalid input parameters",
                "details": str(e),
                "provided_args": {
                    "lat": lat_str,
                    "lon": lon_str,
                    "timestamp": timestamp_str
                }
            })
            return
        
        if DEBUG_MODE:
            print(f"🔍 Starting enhanced analysis for {os.path.basename(image_path)}", file=sys.stderr)
            print(f"📍 Location: {lat:.6f}, {lon:.6f}", file=sys.stderr)
            print(f"⏰ Timestamp: {datetime.fromtimestamp(timestamp_ms/1000).isoformat()}", file=sys.stderr)
        
        # Phase 1: EXIF Data Extraction
        if DEBUG_MODE:
            print("📱 Phase 1: EXIF data extraction...", file=sys.stderr)
        exif_data, exif_error = extract_comprehensive_exif(image_path)
        
        # Phase 2: Coordinate Analysis
        if DEBUG_MODE:
            print("📍 Phase 2: Coordinate consistency analysis...", file=sys.stderr)
        coord_analysis = analyze_coordinate_consistency(exif_data, {'lat': lat, 'lon': lon})
        
        # Phase 3: Weather Data Retrieval
        if DEBUG_MODE:
            print("🌤️ Phase 3: Weather data retrieval...", file=sys.stderr)
        date_iso = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        weather_data = fetch_real_weather_data(lat, lon, date_iso)
        
        # Phase 4: Geofencing Analysis
        if DEBUG_MODE:
            print("🗺️ Phase 4: Geofencing analysis...", file=sys.stderr)
        geofencing_result = perform_geofencing_analysis(lat, lon, geojson_path)
        
        # Phase 5: Confidence Assessment
        if DEBUG_MODE:
            print("📊 Phase 5: Confidence assessment...", file=sys.stderr)
        confidence_analysis = calculate_confidence_score(exif_data, coord_analysis, weather_data, geofencing_result)
        
        processing_time = (time.time() - start_time) * 1000
        
        # Compile comprehensive result
        result = {
            'processing_info': {
                'timestamp': int(time.time() * 1000),
                'processing_time_ms': round(processing_time, 2),
                'version': '3.2-comprehensive-analysis',
                'libraries_status': {
                    'PIL': PIL_AVAILABLE,
                    'EXIF': EXIF_AVAILABLE,
                    'ExifRead': EXIFREAD_AVAILABLE,
                    'Shapely': SHAPELY_AVAILABLE
                },
                'analysis_phases_completed': 5
            },
            'input_data': {
                'image_path': image_path,
                'image_filename': os.path.basename(image_path),
                'claimed_coordinates': {'lat': lat, 'lon': lon},
                'timestamp_ms': timestamp_ms,
                'timestamp_iso': datetime.fromtimestamp(timestamp_ms/1000).isoformat(),
                'overlay_text': overlay_text,
                'parcel_id': parcel_id,
                'analysis_date': date_iso
            },
            'extracted_exif_data': {
                'available': bool(exif_data),
                'total_fields': len(exif_data),
                'gps_data_found': bool(exif_data.get('GPS_Latitude')),
                'raw_exif': exif_data,
                'extraction_details': exif_error
            },
            'coordinate_analysis': coord_analysis,
            'weather_verification': weather_data,
            'geofencing_analysis': geofencing_result,
            'confidence_assessment': confidence_analysis,
            'final_recommendation': confidence_analysis['recommendation']
        }
        
        if DEBUG_MODE:
            confidence_pct = confidence_analysis['overall_confidence'] * 100
            recommendation = confidence_analysis['recommendation']['status']
            print(f"✅ Analysis complete: {confidence_pct:.1f}% confidence → {recommendation.upper()}", file=sys.stderr)
        
        safe_print_json(result)
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        error_result = {
            "error": "Pipeline execution failed",
            "details": str(e),
            "error_type": type(e).__name__,
            "processing_time_ms": round(processing_time, 2),
            "timestamp": int(time.time() * 1000),
            "input_args_count": len(sys.argv) - 1
        }
        
        if DEBUG_MODE:
            print(f"❌ Pipeline error: {str(e)}", file=sys.stderr)
            import traceback
            print(traceback.format_exc(), file=sys.stderr)
        
        safe_print_json(error_result)

if __name__ == "__main__":
    main()
