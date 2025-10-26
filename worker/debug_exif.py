#!/usr/bin/env python3
import sys
import json
import os
from pathlib import Path

def debug_image_exif(image_path):
    """Debug EXIF extraction with multiple methods"""
    results = {
        'file_info': {
            'path': image_path,
            'exists': Path(image_path).exists(),
            'size_bytes': Path(image_path).stat().st_size if Path(image_path).exists() else 0
        },
        'methods': {}
    }
    
    # Method 1: PIL/Pillow
    try:
        from PIL import Image, ExifTags
        with Image.open(image_path) as img:
            exif_dict = img._getexif()
            if exif_dict:
                exif_readable = {}
                for tag_id, value in exif_dict.items():
                    tag = ExifTags.TAGS.get(tag_id, tag_id)
                    exif_readable[tag] = str(value)
                results['methods']['PIL'] = {
                    'success': True,
                    'tags_found': len(exif_readable),
                    'data': exif_readable
                }
            else:
                results['methods']['PIL'] = {'success': False, 'error': 'No EXIF data found'}
    except Exception as e:
        results['methods']['PIL'] = {'success': False, 'error': str(e)}
    
    # Method 2: exif library
    try:
        from exif import Image as ExifImage
        with open(image_path, "rb") as f:
            exif_img = ExifImage(f)
            
        if exif_img.has_exif:
            exif_data = {}
            for attr in dir(exif_img):
                if not attr.startswith('_') and hasattr(exif_img, attr):
                    try:
                        value = getattr(exif_img, attr)
                        if not callable(value):
                            exif_data[attr] = str(value)
                    except:
                        pass
            
            results['methods']['exif_lib'] = {
                'success': True,
                'has_exif': True,
                'tags_found': len(exif_data),
                'data': exif_data
            }
        else:
            results['methods']['exif_lib'] = {'success': True, 'has_exif': False}
            
    except Exception as e:
        results['methods']['exif_lib'] = {'success': False, 'error': str(e)}
    
    # Method 3: exifread library
    try:
        import exifread
        with open(image_path, 'rb') as f:
            tags = exifread.process_file(f)
            if tags:
                exif_data = {str(k): str(v) for k, v in tags.items()}
                results['methods']['exifread'] = {
                    'success': True,
                    'tags_found': len(exif_data),
                    'data': exif_data
                }
            else:
                results['methods']['exifread'] = {'success': False, 'error': 'No tags found'}
    except ImportError:
        results['methods']['exifread'] = {'success': False, 'error': 'exifread library not installed'}
    except Exception as e:
        results['methods']['exifread'] = {'success': False, 'error': str(e)}
    
    return results

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python debug_exif.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    results = debug_image_exif(image_path)
    print(json.dumps(results, indent=2))
