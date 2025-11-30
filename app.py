import os
import time
import uuid
import base64
from collections import deque
from datetime import datetime

import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
from flask import Flask, render_template, request, jsonify, Response
from ultralytics import YOLO

MODEL_DIR = "models"

import threading
face_mesh_lock = threading.Lock()

engagement_model = tf.keras.models.load_model(
    os.path.join(MODEL_DIR, "student_engagement_modelCNN.h5")
)
phone_model = YOLO(os.path.join(MODEL_DIR, "yolov8n.pt"))
face_cascade = cv2.CascadeClassifier(
    os.path.join(MODEL_DIR, "haarcascade_frontalface_default.xml")
)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True, max_num_faces=1)

img_height, img_width = 128, 128
class_names = ["Engaged", "Not Engaged"]

LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

EAR_THRESHOLD = 0.20
YAWN_THRESH = 0.6
SMOOTH_WINDOW = 5

def decode_image_b64(b64str):
    if "," in b64str:
        b64str = b64str.split(",")[1]
    try:
        img_data = base64.b64decode(b64str)
        arr = np.frombuffer(img_data, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except:
        return None

def eye_aspect_ratio(landmarks, idx, w, h):
    try:
        pts = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in idx])
        A = np.linalg.norm(pts[1] - pts[5])
        B = np.linalg.norm(pts[2] - pts[4])
        C = np.linalg.norm(pts[0] - pts[3])
        return (A + B) / (2.0 * C) if C != 0 else 0
    except:
        return 0

def mouth_aspect_ratio(landmarks, w, h):
    try:
        top = np.array([landmarks[13].x * w, landmarks[13].y * h])
        bottom = np.array([landmarks[14].x * w, landmarks[14].y * h])
        left = np.array([landmarks[78].x * w, landmarks[78].y * h])
        right = np.array([landmarks[308].x * w, landmarks[308].y * h])
        A = np.linalg.norm(top - bottom)
        B = np.linalg.norm(left - right)
        return A / B if B != 0 else 0
    except:
        return 0


sessions = {}

def create_session():
    return {
        "id": str(uuid.uuid4()),
        "start_time": time.time(),
        "frames": 0,
        "engaged_count": 0,
        "not_engaged_count": 0,
        "phone_count": 0,
        "blink_count": 0,
        "yawn_times": deque(),
        "away_start": None,
        "eyes_closed_start": None,
        "blink_state": False,
        "yaw_history": deque(maxlen=SMOOTH_WINDOW),
        "pitch_history": deque(maxlen=SMOOTH_WINDOW),
        "EAR_history": deque(maxlen=SMOOTH_WINDOW),
        "MAR_history": deque(maxlen=SMOOTH_WINDOW),
    }


def process_frame(frame, state):
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(25, 25))
    engagement_label, engagement_prob = "No Face", 0.0
    face_away = False

    if len(faces) > 0:
        x, y, w_face, h_face = sorted(
            faces, key=lambda f: f[2] * f[3], reverse=True
        )[0]
        face_roi = frame[y:y + h_face, x:x + w_face]
        try:
            img = cv2.resize(face_roi, (img_height, img_width))
            img = img.astype("float32") / 255.0
            pred = float(engagement_model.predict(np.expand_dims(img, 0), verbose=0)[0][0])
        except:
            pred = 0.0

        engagement_label = "Engaged" if pred >= 0.5 else "Not Engaged"
        engagement_prob = pred if pred >= 0.5 else 1 - pred

 
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    with face_mesh_lock:
        mesh = face_mesh.process(rgb)

    now = time.time()
    EAR = MAR = 0

    if mesh.multi_face_landmarks:
        lm = mesh.multi_face_landmarks[0].landmark

        EAR_L = eye_aspect_ratio(lm, LEFT_EYE, w, h)
        EAR_R = eye_aspect_ratio(lm, RIGHT_EYE, w, h)
        raw_EAR = (EAR_L + EAR_R) / 2.0
        raw_MAR = mouth_aspect_ratio(lm, w, h)

        state["EAR_history"].append(raw_EAR)
        state["MAR_history"].append(raw_MAR)
        EAR = np.mean(state["EAR_history"])
        MAR = np.mean(state["MAR_history"])

        if EAR < EAR_THRESHOLD and not state["blink_state"]:
            state["blink_count"] += 1
            state["blink_state"] = True
        elif EAR >= EAR_THRESHOLD:
            state["blink_state"] = False

        if MAR > YAWN_THRESH:
            state["yawn_times"].append(now)
            while state["yawn_times"] and now - state["yawn_times"][0] > 60:
                state["yawn_times"].popleft()

    phone_detected = False
    try:
        results = phone_model(frame, verbose=False)
        for r in results[0].boxes:
            if int(r.cls[0]) == 67 and float(r.conf[0]) > 0.45:
                phone_detected = True
                break
    except:
        pass

   
    state["frames"] += 1
    if engagement_label == "Engaged":
        state["engaged_count"] += 1
    elif engagement_label == "Not Engaged":
        state["not_engaged_count"] += 1
    if phone_detected:
        state["phone_count"] += 1

    return {
        "engagement_label": engagement_label,
        "engagement_prob": round(float(engagement_prob), 3),
        "phone_detected": phone_detected,
        "EAR": round(float(EAR), 3),
        "MAR": round(float(MAR), 3),
        "blink_count": state["blink_count"],
        "yawns": len(state["yawn_times"]),
        "frames_total": state["frames"],
    }



from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__, static_folder="static", template_folder="templates")

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///reports.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.String(100))
    session_time = db.Column(db.String(50))
    feedback = db.Column(db.Text)

with app.app_context():
    db.create_all()


@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/focus")
def focus():
    return render_template("index.html")


@app.route("/start_session", methods=["POST"])
def start_session():
    data = request.get_json()
    timer = int(data.get("timer_minutes", 0))

    sess = create_session()
    sess["timer_minutes"] = timer

    sessions[sess["id"]] = sess

    return jsonify({"session_id": sess["id"], "timer_minutes": timer})


@app.route("/analyze_frame", methods=["POST"])
def analyze_frame():
    data = request.get_json()
    session_id = data.get("session_id")
    img_b64 = data.get("image")

    if not session_id or session_id not in sessions:
        return jsonify({"error": "invalid session_id"}), 400

    frame = decode_image_b64(img_b64)
    if frame is None:
        return jsonify({"error": "invalid image"}), 400

    result = process_frame(frame, sessions[session_id])
    return jsonify({"frame_result": result})



@app.route("/end_session", methods=["POST"])
def end_session():
    """
    Robust end_session: tolerates race conditions (multiple requests),
    missing session ids and always returns a well-formed JSON response.
    """
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get("session_id")

    
        if not session_id:
            return jsonify({"error": "missing session_id"}), 400

     
        s = sessions.pop(session_id, None)
        if s is None:
            return jsonify({"error": "session not found or already ended"}), 400

        total_frames = max(s.get("frames", 0), 1)
        engaged_pct = round(s.get("engaged_count", 0) / total_frames * 100, 2)
        not_engaged_pct = round(s.get("not_engaged_count", 0) / total_frames * 100, 2)
        phone_pct = round(s.get("phone_count", 0) / total_frames * 100, 2)
        duration = round(time.time() - s.get("start_time", time.time()), 1)

        report = {
            "session_id": s.get("id"),
            "start_time": datetime.fromtimestamp(s.get("start_time", time.time())).strftime("%Y-%m-%d %H:%M:%S"),
            "duration_seconds": duration,
            "frames": s.get("frames", 0),
            "engaged_pct": engaged_pct,
            "not_engaged_pct": not_engaged_pct,
            "phone_pct": phone_pct,
            "blinks": s.get("blink_count", 0),
            "yawns": len(s.get("yawn_times", [])),
        }

        return jsonify({"report": report}), 200

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "internal_server_error"}), 500



@app.route("/feedback", methods=["POST"])
def save_feedback():
    data = request.get_json()

    new_entry = Report(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        session_time=data.get("session_time"),
        feedback=data.get("feedback")
    )

    db.session.add(new_entry)
    db.session.commit()

    return jsonify({"status": "saved"})

def check_auth(username, password):
    
    return username == "admin" and password == "mypassword"

def authenticate():
    return Response(
        'Could not verify your access', 401,
        {'WWW-Authenticate': 'Basic realm="Login Required"'}
    )

@app.route("/view_feedback")
def view_feedback():
    auth = request.authorization
    if not auth or not check_auth(auth.username, auth.password):
        return authenticate()
    
    all_feedback = Report.query.all()
    
 
    html = """
            <h2>All Feedback</h2>
            <table border='1' style='border-collapse: collapse; width: 100%;'>
            <tr style='background-color: #4CAF50; color: white;'>
            <th>Timestamp</th><th>Session Time</th><th>Feedback</th>
            </tr>
        """
    for i, f in enumerate(all_feedback):
        bg ="#f2f2f2" if i % 2 == 0 else "white"  
        html += f"<tr style='background-color: {bg};'><td>{f.timestamp}</td><td>{f.session_time}</td><td>{f.feedback}</td></tr>"
        html += "</table>"
    return html

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
