import base64
import io
import numpy as np
from PIL import Image

try:
    import mediapipe as mp
    _mp_face_mesh = mp.solutions.face_mesh
    MEDIAPIPE_AVAILABLE = True
except (ImportError, AttributeError):
    MEDIAPIPE_AVAILABLE = False
    _mp_face_mesh = None

_LEFT_EYE = [33, 160, 158, 133, 153, 144]
_RIGHT_EYE = [362, 385, 387, 263, 373, 380]
_LEFT_IRIS = [474, 475, 476, 477]
_RIGHT_IRIS = [469, 470, 471, 472]
_NOSE_TIP = 1
_FOREHEAD = 10
_CHIN = 152
_LEFT_EAR_PT = 234
_RIGHT_EAR_PT = 454


def _b64_to_array(b64: str) -> np.ndarray:
    data = base64.b64decode(b64.split(",")[-1])
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(img)


def _ear(landmarks, indices, w, h):
    pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices]
    A = np.linalg.norm(np.subtract(pts[1], pts[5]))
    B = np.linalg.norm(np.subtract(pts[2], pts[4]))
    C = np.linalg.norm(np.subtract(pts[0], pts[3]))
    return (A + B) / (2.0 * C) if C > 0 else 0


def analyze_attention(image_b64: str) -> dict:
    """
    Returns:
        eye_openness: 0-1
        blink_detected: bool
        head_pose: "forward" | "left" | "right" | "down" | "up"
        attention_score: 0-1
        state: "attentive" | "distracted" | "drowsy"
    """
    if not MEDIAPIPE_AVAILABLE:
        return _default_result()

    try:
        img = _b64_to_array(image_b64)
        h, w = img.shape[:2]

        with _mp_face_mesh.FaceMesh(
            static_image_mode=True, max_num_faces=1,
            refine_landmarks=True, min_detection_confidence=0.5
        ) as mesh:
            results = mesh.process(img)

        if not results.multi_face_landmarks:
            return {"error": "No face detected", "attention_score": 0.0, "state": "absent"}

        lm = results.multi_face_landmarks[0].landmark

        # Eye openness (EAR)
        left_ear = _ear(lm, _LEFT_EYE, w, h)
        right_ear = _ear(lm, _RIGHT_EYE, w, h)
        avg_ear = (left_ear + right_ear) / 2
        eye_openness = min(avg_ear / 0.35, 1.0)
        blink_detected = avg_ear < 0.15

        # Head pose — use nose tip relative to face width
        nose = lm[_NOSE_TIP]
        left_ear_pt = lm[_LEFT_EAR_PT]
        right_ear_pt = lm[_RIGHT_EAR_PT]
        forehead = lm[_FOREHEAD]
        chin = lm[_CHIN]

        face_width = abs(right_ear_pt.x - left_ear_pt.x)
        face_height = abs(chin.y - forehead.y)

        nose_offset_x = (nose.x - (left_ear_pt.x + right_ear_pt.x) / 2) / face_width if face_width > 0 else 0
        nose_offset_y = (nose.y - (forehead.y + chin.y) / 2) / face_height if face_height > 0 else 0

        if nose_offset_x > 0.15:
            head_pose = "right"
        elif nose_offset_x < -0.15:
            head_pose = "left"
        elif nose_offset_y > 0.15:
            head_pose = "down"
        elif nose_offset_y < -0.15:
            head_pose = "up"
        else:
            head_pose = "forward"

        # Attention score
        pose_score = 1.0 if head_pose == "forward" else 0.3
        eye_score = eye_openness
        attention_score = round((pose_score * 0.5 + eye_score * 0.5), 3)

        if attention_score > 0.65 and not blink_detected:
            state = "attentive"
        elif blink_detected or avg_ear < 0.18:
            state = "drowsy"
        else:
            state = "distracted"

        return {
            "eye_openness": round(eye_openness, 3),
            "blink_detected": blink_detected,
            "head_pose": head_pose,
            "attention_score": attention_score,
            "state": state,
        }

    except Exception as e:
        return {"error": str(e), "attention_score": 0.5, "state": "unknown"}


def _default_result():
    return {
        "eye_openness": 1.0,
        "blink_detected": False,
        "head_pose": "forward",
        "attention_score": 1.0,
        "state": "attentive",
    }
