# modules/metadata.py
from typing import Dict, Any
from exif import Image as ExifImage

def read_exif(image_path: str) -> Dict[str, Any]:
    try:
        with open(image_path, 'rb') as f:
            img = ExifImage(f)
        if not img.has_exif:
            return {'has_exif': False, 'anomalies': ['no_exif']}
        meta = {
            'make': getattr(img, 'make', None),
            'model': getattr(img, 'model', None),
            'datetime': getattr(img, 'datetime_original', getattr(img, 'datetime', None)),
            'software': getattr(img, 'software', None),
            'gps_latitude': getattr(img, 'gps_latitude', None),
            'gps_longitude': getattr(img, 'gps_longitude', None)
        }
        anomalies = []
        if meta['software'] and any(s in meta['software'].lower() for s in ['photoshop','snapseed','lightroom','picsart']):
            anomalies.append('edited_software_tag')
        if meta['make'] is None or meta['model'] is None:
            anomalies.append('missing_make_model')
        return {'has_exif': True, 'meta': meta, 'anomalies': anomalies}
    except Exception as e:
        return {'has_exif': False, 'error': str(e), 'anomalies': ['exif_read_error']}
