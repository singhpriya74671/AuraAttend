import base64
import json
import io
import os
import numpy as np
from PIL import Image

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    DeepFace = None

def _get_fernet():
    try:
        from cryptography.fernet import Fernet
        import base64, hashlib
        key_str = os.getenv("FACE_EMBED_KEY", "AuraAttendFaceKey123456789012345")
        key = base64.urlsafe_b64encode(hashlib.sha256(key_str.encode()).digest())
        return Fernet(key)
    except ImportError:
        return None

def _encrypt_embedding(embedding: list) -> str:
    fernet = _get_fernet()
    data = json.dumps(embedding).encode()
    if fernet:
        return fernet.encrypt(data).decode()
    return json.dumps(embedding)

def _decrypt_embedding(stored: str) -> list:
    fernet = _get_fernet()
    if fernet:
        try:
            return json.loads(fernet.decrypt(stored.encode()))
        except Exception:
            pass
    return json.loads(stored)
try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    MEDIAPIPE_AVAILABLE = True
except (ImportError, AttributeError):
    MEDIAPIPE_AVAILABLE = False
    mp_face_mesh = None
from app.models.student import FaceEmbedding

# Landmark indices for EAR (Eye Aspect Ratio) — used for blink/drowsiness
_LEFT_EYE = [33, 160, 158, 133, 153, 144]
_RIGHT_EYE = [362, 385, 387, 263, 373, 380]


def _b64_to_image(b64_str: str) -> np.ndarray:
    data = base64.b64decode(b64_str.split(",")[-1])
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(img)


def _eye_aspect_ratio(landmarks, indices, w, h):
    pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices]
    A = np.linalg.norm(np.subtract(pts[1], pts[5]))
    B = np.linalg.norm(np.subtract(pts[2], pts[4]))
    C = np.linalg.norm(np.subtract(pts[0], pts[3]))
    return (A + B) / (2.0 * C) if C > 0 else 0


def get_embedding(image_array: np.ndarray) -> list:
    if not DEEPFACE_AVAILABLE:
        raise RuntimeError("Face recognition not available on this server.")
    try:
        result = DeepFace.represent(img_path=image_array, model_name="Facenet", enforce_detection=True)
    except Exception:
        result = DeepFace.represent(img_path=image_array, model_name="Facenet", enforce_detection=False)
    return result[0]["embedding"]


def register_face(student_id: int, image_b64: str, replace: bool = True) -> dict:
    img_array = _b64_to_image(image_b64)
    try:
        embedding = get_embedding(img_array)
    except Exception as e:
        return {"success": False, "error": str(e)}

    from app import db
    existing_count = FaceEmbedding.query.filter_by(student_id=student_id).count()
    if replace:
        # Dashboard update — replace all existing embeddings
        FaceEmbedding.query.filter_by(student_id=student_id).delete()
        db.session.flush()
        is_primary = True
    else:
        # Multi-angle registration — first image is primary, rest are secondary
        is_primary = existing_count == 0

    fe = FaceEmbedding(
        student_id=student_id,
        embedding=_encrypt_embedding(embedding),
        is_primary=is_primary,
    )
    db.session.add(fe)
    db.session.commit()
    return {"success": True}


def verify_face(student_id: int, image_b64: str) -> dict:
    """Compare against ALL stored embeddings and return best match."""
    stored_all = FaceEmbedding.query.filter_by(student_id=student_id).all()
    if not stored_all:
        return {"match": False, "confidence": 0.0, "liveness": False, "mood_score": 0.0,
                "error": "No face registered"}

    img_array = _b64_to_image(image_b64)
    h, w = img_array.shape[:2]

    try:
        live_embedding = get_embedding(img_array)
    except Exception as e:
        return {"match": False, "confidence": 0.0, "liveness": False, "mood_score": 0.0,
                "error": str(e)}

    live_emb = np.array(live_embedding)
    best_sim = 0.0
    for stored in stored_all:
        stored_emb = np.array(_decrypt_embedding(stored.embedding))
        norm = np.linalg.norm(stored_emb) * np.linalg.norm(live_emb)
        if norm > 0:
            sim = float(np.dot(stored_emb, live_emb) / norm)
            best_sim = max(best_sim, sim)

    match = best_sim > 0.7

    liveness = False
    mood_score = 1.0
    if MEDIAPIPE_AVAILABLE and mp_face_mesh:
        with mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1) as mesh:
            results = mesh.process(img_array)
            if results.multi_face_landmarks:
                lm = results.multi_face_landmarks[0].landmark
                left_ear = _eye_aspect_ratio(lm, _LEFT_EYE, w, h)
                right_ear = _eye_aspect_ratio(lm, _RIGHT_EYE, w, h)
                avg_ear = (left_ear + right_ear) / 2
                liveness = avg_ear > 0.15
                mood_score = min(1.0, avg_ear / 0.3)
    else:
        liveness = True

    return {
        "match": match,
        "confidence": round(best_sim, 4),
        "liveness": liveness,
        "mood_score": round(mood_score, 4),
    }
