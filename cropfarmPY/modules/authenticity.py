# modules/authenticity.py
import cv2, numpy as np, math
from typing import Dict, Any, Tuple

def ela_score(img_bgr: np.ndarray, quality: int = 90) -> Dict[str, Any]:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, enc = cv2.imencode('.jpg', gray, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    dec = cv2.imdecode(enc, cv2.IMREAD_GRAYSCALE)
    diff = cv2.absdiff(gray, dec)
    return {
        'mean': float(np.mean(diff)),
        'std': float(np.std(diff)),
        'suspicious': float(np.std(diff)) > 10.0
    }

def double_jpeg_indicator(img_bgr: np.ndarray) -> Dict[str, Any]:
    # Simple DCT periodicity heuristic over 8x8 blocks
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    blocks = []
    for y in range(0, h - 8, 8):
        for x in range(0, w - 8, 8):
            block = gray[y:y+8, x:x+8].astype(np.float32) - 128.0
            dct = cv2.dct(block)
            blocks.append(dct.flatten())
    if not blocks:
        return {'evidence': 0.0, 'double_jpeg_likely': False}
    coeffs = np.stack(blocks, axis=0)
    hist = np.histogram(coeffs[:, 1], bins=100, range=(-50, 50))[0]  # one AC coeff
    periodicity = float(np.std(hist[::2]) - np.std(hist[1::2]))  # crude even/odd difference
    return {'evidence': periodicity, 'double_jpeg_likely': periodicity > 5.0}

def wavelet_noise_residual(img_bgr: np.ndarray) -> Tuple[np.ndarray, float]:
    # High-pass residual as PRNU surrogate when no camera reference is available
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (0,0), 1.0)
    residual = cv2.subtract(gray, blur)
    snr = float(np.std(residual) / (np.std(blur) + 1e-6))
    return residual, snr

def analyze_image_forensics(image_path: str) -> Dict[str, Any]:
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        return {'available': False, 'error': 'Could not load image', 'final_score': 0.0}
    ela = ela_score(img)
    dj = double_jpeg_indicator(img)
    residual, snr = wavelet_noise_residual(img)

    # Score aggregation
    score = 1.0
    if ela['suspicious']:
        score -= 0.25
    if dj['double_jpeg_likely']:
        score -= 0.25
    if snr < 0.35:  # low residual SNR suggests heavy processing
        score -= 0.2

    score = max(0.0, min(1.0, score))
    return {
        'available': True,
        'ela': ela,
        'double_jpeg': dj,
        'residual_snr': snr,
        'manipulation_detected': (ela['suspicious'] or dj['double_jpeg_likely'] or snr < 0.35),
        'final_score': score
    }

# Optional: PRNU correlation requires multiple images per device to build a reference fingerprint.
# Provide hooks to pass device_id -> reference_residual to compare normalized correlation when dataset allows.
