# modules/content.py
import cv2, numpy as np
from typing import Dict, Any, List

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except Exception:
    YOLO_AVAILABLE = False

COCO_PERSON_ID = 0
COCO_ANIMAL_IDS = {15, 16, 17, 18, 19, 20, 21, 22, 23}  # cat,dog,horse,sheep,cow,elephant,bear,zebra,giraffe

class ContentDetector:
    def __init__(self, model_name: str = "yolov8n.pt"):
        self.model = YOLO(model_name) if YOLO_AVAILABLE else None

    def detect_objects(self, image_path: str) -> Dict[str, Any]:
        img = cv2.imread(image_path)
        if img is None:
            return {'available': False, 'error': 'Could not load image'}
        people, animals = 0, 0
        if self.model:
            res = self.model(image_path, verbose=False)
            for r in res:
                for b in r.boxes:
                    cls_id = int(b.cls)
                    if cls_id == COCO_PERSON_ID:
                        people += 1
                    if cls_id in COCO_ANIMAL_IDS:
                        animals += 1
        return {'available': True, 'people': people, 'animals': animals}

def vegetation_mask(img_bgr: np.ndarray) -> np.ndarray:
    b, g, r = cv2.split(img_bgr.astype(np.float32))
    exg = 2*g - r - b
    mask = (exg > 20).astype(np.uint8)  # tune threshold per dataset
    return mask

def water_mask(img_bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    lower = np.array([85, 30, 30], dtype=np.uint8)   # cyan/blue
    upper = np.array([130, 255, 255], dtype=np.uint8)
    return cv2.inRange(hsv, lower, upper)

def fire_mask(img_bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    lower1 = np.array([0, 120, 180], dtype=np.uint8)
    upper1 = np.array([25, 255, 255], dtype=np.uint8)
    lower2 = np.array([160, 120, 180], dtype=np.uint8)
    upper2 = np.array([179, 255, 255], dtype=np.uint8)
    mask1 = cv2.inRange(hsv, lower1, upper1)
    mask2 = cv2.inRange(hsv, lower2, upper2)
    return cv2.bitwise_or(mask1, mask2)

def classify_scene(image_path: str, yolo: ContentDetector) -> Dict[str, Any]:
    img = cv2.imread(image_path)
    if img is None:
        return {'available': False, 'error': 'Could not load image'}
    det = yolo.detect_objects(image_path) if yolo else {'people': 0, 'animals': 0, 'available': False}
    veg = vegetation_mask(img)
    wat = water_mask(img)
    fir = fire_mask(img)

    h, w, _ = img.shape
    area = h * w
    veg_pct = float(100.0 * np.count_nonzero(veg) / area)
    water_pct = float(100.0 * np.count_nonzero(wat) / area)
    fire_pct = float(100.0 * np.count_nonzero(fir) / area)

    scenario = "pure_farm" if veg_pct > 40 and det['people'] == 0 and det['animals'] == 0 and water_pct < 5 and fire_pct < 1 else "mixed"
    if water_pct >= 10:
        scenario = "farm_in_water_human" if det['people'] > 0 else ("farm_in_water_animal" if det['animals'] > 0 else "farm_in_water")
    if fire_pct >= 2:
        scenario = "farm_fire_human" if det['people'] > 0 else ("farm_fire_animal" if det['animals'] > 0 else "farm_fire")
    if scenario == "mixed":
        if det['people'] > 0:
            scenario = "farm_with_human"
        elif det['animals'] > 0:
            scenario = "farm_with_animal"
        else:
            scenario = "farm_general"

    return {
        'available': True,
        'people': det.get('people', 0),
        'animals': det.get('animals', 0),
        'vegetation_percent': round(veg_pct, 2),
        'water_percent': round(water_pct, 2),
        'fire_percent': round(fire_pct, 2),
        'scenario': scenario
    }
