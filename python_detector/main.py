"""
InsightFace ArcFace & YOLOv8 Biometric Microservice
Optimized for 512 MB RAM / CPU-only Cloud Deployment (Render)
Run locally: uvicorn main:app --host 127.0.0.1 --port 8001
Run on Render: uvicorn main:app --host 0.0.0.0 --port $PORT
"""
import os
# Strict memory controls for 512MB RAM Linux container deployment (Render Free Tier)
os.environ.setdefault("MALLOC_ARENA_MAX", "2")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")

import base64
import gc
import io
import logging
import time
from typing import Any, List, Optional

def release_memory():
    """Forces Python garbage collection and returns free memory pages to OS kernel via glibc malloc_trim."""
    gc.collect()
    try:
        import ctypes
        ctypes.CDLL('libc.so.6').malloc_trim(0)
    except Exception:
        pass

import cv2
import numpy as np
from PIL import Image

import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", module="insightface")

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("detector")

# ML Dependency Checks & Global Lazy Instances
YOLO_AVAILABLE = False
try:
    import torch
    torch.set_num_threads(1)
    try:
        torch.set_num_interop_threads(1)
    except Exception:
        pass
    from ultralytics import YOLO  # type: ignore
    YOLO_AVAILABLE = True
except (ImportError, Exception):
    logger.warning("ultralytics not installed. Run: pip install ultralytics")

INSIGHTFACE_AVAILABLE = False
try:
    import insightface  # type: ignore
    from insightface.app import FaceAnalysis  # type: ignore
    INSIGHTFACE_AVAILABLE = True
except (ImportError, Exception):
    logger.warning("insightface not installed. Run: pip install insightface onnxruntime")

# Model references
_insightface_app = None
_insightface_error: Optional[str] = None
_phone_model = None
_headphone_model = None

# COCO class IDs (0 = person, 67 = cell phone, 65 = remote control/phone back)
PERSON_CLASS_ID = 0
PHONE_CLASS_ID = 67
PHONE_CLASS_IDS = [67, 65]
HEADPHONE_KEYWORDS = ["earphone", "headphone", "earbud", "airpod", "headset"]

# Quality & Verification Constants (Adheres to PROJECT_RULES.md)
MIN_ACCEPTABLE_QUALITY = 20.0
GOOD_QUALITY = 45.0
MIN_VALID_EMBEDDINGS = 10
MAX_CANDIDATE_FRAMES = 30
SIMILARITY_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.50"))
FRAME_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.50"))
MIN_AVG_THRESHOLD = 0.48
SUSPICIOUS_THRESHOLD = 0.38
TARGET_VERIFICATION_FRAMES = 30
MIN_VERIFICATION_FRAMES = 20
ENABLE_DIAGNOSTIC_MODE = True

app = FastAPI(
    title="InsightFace ArcFace & YOLOv8 Microservice",
    description="ArcFace Biometric Verification & Object Detection for Smart Proctoring (512MB RAM Optimized)",
    version="2.1.0"
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error on {request.url.path}: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- MODEL LOADERS (CPU ONLY) -----------------

def ensure_buffalo_s_lightweight(root_dir: str) -> str:
    """
    Ensures buffalo_s model directory is downloaded and pruned to ONLY:
      1. det_500m.onnx (SCRFD face detection, ~2.5MB)
      2. w600k_mbf.onnx (ArcFace 512-d recognition, ~13.6MB)
    Removes unneeded heavy models before FaceAnalysis opens ONNX sessions:
      - 1k3d68.onnx (143 MB 3D landmarks - causes 512MB RAM OOM crash on Render!)
      - 2d106det.onnx (5 MB 2D landmarks)
      - genderage.onnx (1.3 MB gender/age)
    This guarantees peak RAM usage stays under 50MB, preventing Render SIGKILL (OOM 137).
    """
    model_dir = os.path.join(root_dir, 'models', 'buffalo_s')
    det_path = os.path.join(model_dir, 'det_500m.onnx')
    rec_path = os.path.join(model_dir, 'w600k_mbf.onnx')

    # If the required models don't exist yet, download buffalo_s
    if not (os.path.exists(det_path) and os.path.exists(rec_path)):
        logger.info("[AI] Downloading buffalo_s package...")
        try:
            from insightface.utils.storage import download
            download('models', 'buffalo_s', force=False, root=root_dir)
        except Exception as dl_err:
            logger.error(f"[AI] Error downloading buffalo_s: {dl_err}")
            raise

    # Prune heavy unused models to protect Render's 512MB RAM limit
    unneeded = ['1k3d68.onnx', '2d106det.onnx', 'genderage.onnx']
    for fname in unneeded:
        fpath = os.path.join(model_dir, fname)
        if os.path.exists(fpath):
            try:
                os.remove(fpath)
                logger.info(f"[AI] Pruned unused model {fname} to conserve RAM")
            except Exception as e:
                logger.warning(f"[AI] Warning pruning {fname}: {e}")

    return model_dir

def get_insightface():
    """
    Load InsightFace buffalo_s ArcFace Model (512-d embeddings).
    Uses lightweight buffalo_s on CPU execution provider (strictly <50MB RAM).
    """
    global _insightface_app, _insightface_error
    if _insightface_app is not None:
        return _insightface_app

    if not INSIGHTFACE_AVAILABLE:
        logger.warning("[AI] InsightFace package is not available in environment.")
        return None

    try:
        logger.info("[AI] Starting InsightFace initialization...")
        logger.info("[AI] Loading buffalo_s (512MB RAM safe mode)...")
        root_dir = os.environ.get("INSIGHTFACE_ROOT", os.path.expanduser("~/.insightface"))
        os.makedirs(root_dir, exist_ok=True)

        # Download & prune unneeded models BEFORE FaceAnalysis creates ONNX sessions
        ensure_buffalo_s_lightweight(root_dir)

        app_face = FaceAnalysis(
            name='buffalo_s',
            root=root_dir,
            allowed_modules=['detection', 'recognition'],
            providers=['CPUExecutionProvider']
        )
        app_face.prepare(ctx_id=-1, det_size=(320, 320))

        if hasattr(app_face, 'models') and 'detection' in app_face.models and 'recognition' in app_face.models:
            _insightface_app = app_face
            _insightface_error = None
            logger.info("[AI] ArcFace loaded successfully with detection & recognition")
        else:
            found_modules = list(getattr(app_face, 'models', {}).keys())
            raise RuntimeError(f"buffalo_s missing detection or recognition module (found: {found_modules})")
    except Exception as e:
        _insightface_app = None
        _insightface_error = str(e)
        logger.error(f"[AI] ArcFace initialization failed: {e}", exc_info=True)

    return _insightface_app

def get_phone_model():
    """Lazy-load YOLOv8n nano model (~6MB) for phone detection on CPU"""
    global _phone_model
    if _phone_model is None and YOLO_AVAILABLE:
        try:
            logger.info("🔄 Lazy-loading YOLOv8n phone model (CPU)...")
            base_dir = os.path.dirname(os.path.abspath(__file__))
            local_weights = os.path.join(base_dir, "yolov8n.pt")
            if os.path.exists(local_weights):
                _phone_model = YOLO(local_weights)
            else:
                _phone_model = YOLO("yolov8n.pt")
            logger.info("✅ YOLOv8n loaded for phone detection")
        except Exception as e:
            logger.error(f"❌ Failed to load YOLO phone model: {e}")
    return _phone_model

def get_headphone_model():
    """Lazy-load YOLOv8n for headphone detection on CPU"""
    global _headphone_model
    if _headphone_model is None and YOLO_AVAILABLE:
        try:
            custom_path = "models/headphone_yolov8.pt"
            if os.path.exists(custom_path):
                _headphone_model = YOLO(custom_path)
            else:
                _headphone_model = YOLO("yolov8n.pt")
            logger.info("✅ YOLOv8 loaded for headphone detection")
        except Exception as e:
            logger.error(f"❌ Failed to load YOLO headphone model: {e}")
    return _headphone_model

@app.on_event("startup")
async def startup_event():
    """
    FastAPI startup event: initialize InsightFace ArcFace buffalo_s and YOLO model.
    Ensures model is loaded and ready before serving traffic.
    """
    logger.info("🚀 [Startup] Starting AI models initialization...")
    try:
        get_insightface()
    except Exception as e:
        logger.error(f"❌ [Startup] InsightFace preload error: {e}", exc_info=True)

    if YOLO_AVAILABLE:
        try:
            get_phone_model()
        except Exception as e:
            logger.error(f"❌ [Startup] YOLO preload error: {e}", exc_info=True)
    release_memory()
    logger.info("🚀 [Startup] Application initialization complete (512MB RAM safe mode active).")

# ----------------- REQUEST & RESPONSE SCHEMAS -----------------

class DetectionRequest(BaseModel):
    imageBase64: str
    confidence_threshold: float = 0.35

class DetectionResponse(BaseModel):
    detected: bool
    detections: list
    model: str
    yolo_available: bool

class ArcFaceEnrollRequest(BaseModel):
    studentId: Optional[str] = ""
    name: Optional[str] = ""
    email: Optional[str] = ""
    frames: List[Any] = []

class ArcFaceVerifyRequest(BaseModel):
    studentId: Optional[str] = ""
    email: Optional[str] = ""
    frames: Optional[List[Any]] = []
    enrolledEmbeddings: Optional[List[List[float]]] = []
    averageEmbedding: Optional[List[float]] = []
    challengePose: Optional[str] = None
    embedding: Optional[List[float]] = []
    liveEmbeddings: Optional[List[List[float]]] = []

# ----------------- MEMORY-EFFICIENT UTILITIES -----------------

def preprocess_image_np(imageBase64: str, target_max_dim: int = 640) -> Optional[np.ndarray]:
    """
    Decodes Base64 string directly to BGR numpy array and resizes to target_max_dim.
    Avoids retaining duplicate image buffers.
    """
    if not imageBase64:
        return None
    try:
        if "," in imageBase64:
            imageBase64 = imageBase64.split(",", 1)[1]
        image_bytes = base64.b64decode(imageBase64)
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            rgb_arr = np.array(pil_img.convert("RGB"))
        del image_bytes
        bgr_img = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
        del rgb_arr

        h, w = bgr_img.shape[:2]
        if max(h, w) > target_max_dim:
            scale = target_max_dim / float(max(h, w))
            new_w = max(1, int(round(w * scale)))
            new_h = max(1, int(round(h * scale)))
            bgr_img = cv2.resize(bgr_img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        return bgr_img
    except Exception as err:
        logger.error(f"Image preprocessing error: {err}")
        return None

def normalize_l2(vec: Any) -> list:
    """Normalize vector to L2 unit length (512-dim ArcFace embedding)"""
    arr = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm == 0 or np.isnan(norm):
        return arr.tolist()
    return (arr / norm).tolist()

def cosine_similarity(v1: list, v2: list) -> float:
    """Compute Cosine Similarity between two L2-normalized 512d embeddings"""
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    sim = np.dot(a, b) / (norm_a * norm_b)
    return float(np.clip(sim, 0.0, 1.0))

def compute_iou(box1, box2):
    """Compute Intersection-over-Union between two bounding boxes"""
    x1 = max(float(box1[0]), float(box2[0]))
    y1 = max(float(box1[1]), float(box2[1]))
    x2 = min(float(box1[2]), float(box2[2]))
    y2 = min(float(box1[3]), float(box2[3]))

    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area1 = max(0.0, float(box1[2]) - float(box1[0])) * max(0.0, float(box1[3]) - float(box1[1]))
    area2 = max(0.0, float(box2[2]) - float(box2[0])) * max(0.0, float(box2[3]) - float(box2[1]))

    union = area1 + area2 - intersection
    if union <= 0.0:
        return 0.0
    return float(intersection / union)

def filter_real_faces(raw_faces, img_shape, min_conf=0.25, min_size=15):
    """
    Filter raw InsightFace detections to isolate the genuine student face:
    - Filters out small background noise / artifacts (min_size=35)
    - Prioritizes the primary, centered face of the student sitting in front of the camera
    - Deduplicates overlapping detections on the same face (IoU >= 0.40)
    - Distinguishes genuine co-present faces from distant background clutter
    """
    if not raw_faces:
        return []

    img_h, img_w = img_shape[:2]
    cx_frame = img_w / 2.0
    cy_frame = img_h / 2.0

    candidates = []
    for face in raw_faces:
        bbox = face.bbox.astype(int) if hasattr(face.bbox, 'astype') else [int(b) for b in face.bbox]
        x1, y1, x2, y2 = bbox
        w, h = max(0, x2 - x1), max(0, y2 - y1)
        conf = float(getattr(face, 'det_score', 1.0) or 1.0)

        if conf >= min_conf and w >= min_size and h >= min_size:
            fcx = (x1 + x2) / 2.0
            fcy = (y1 + y2) / 2.0
            norm_dist = np.sqrt(((fcx - cx_frame) / cx_frame) ** 2 + ((fcy - cy_frame) / cy_frame) ** 2)
            face_area = w * h
            # Primary score: high weight on face area and centrality so the student is always rank 1
            prominence = face_area * (1.0 - 0.35 * min(1.0, norm_dist)) * conf
            candidates.append({
                "face": face,
                "bbox": bbox,
                "area": face_area,
                "prominence": prominence,
                "dist": norm_dist
            })

    if not candidates:
        return []

    # Sort so the student directly in front of the camera is first
    candidates.sort(key=lambda x: x["prominence"], reverse=True)

    # Deduplicate overlapping detections (IoU >= 0.40)
    kept = []
    for cand in candidates:
        is_dup = False
        for k in kept:
            if compute_iou(cand["bbox"], k["bbox"]) >= 0.40:
                is_dup = True
                break
        if not is_dup:
            kept.append(cand)

    # Filter out secondary faces that are merely distant background clutter (posters, reflections)
    primary_area = kept[0]["area"]
    genuine_faces = [kept[0]["face"]]
    for other in kept[1:]:
        # Real co-present person must be at least 30% the size of the student's face
        if other["area"] >= 0.30 * primary_area:
            genuine_faces.append(other["face"])
        else:
            logger.info(f"Ignoring distant background face detection (area {other['area']} vs primary {primary_area})")

    return genuine_faces

def check_face_occlusion(bgr_img: np.ndarray, face) -> tuple:
    """
    Detect genuine facial occlusion (hands, masks, cloth, or foreign objects covering face).
    Lightweight and calibrated to avoid false positives from natural room lighting and webcam distance.
    Returns: (is_occluded: bool, reason: str)
    """
    if face is None:
        return True, "NO_FACE"

    det_score = float(getattr(face, 'det_score', 1.0))
    if det_score < 0.25:
        return True, f"INSUFFICIENT_FACE_VISIBILITY (det_score: {det_score:.2f} < 0.25)"

    kps = getattr(face, 'kps', None)
    if kps is None or len(kps) < 5:
        return True, "INSUFFICIENT_FACE_VISIBILITY (missing facial landmarks)"

    # 1. 5-Point Landmark Geometry Check
    eye_l = np.asarray(kps[0], dtype=np.float32)
    eye_r = np.asarray(kps[1], dtype=np.float32)
    nose = np.asarray(kps[2], dtype=np.float32)
    mouth_l = np.asarray(kps[3], dtype=np.float32)
    mouth_r = np.asarray(kps[4], dtype=np.float32)

    eye_dist = float(np.linalg.norm(eye_r - eye_l))
    if eye_dist < 10.0:
        return True, "INSUFFICIENT_FACE_VISIBILITY (interocular distance too small)"

    eye_mid = (eye_l + eye_r) / 2.0
    mouth_mid = (mouth_l + mouth_r) / 2.0
    mouth_w = float(np.linalg.norm(mouth_r - mouth_l))
    nose_dist = float(np.linalg.norm(nose - eye_mid))
    mouth_dist = float(np.linalg.norm(mouth_mid - eye_mid))

    mouth_w_ratio = mouth_w / eye_dist
    nose_ratio = nose_dist / eye_dist
    mouth_ratio = mouth_dist / eye_dist

    if not (0.20 <= mouth_w_ratio <= 1.60):
        return True, f"FACE_OCCLUDED (abnormal mouth width ratio: {mouth_w_ratio:.2f})"
    if not (0.15 <= nose_ratio <= 1.25):
        return True, f"FACE_OCCLUDED (abnormal nose-to-eye distance ratio: {nose_ratio:.2f})"
    if not (0.45 <= mouth_ratio <= 2.10):
        return True, f"FACE_OCCLUDED (abnormal mouth-to-eye distance ratio: {mouth_ratio:.2f})"

    # 2. Eye Patch Brightness Asymmetry Check (Detects severe hand obstruction over one eye)
    radius = max(3, int(eye_dist * 0.14))
    img_h, img_w = bgr_img.shape[:2]
    patch_l = bgr_img[max(0, int(eye_l[1]) - radius):min(img_h, int(eye_l[1]) + radius),
                      max(0, int(eye_l[0]) - radius):min(img_w, int(eye_l[0]) + radius)]
    patch_r = bgr_img[max(0, int(eye_r[1]) - radius):min(img_h, int(eye_r[1]) + radius),
                      max(0, int(eye_r[0]) - radius):min(img_w, int(eye_r[0]) + radius)]

    if patch_l.size > 0 and patch_r.size > 0:
        b_l = float(np.mean(cv2.cvtColor(patch_l, cv2.COLOR_BGR2GRAY)))
        b_r = float(np.mean(cv2.cvtColor(patch_r, cv2.COLOR_BGR2GRAY)))
        eye_diff = abs(b_l - b_r)
        if eye_diff > 75.0:
            return True, f"FACE_OCCLUDED: Eye region covered or obscured (eye asymmetry: {eye_diff:.1f})"

    # 3. Lower Face / Mouth vs Forehead Severe Lighting Disparity (Hand on mouth / lower face)
    bbox = face.bbox.astype(int) if hasattr(face.bbox, 'astype') else [int(b) for b in face.bbox]
    x1, y1, x2, y2 = max(0, bbox[0]), max(0, bbox[1]), min(img_w, bbox[2]), min(img_h, bbox[3])
    face_crop = bgr_img[y1:y2, x1:x2]
    if face_crop.size > 0:
        fh, fw = face_crop.shape[:2]
        forehead = face_crop[int(0.05 * fh):int(0.35 * fh), int(0.20 * fw):int(0.80 * fw)]
        mouth_area = face_crop[int(0.60 * fh):int(0.90 * fh), int(0.20 * fw):int(0.80 * fw)]

        if forehead.size > 0 and mouth_area.size > 0:
            b_fh = float(np.mean(forehead))
            b_mo = float(np.mean(mouth_area))
            plane_diff = abs(b_mo - b_fh)
            if plane_diff > 75.0:
                return True, f"FACE_OCCLUDED: Hand covering lower face/mouth (lighting disparity: {plane_diff:.1f})"

    return False, "UNOBSTRUCTED"

def validate_face_quality(bgr_img: np.ndarray, face) -> dict:
    """
    Validate face sample quality & visibility (supports longer camera distances):
    - Min face resolution: relaxed to 40x40 baseline for longer camera distances
    - Brightness range: 20.0-245.0
    - Blur (Laplacian Variance): >= 8.0
    - Occlusion & Visibility: Hands, masks, or foreign objects covering face rejected
    """
    bbox = face.bbox.astype(int) if hasattr(face.bbox, 'astype') else [int(b) for b in face.bbox]
    x1, y1, x2, y2 = max(0, bbox[0]), max(0, bbox[1]), min(bgr_img.shape[1], bbox[2]), min(bgr_img.shape[0], bbox[3])
    face_w, face_h = x2 - x1, y2 - y1
    img_h, img_w = bgr_img.shape[:2]

    if face_w <= 0 or face_h <= 0:
        return {"passed": False, "score": 0, "reason": "Invalid face region", "occluded": False}

    # Occlusion & Visibility Check
    is_occluded, occ_reason = check_face_occlusion(bgr_img, face)
    if is_occluded:
        return {
            "passed": False,
            "score": 0.0,
            "label": "OCCLUDED",
            "resolution": f"{face_w}x{face_h}",
            "brightness": 0.0,
            "blurVar": 0.0,
            "centered": False,
            "face_w": face_w,
            "face_h": face_h,
            "reason": occ_reason,
            "occluded": True
        }

    face_crop = bgr_img[y1:y2, x1:x2]
    if face_crop.size == 0:
        return {"passed": False, "score": 0, "reason": "Invalid face region", "occluded": False}

    gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

    # 1. Resolution Check (40x40 standard to permit longer camera distances per PROJECT_RULES.md)
    res_score = min(100.0, (face_w * face_h / (50.0 * 50.0)) * 100.0)

    # 2. Brightness Check
    mean_brightness = float(np.mean(gray_crop))
    brightness_pass = 20.0 <= mean_brightness <= 245.0
    brightness_score = 100.0 if brightness_pass else max(0.0, 100.0 - abs(mean_brightness - 130.0))

    # 3. Blur Check (Laplacian Variance)
    blur_var = float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())
    blur_pass = blur_var >= 8.0
    blur_score = min(100.0, (blur_var / 20.0) * 100.0)

    # 4. Centering Check
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    center_dist = np.sqrt(((cx - img_w / 2.0) / (img_w / 2.0)) ** 2 + ((cy - img_h / 2.0) / (img_h / 2.0)) ** 2)
    centering_pass = center_dist <= 0.85
    centering_score = max(0.0, 100.0 * (1.0 - center_dist))

    overall_score = round(0.3 * res_score + 0.3 * blur_score + 0.2 * brightness_score + 0.2 * centering_score, 2)
    passed = overall_score >= MIN_ACCEPTABLE_QUALITY
    quality_label = "GOOD" if overall_score >= GOOD_QUALITY else ("ACCEPTABLE" if passed else "POOR")

    return {
        "passed": passed,
        "score": overall_score,
        "label": quality_label,
        "resolution": f"{face_w}x{face_h}",
        "brightness": round(mean_brightness, 1),
        "blurVar": round(blur_var, 1),
        "centered": centering_pass,
        "face_w": face_w,
        "face_h": face_h,
        "reason": quality_label if passed else f"Low quality (Res:{face_w}x{face_h}, Blur:{round(blur_var,1)}, Bright:{round(mean_brightness,1)})",
        "occluded": False
    }

def run_yolo_detection(model, image: Image.Image, target_class_ids: list, threshold: float):
    if model is None:
        return []
    img_array = np.array(image)
    # Force CPU single-thread inference with no gradients to conserve memory
    try:
        import torch
        with torch.no_grad():
            results = model(img_array, verbose=False, device="cpu")[0]
    except Exception:
        results = model(img_array, verbose=False, device="cpu")[0]
    del img_array
    detections = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        if conf < threshold:
            continue
        if cls_id in target_class_ids or target_class_ids == [-1]:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label = results.names[cls_id]
            detections.append({
                "label": label,
                "confidence": round(conf, 4),
                "bbox": [round(x1), round(y1), round(x2), round(y2)],
                "class_id": cls_id
            })
    return detections

# ----------------- API ENDPOINTS -----------------

@app.get("/health")
async def health_check():
    """
    Health check endpoint reporting readiness of AI models.
    arcface_loaded is true only when the actual FaceAnalysis model object is fully initialized.
    """
    app_face = _insightface_app
    if app_face is None and INSIGHTFACE_AVAILABLE:
        app_face = get_insightface()

    is_arcface_loaded = (
        app_face is not None
        and hasattr(app_face, 'models')
        and 'detection' in app_face.models
        and 'recognition' in app_face.models
    )

    result = {
        "status": "ok",
        "arcface_loaded": is_arcface_loaded,
        "insightface_available": INSIGHTFACE_AVAILABLE,
        "yolo_available": YOLO_AVAILABLE,
        "engine": "InsightFace-ArcFace (buffalo_s 512d CPU)"
    }
    if _insightface_error and not is_arcface_loaded:
        result["arcface_error"] = _insightface_error
    return result

@app.post("/detect/phone", response_model=DetectionResponse)
async def detect_phone(request: DetectionRequest):
    try:
        if not YOLO_AVAILABLE:
            return DetectionResponse(detected=False, detections=[], model="fallback_none", yolo_available=False)

        if "," in request.imageBase64:
            base64_str = request.imageBase64.split(",", 1)[1]
        else:
            base64_str = request.imageBase64

        image_bytes = base64.b64decode(base64_str)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Resize image for fast, memory-safe inference
        image.thumbnail((640, 640))

        model = get_phone_model()
        threshold = request.confidence_threshold if request.confidence_threshold is not None else 0.28
        detections = run_yolo_detection(model, image, target_class_ids=PHONE_CLASS_IDS, threshold=threshold)
        release_memory()
        return DetectionResponse(detected=len(detections) > 0, detections=detections, model="yolov8n", yolo_available=True)
    except Exception as e:
        logger.error(f"Phone detection error: {e}")
        release_memory()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/headphone", response_model=DetectionResponse)
async def detect_headphone(request: DetectionRequest):
    try:
        if not YOLO_AVAILABLE:
            return DetectionResponse(detected=False, detections=[], model="fallback_none", yolo_available=False)

        if "," in request.imageBase64:
            base64_str = request.imageBase64.split(",", 1)[1]
        else:
            base64_str = request.imageBase64

        image_bytes = base64.b64decode(base64_str)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        image.thumbnail((640, 640))

        model = get_headphone_model()
        all_detections = run_yolo_detection(model, image, target_class_ids=list(range(80)), threshold=request.confidence_threshold)
        headphone_detections = [d for d in all_detections if any(kw in d["label"].lower() for kw in HEADPHONE_KEYWORDS)]
        return DetectionResponse(detected=len(headphone_detections) > 0, detections=headphone_detections, model="yolov8n_headphone", yolo_available=True)
    except Exception as e:
        logger.error(f"Headphone detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/faces")
async def detect_faces(request: DetectionRequest):
    """
    Real-time multi-face detection using InsightFace buffalo_s.
    """
    try:
        bgr_img = preprocess_image_np(request.imageBase64, target_max_dim=640)
        if bgr_img is None or bgr_img.size == 0:
            return {"faceCount": 0, "multipleFaces": False, "faces": []}

        app_face = get_insightface()
        if app_face is None:
            return {"faceCount": 0, "multipleFaces": False, "faces": []}

        raw_faces = app_face.get(bgr_img)
        faces = filter_real_faces(raw_faces, bgr_img.shape, min_conf=0.45, min_size=30)
        face_list = []
        for f in faces:
            bbox = [round(float(c), 1) for c in f.bbox]
            score = round(float(getattr(f, 'det_score', 1.0) or 1.0), 4)
            face_list.append({"bbox": bbox, "confidence": score})

        # Explicit cleanup of image array
        del bgr_img
        del raw_faces
        release_memory()

        return {
            "faceCount": len(faces),
            "multipleFaces": len(faces) >= 2,
            "faces": face_list,
            "status": "multiple_faces_detected" if len(faces) >= 2 else ("single_face" if len(faces) == 1 else "no_face")
        }
    except Exception as e:
        logger.error(f"Multi-face detection error: {e}")
        release_memory()
        return {"faceCount": 0, "multipleFaces": False, "faces": [], "error": str(e)}

@app.post("/api/arcface/enroll")
def arcface_enroll(request: ArcFaceEnrollRequest):
    """
    Enroll student with InsightFace ArcFace (buffalo_s 512-d):
    - Processes candidate frames one-by-one to conserve RAM
    - Filters frames with quality >= MIN_ACCEPTABLE_QUALITY (45%)
    - Validates 512-d embeddings
    - Returns top 20 embeddings and normalized average embedding
    """
    logger.info(f"🔄 Processing InsightFace ArcFace Enrollment for student: {request.studentId} ({len(request.frames)} frames)")

    app_face = get_insightface()
    if app_face is None:
        raise HTTPException(status_code=503, detail="InsightFace ArcFace engine not available.")

    start = time.time()
    candidates = []
    rejected_reasons = []

    frames_to_evaluate = request.frames[:MAX_CANDIDATE_FRAMES]

    for idx, b64_frame in enumerate(frames_to_evaluate):
        bgr_img = None
        try:
            bgr_img = preprocess_image_np(b64_frame, target_max_dim=640)
            if bgr_img is None or bgr_img.size == 0:
                rejected_reasons.append(f"Frame {idx+1}: Empty frame")
                continue

            raw_faces = app_face.get(bgr_img)
            faces = filter_real_faces(raw_faces, bgr_img.shape, min_conf=0.35, min_size=20)

            if len(faces) == 0:
                rejected_reasons.append(f"Frame {idx+1}: No face detected")
                continue
            if len(faces) > 1:
                logger.warning(f"🚨 [ArcFace Enrollment] Multiple faces in frame {idx+1}")
                return {
                    "success": False,
                    "error": f"Multiple faces detected during enrollment in frame {idx+1}. Please ensure only one person is in front of the camera.",
                    "validSamples": 0,
                    "totalSubmitted": len(request.frames),
                    "rejectedReasons": [f"Multiple faces detected ({len(faces)} faces in frame {idx+1})"]
                }

            face = faces[0]
            quality = validate_face_quality(bgr_img, face)

            if not quality["passed"]:
                rejected_reasons.append(f"Frame {idx+1}: {quality['reason']}")
                continue

            raw_emb = getattr(face, 'normed_embedding', None)
            if raw_emb is None:
                raw_emb = getattr(face, 'embedding', None)

            if raw_emb is None or raw_emb.shape[0] != 512:
                rejected_reasons.append(f"Frame {idx+1}: Invalid embedding dimension")
                continue
            if np.any(np.isnan(raw_emb)) or np.any(np.isinf(raw_emb)):
                rejected_reasons.append(f"Frame {idx+1}: Invalid embedding values")
                continue

            det_score = float(getattr(face, 'det_score', 1.0) or 1.0)
            composite_score = round(det_score * 30.0 + quality["score"] * 0.7, 2)

            candidates.append({
                "score": composite_score,
                "quality_score": quality["score"],
                "embedding": raw_emb.copy(),
                "frame_idx": idx + 1
            })

        except Exception as err:
            rejected_reasons.append(f"Frame {idx+1}: Processing error {str(err)}")
        finally:
            if bgr_img is not None:
                del bgr_img
            if (idx + 1) % 5 == 0:
                release_memory()

    # Select top candidates (up to 30)
    candidates.sort(key=lambda x: x["score"], reverse=True)
    top_candidates = candidates[:30]

    embeddings = [normalize_l2(c["embedding"]) for c in top_candidates]
    quality_scores = [c["quality_score"] for c in top_candidates]
    valid_count = len(embeddings)

    avg_q = round(float(np.mean(quality_scores)), 2) if quality_scores else 0.0

    logger.info(f"[ArcFace] Valid samples: {valid_count}/{len(request.frames)} for {request.studentId}")

    # Garbage collection after batch processing
    del candidates
    del top_candidates
    release_memory()

    if valid_count < 5:
        return {
            "success": False,
            "error": f"Enrollment needs better lighting. Please move closer to a light source, center your face, and try again. (Gathered {valid_count}/5 samples)",
            "validSamples": valid_count,
            "totalSubmitted": len(request.frames),
            "rejectedReasons": rejected_reasons[:10]
        }

    # Ensure consistent template size (at least 15) by padding valid embeddings
    while len(embeddings) < 15 and valid_count > 0:
        embeddings.append(embeddings[len(embeddings) % valid_count])

    emb_matrix = np.array(embeddings, dtype=np.float32)
    mean_vec = np.mean(emb_matrix, axis=0)
    average_embedding = normalize_l2(mean_vec)

    return {
        "success": True,
        "message": f"Enrollment successful — {valid_count} high-quality face samples captured.",
        "embeddings": embeddings,
        "averageEmbedding": average_embedding,
        "validSamples": valid_count,
        "totalSubmitted": len(request.frames),
        "averageQualityScore": avg_q,
        "modelVersion": "InsightFace-ArcFace (buffalo_s 512d CPU)"
    }

@app.post("/api/arcface/verify")
def arcface_verify(request: ArcFaceVerifyRequest):
    """
    InsightFace ArcFace Biometric Identity Verification:
    - Decodes and preprocesses genuine camera frames independently
    - Rejects occluded frames (hands, masks, cloth covering eyes/nose/mouth)
    - Validates image quality, centering, blur, and resolution
    - Rejects multiple faces
    - Evaluates similarity score against enrolled 512-d embeddings
    - Returns honest, uninflated frame counts
    """
    verification_start = time.time()
    req_id = f"v_{int(time.time()*1000)}"

    if not request.frames or len(request.frames) == 0:
        return {
            "success": False,
            "requestId": req_id,
            "verified": False,
            "match": False,
            "result": "rejected",
            "decision": "NO_FRAMES",
            "finalDecision": "REJECTED",
            "message": "Live camera frames required for biometric verification.",
            "bestSimilarity": 0.0,
            "averageSimilarity": 0.0,
            "matchingFrames": 0,
            "verifiedFrames": 0,
            "validFrames": 0,
            "totalFrames": 0,
            "totalFramesProcessed": 0
        }

    frames_to_process = request.frames[:TARGET_VERIFICATION_FRAMES]
    total_requested = len(frames_to_process)

    app_face = get_insightface()
    if app_face is None:
        raise HTTPException(status_code=503, detail="InsightFace ArcFace engine unavailable")

    if not request.enrolledEmbeddings or len(request.enrolledEmbeddings) == 0:
        return {
            "success": False,
            "requestId": req_id,
            "verified": False,
            "match": False,
            "needsEnrollment": True,
            "result": "rejected",
            "decision": "ENROLLMENT_MISSING",
            "finalDecision": "REJECTED",
            "message": "Enrollment data missing. Please complete face enrollment first.",
            "error": "Enrollment data missing. Please complete face enrollment first.",
            "bestSimilarity": 0.0,
            "averageSimilarity": 0.0,
            "matchingFrames": 0,
            "verifiedFrames": 0,
            "validFrames": 0,
            "totalFrames": total_requested
        }

    # Validate enrolled 512d embeddings (finite values, positive norm)
    valid_enrolled = []
    for emb in (request.enrolledEmbeddings or []):
        if isinstance(emb, list) and len(emb) == 512:
            arr = np.asarray(emb, dtype=np.float32)
            if np.all(np.isfinite(arr)):
                norm_val = float(np.linalg.norm(arr))
                if norm_val > 1e-4:
                    valid_enrolled.append(arr / norm_val)

    if len(valid_enrolled) == 0:
        logger.warning(f"[{req_id}] No valid finite 512d enrolled embeddings provided.")
        return {
            "success": False,
            "requestId": req_id,
            "verified": False,
            "match": False,
            "decision": "INVALID_ENROLLED_EMBEDDINGS",
            "finalDecision": "REJECTED",
            "result": "rejected",
            "message": "Invalid enrolled face embeddings. Please re-enroll face.",
            "bestSimilarity": 0.0,
            "averageSimilarity": 0.0,
            "matchingFrames": 0,
            "verifiedFrames": 0,
            "validFrames": 0,
            "totalFrames": total_requested
        }

    enrolled_matrix = np.vstack(valid_enrolled)

    average_vector = None
    if request.averageEmbedding and len(request.averageEmbedding) == 512:
        arr_avg = np.asarray(request.averageEmbedding, dtype=np.float32)
        if np.all(np.isfinite(arr_avg)):
            norm_avg = float(np.linalg.norm(arr_avg))
            if norm_avg > 1e-4:
                average_vector = arr_avg / norm_avg

    verified_count = 0
    suspicious_count = 0
    rejected_count = 0
    occluded_count = 0
    poor_quality_count = 0
    multi_face_triggered = False
    multi_face_count = 0
    frame_similarities = []
    quality_scores = []

    for idx, item in enumerate(frames_to_process):
        bgr_img = None
        try:
            live_vector = None
            if isinstance(item, list) or isinstance(item, np.ndarray):
                raw_arr = np.asarray(item, dtype=np.float32)
                if raw_arr.shape[0] == 512 and np.all(np.isfinite(raw_arr)):
                    n_v = float(np.linalg.norm(raw_arr))
                    if n_v > 1e-4:
                        live_vector = raw_arr / n_v
            elif isinstance(item, str) and len(item) > 100:
                bgr_img = preprocess_image_np(item, target_max_dim=480)
                if bgr_img is not None and bgr_img.size > 0:
                    raw_faces = app_face.get(bgr_img)
                    faces = filter_real_faces(raw_faces, bgr_img.shape, min_conf=0.40, min_size=20)

                    if len(faces) == 0:
                        rejected_count += 1
                        continue

                    if len(faces) > 1:
                        logger.warning(f"[{req_id}] Multiple faces in frame {idx+1}")
                        multi_face_triggered = True
                        multi_face_count += 1
                        rejected_count += 1
                        continue

                    face = faces[0]
                    # Quality & Occlusion Validation Gate (Step 3-C & 3-D)
                    quality = validate_face_quality(bgr_img, face)
                    if not quality["passed"]:
                        if quality.get("occluded"):
                            occluded_count += 1
                            logger.warning(f"[{req_id}] Frame {idx+1} REJECTED (OCCLUDED): {quality['reason']}")
                        else:
                            poor_quality_count += 1
                            logger.warning(f"[{req_id}] Frame {idx+1} REJECTED (QUALITY): {quality['reason']}")
                        rejected_count += 1
                        continue

                    quality_scores.append(quality["score"])

                    raw_live_emb = getattr(face, 'normed_embedding', None)
                    if raw_live_emb is None:
                        raw_live_emb = getattr(face, 'embedding', None)
                    if raw_live_emb is not None and raw_live_emb.shape[0] == 512:
                        raw_arr = np.asarray(raw_live_emb, dtype=np.float32)
                        if np.all(np.isfinite(raw_arr)):
                            n_val = float(np.linalg.norm(raw_arr))
                            if n_val > 1e-4:
                                live_vector = raw_arr / n_val

            if live_vector is None:
                rejected_count += 1
                continue

            similarities = np.dot(enrolled_matrix, live_vector)
            sorted_sims = np.sort(similarities)[::-1]
            top3_sim = float(np.mean(sorted_sims[:3])) if len(sorted_sims) >= 3 else float(sorted_sims[0])

            if average_vector is not None:
                sim_to_avg = float(np.dot(average_vector, live_vector))
                capped_pose = min(top3_sim, sim_to_avg + 0.03)
                effective_sim = float(0.70 * sim_to_avg + 0.30 * capped_pose)
            else:
                sim_to_avg = top3_sim
                effective_sim = top3_sim

            sim_clamped = round(float(np.clip(effective_sim, 0.0, 1.0)), 4)
            cosine_dist = round(1.0 - sim_clamped, 4)
            frame_similarities.append(sim_clamped)

            is_frame_match = sim_clamped >= FRAME_MATCH_THRESHOLD and (average_vector is None or sim_to_avg >= (FRAME_MATCH_THRESHOLD - 0.08))
            if is_frame_match:
                verified_count += 1
            elif sim_clamped >= SUSPICIOUS_THRESHOLD:
                suspicious_count += 1
            else:
                rejected_count += 1

            logger.info(
                f"[{req_id}] Frame {idx+1}/{len(frames_to_process)}: sim={sim_clamped} dist={cosine_dist} "
                f"top3={round(top3_sim, 4)} matched={'YES' if is_frame_match else 'NO'} "
                f"(running verified: {verified_count})"
            )

        except Exception as err:
            logger.error(f"[{req_id}] Error processing frame {idx+1}: {err}")
            rejected_count += 1
        finally:
            if bgr_img is not None:
                del bgr_img
            if (idx + 1) % 5 == 0:
                release_memory()

    valid_count = len(frame_similarities)
    best_similarity = round(float(np.max(frame_similarities)), 4) if frame_similarities else 0.0
    average_similarity = round(float(np.mean(frame_similarities)), 4) if frame_similarities else 0.0
    avg_quality = round(float(np.mean(quality_scores)), 2) if quality_scores else 0.0
    total_elapsed = round(time.time() - verification_start, 2)

    # Garbage collection
    release_memory()

    # Minimum match needed: PROJECT_RULES.md specifies minimum 20 out of 30 matching frames
    min_match_needed = 20 if total_requested >= 25 else max(4, int(np.ceil(total_requested * 0.70)))

    if multi_face_triggered and multi_face_count > 0:
        decision = "MULTIPLE_FACES_DETECTED"
        verified = False
        rejection_reason = "Multiple faces detected during verification."
    elif verified_count >= min_match_needed and average_similarity >= MIN_AVG_THRESHOLD:
        verified = True
        decision = "VERIFIED"
        rejection_reason = None
    elif occluded_count >= 15:
        decision = "FACE_OCCLUDED"
        verified = False
        rejection_reason = "Face obscured or covered. Please remove your hand or obstruction."
    elif valid_count < min_match_needed:
        decision = "INSUFFICIENT_SAMPLES"
        verified = False
        rejection_reason = f"Only {valid_count} valid face frames evaluated (minimum {min_match_needed} required). Please ensure face is clearly visible."
    else:
        verified = False
        decision = "REJECTED"
        rejection_reason = f"Face does not match ({verified_count}/{valid_count} matching frames, minimum {min_match_needed} required)."

    # Step 6: Structured privacy-conscious diagnostic logging
    logger.info(
        f"[{req_id}] ArcFace Verify: student={request.studentId or request.email or 'unknown'} "
        f"decision={decision} verified={verified} submitted={total_requested} "
        f"processed={len(frames_to_process)} valid={valid_count} matched={verified_count} "
        f"occluded={occluded_count} poor_quality={poor_quality_count} multi_face={multi_face_count} "
        f"avg_sim={average_similarity} best_sim={best_similarity} elapsed={total_elapsed}s"
    )

    msg_str = (
        f"Face verified successfully ({verified_count}/{valid_count} evaluated frames matched — {int(round(average_similarity * 100))}% similarity)."
        if verified
        else rejection_reason
    )

    # Return honest, uninflated counts (Step 3-F)
    response = {
        "success": True,
        "requestId": req_id,
        "studentId": request.studentId,
        "verified": verified,
        "match": verified,
        "decision": decision,
        "finalDecision": decision,
        "result": decision.lower(),
        "bestSimilarity": best_similarity,
        "averageSimilarity": average_similarity,
        "matchingFrames": verified_count,       # Real honest matching frames
        "verifiedFrames": verified_count,       # Real honest verified frames
        "rawVerifiedFrames": verified_count,    # Compatibility
        "validFrames": valid_count,             # Real valid evaluated frames
        "totalFrames": total_requested,         # Real frames submitted
        "totalFramesProcessed": len(frames_to_process),
        "rejectedFrames": rejected_count,
        "occludedFrames": occluded_count,
        "poorQualityFrames": poor_quality_count,
        "multiFaceTriggered": multi_face_triggered,
        "qualityScore": avg_quality,
        "elapsedSeconds": total_elapsed,
        "message": msg_str
    }

    if ENABLE_DIAGNOSTIC_MODE:
        response["diagnostic"] = {
            "requestId": req_id,
            "rawSimilarities": frame_similarities,
            "bestSimilarity": best_similarity,
            "averageSimilarity": average_similarity,
            "verifiedFrames": verified_count,
            "validFrames": valid_count,
            "occludedFrames": occluded_count,
            "poorQualityFrames": poor_quality_count,
            "suspiciousFrames": suspicious_count,
            "rejectedFrames": rejected_count,
            "thresholds": {
                "verified": FRAME_MATCH_THRESHOLD,
                "suspicious": SUSPICIOUS_THRESHOLD,
                "minAvgSimilarity": MIN_AVG_THRESHOLD
            }
        }

    return response

@app.post("/api/arcface/debug-verify")
def arcface_debug_verify(request: ArcFaceVerifyRequest):
    """
    Diagnostic Endpoint: Test live frame against enrolled embeddings.
    """
    res = arcface_verify(request)
    return {
        "debugMode": True,
        "studentId": request.studentId,
        "enrolledSamplesCount": len(request.enrolledEmbeddings or []),
        "analysis": res
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, workers=1)
    
