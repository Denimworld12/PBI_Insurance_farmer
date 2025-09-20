#!/usr/bin/env python3
# worker/pipeline.py
import sys, json, time, math, io, hashlib, os, traceback
from datetime import datetime, timezone
from PIL import Image, ImageOps, ImageChops, ImageStat
from exif import Image as ExifImage
import numpy as np
import shapely.geometry as geom
import json as pyjson
import requests

# helper functions (unchanged but robust)
def read_exif(path):
    with open(path, "rb") as f:
        img = ExifImage(f)
    return img

def exif_to_coords(img):
    def to_deg(value, ref):
        try:
            d = value[0]; m = value[1]; s = value[2]
            deg = float(d) + float(m)/60.0 + float(s)/3600.0
            if ref in ["S","W"]:
                deg = -deg
            return deg
        except Exception:
            return None
    if hasattr(img, "gps_latitude") and hasattr(img, "gps_longitude"):
        lat = to_deg(img.gps_latitude, img.gps_latitude_ref)
        lon = to_deg(img.gps_longitude, img.gps_longitude_ref)
        if lat is not None and lon is not None:
            return lat, lon
    return None

def has_min_gps_precision(img):
    fields = ["gps_dop", "gps_map_datum", "gps_processing_method"]
    count = sum(1 for f in fields if hasattr(img, f))
    return count >= 1

def parse_exif_datetime(img):
    for tag in ["datetime_original", "datetime_digitized", "datetime"]:
        if hasattr(img, tag):
            s = getattr(img, tag)
            try:
                dt = datetime.strptime(s, "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
                return dt
            except Exception:
                pass
    return None

def pip_check(lat, lon, parcel_geojson_path):
    try:
        with open(parcel_geojson_path, "r", encoding="utf-8") as fh:
            text = fh.read().strip()
            if not text:
                gj = {"type":"FeatureCollection","features":[]}
            else:
                gj = pyjson.loads(text)
    except Exception:
        gj = {"type":"FeatureCollection","features":[]}

    pt = geom.Point(lon, lat)
    in_any = False
    props = None
    for feat in gj.get("features", []):
        try:
            geom_obj = geom.shape(feat.get("geometry", {}))
            if geom_obj.contains(pt) or geom_obj.touches(pt):
                in_any = True
                props = feat.get("properties", {})
                break
        except Exception:
            continue
    return in_any, props

def ahash(image: Image.Image, hash_size=8):
    im = image.convert("L").resize((hash_size, hash_size), Image.BILINEAR)
    pixels = np.array(im)
    avg = pixels.mean()
    diff = pixels > avg
    return "".join("1" if x else "0" for x in diff.flatten())

def ela_score(image: Image.Image, quality=95):
    buf = io.BytesIO()
    image.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    resaved = Image.open(buf)
    ela = ImageChops.difference(image.convert("RGB"), resaved.convert("RGB"))
    stat = ImageStat.Stat(ela)
    mean = sum(stat.mean)/3.0
    return mean

def shadow_inconsistency_heuristic(image: Image.Image):
    gray = ImageOps.grayscale(image)
    arr = np.array(gray).astype(np.float32)
    v = np.var(arr/255.0)
    return float(min(1.0, max(0.0, (0.09 - v) * 12.0)))

def meteostat_weather(lat, lon, iso_date):
    try:
        url = f"https://meteostat.net/api/point/daily?lat={lat}&lon={lon}&start={iso_date}&end={iso_date}"
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()
        return {}
    except Exception:
        return {}

def date_ddmmyyyy(ts_ms):
    dt = datetime.fromtimestamp(ts_ms/1000, tz=timezone.utc)
    return dt.strftime("%d/%m/%Y"), dt.strftime("%A")

def damage_segmentation_percent(image: Image.Image, parcel_polygon):
    arr = np.array(image.convert("L"))
    dark = (arr < 60).sum()
    pct = dark / arr.size
    return float(min(1.0, max(0.0, pct)))

def adjudicate(flags):
    risk = "low"
    verification = "auto-approve"
    physical = False

    if not flags.get("meta_valid") or not flags.get("geo_match"):
        risk = "high"; verification = "reject"; physical = False
    else:
        if flags["forensics"].get("tamper_suspect"):
            risk = "high"; verification = "manual-review"; physical = True
        if flags["weather"].get("mismatch"):
            risk = "medium" if risk == "low" else "high"; verification = "manual-review"
        if flags.get("damage_pct", 0) >= 0.5 and risk == "low":
            verification = "expedite-payout"
    return {"risk": risk, "verification_level": verification, "need_physical_check": physical}

def safe_print_json(obj):
    # Print JSON to stdout for node to parse
    print(json.dumps(obj))
    sys.stdout.flush()

if __name__ == "__main__":
    try:
        # Expect 7 args
        if len(sys.argv) < 8:
            raise ValueError("Expected arguments: path lat lon client_ms parcel_geojson overlay_text parcel_id")

        path, lat, lon, client_ms, parcel_gj, overlay_text, parcel_id = sys.argv[1:8]
        lat = float(lat); lon = float(lon); client_ms = int(client_ms)

        # Load image with robust error handling
        try:
            pil = Image.open(path).convert("RGB")
        except Exception as e:
            out = {"error": "Failed to open image", "details": str(e)}
            safe_print_json(out)
            sys.exit(0)

        # Phase 1: EXIF validation
        meta_valid = True
        exif_details = {"has_exif": False, "gps_ok": False, "time_ok": False, "precision_ok": False}
        try:
            ex = read_exif(path)
            exif_details["has_exif"] = getattr(ex, "has_exif", False)
            coords = exif_to_coords(ex) if exif_details["has_exif"] else None
            if coords:
                ex_lat, ex_lon = coords
                exif_details["gps_ok"] = (abs(ex_lat - lat) < 0.01 and abs(ex_lon - lon) < 0.01)
            ts = parse_exif_datetime(ex)
            now_utc = datetime.now(timezone.utc)
            if ts:
                exif_details["time_ok"] = abs((now_utc - ts).total_seconds()) < 60*60*24*7
            exif_details["precision_ok"] = has_min_gps_precision(ex) or False
            meta_valid = all([exif_details["has_exif"], exif_details["gps_ok"], exif_details["time_ok"]])
        except Exception:
            meta_valid = False

        # Phase 2: Geofence PIP
        geo_match, parcel_props = pip_check(lat, lon, parcel_gj)

        # Phase 3: Forensics
        duplicate_hash = ahash(pil)
        tamper_score = shadow_inconsistency_heuristic(pil)
        tamper_suspect = tamper_score > 0.5

        # overlay consistency - use 6 decimal places to match frontend
        ddmmyyyy, weekday = date_ddmmyyyy(client_ms)
        overlay_consistent = (overlay_text.find(ddmmyyyy) >= 0 and overlay_text.find(weekday) >= 0 and
                              overlay_text.find(f"{lat:.6f}") >= 0 and overlay_text.find(f"{lon:.6f}") >= 0)

        # Phase 4: Weather
        iso_date = datetime.fromtimestamp(client_ms/1000, tz=timezone.utc).strftime("%Y-%m-%d")
        wx = meteostat_weather(lat, lon, iso_date)
        weather_mismatch = False if wx else True

        # Phase 5: Damage segmentation (placeholder)
        # If parcel exists we'll just compute on whole image as fallback
        damage_pct = 0.0
        try:
            # attempt to parse parcel and limit to first feature bbox (fallback)
            with open(parcel_gj, "r", encoding="utf-8") as fh:
                pj = fh.read().strip()
                if pj:
                    gj = pyjson.loads(pj)
                else:
                    gj = {"features": []}
            parcel_geom = None
            for feat in gj.get("features", []):
                try:
                    parcel_geom = geom.shape(feat.get("geometry", {}))
                    break
                except Exception:
                    continue
            damage_pct = damage_segmentation_percent(pil, parcel_geom) if parcel_geom is not None else damage_segmentation_percent(pil, None)
        except Exception:
            damage_pct = damage_segmentation_percent(pil, None)

        flags = {
            "meta_valid": meta_valid,
            "exif_details": exif_details,
            "geo_match": geo_match,
            "parcel": parcel_props or {},
            "forensics": {
                "tamper_suspect": tamper_suspect,
                "tamper_score": tamper_score,
                "duplicate_hash": duplicate_hash,
                "overlay_consistent": overlay_consistent
            },
            "weather": {
                "mismatch": weather_mismatch,
                "source": "meteostat",
                "raw": wx
            },
            "damage_pct": damage_pct
        }

        final = adjudicate(flags)
        out = {"final": final, "phases": flags, "report_ts": int(time.time()*1000)}
        safe_print_json(out)
        sys.exit(0)

    except Exception as e:
        tb = traceback.format_exc()
        safe_print_json({"error": "Unhandled pipeline exception", "details": str(e), "trace": tb})
        sys.exit(0)
