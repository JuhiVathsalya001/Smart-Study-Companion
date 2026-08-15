# Smart Study Companion

An AI-powered study monitoring system that uses **computer vision and deep learning** to analyze student engagement and distractions during study sessions.

The application uses a webcam to detect engagement, mobile-phone usage, blinking, and yawning, and provides a summary of the study session.

---

## ✨ Features

*  **Engagement Detection** — CNN-based classification of student engagement.
*  **Phone Detection** — YOLOv8 detects mobile-phone usage.
*  **Blink Detection** — MediaPipe Face Mesh + Eye Aspect Ratio (EAR).
*  **Yawn Detection** — MediaPipe Face Mesh + Mouth Aspect Ratio (MAR).
*  **Focus Sessions** — Start and track timed study sessions.
*  **Session Reports** — View engagement, distraction, blink, yawn, and phone-detection statistics.
*  **Voice Reminders** — Browser-based reminders for prolonged distraction.
*  **Feedback System** — Store session ratings and feedback using SQLite.

---

## 🛠️ Tech Stack

* **Python**
* **Flask**
* **TensorFlow / Keras**
* **YOLOv8 / Ultralytics**
* **OpenCV**
* **MediaPipe**
* **NumPy**
* **SQLite / Flask-SQLAlchemy**
* **HTML, CSS, JavaScript**

---

## How It Works

```text
Webcam
   │
   ▼
Flask Backend
   │
   ├── CNN → Engagement Detection
   │
   ├── YOLOv8 → Phone Detection
   │
   ├── MediaPipe → Facial Landmarks
   │                ├── EAR → Blink Detection
   │                └── MAR → Yawn Detection
   │
   ▼
Session Analytics
   │
   ▼
Study Session Report
```

---

# ⚙️ Setup & Installation

## 1. Clone the Repository

```bash
git clone https://github.com/JuhiVathsalya001/Smart-Study-Companion.git
cd Smart-Study-Companion
```

## 2. Create a Virtual Environment

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

The main dependencies include:

```text
Flask
Flask-SQLAlchemy
TensorFlow
OpenCV
MediaPipe
Ultralytics
NumPy
```

---

## 4. Download the Required Models

The trained model files are **not included directly in this GitHub repository** because some of the files exceed GitHub's file upload limit.

The required model files are available in the following Google Drive folder:

👉 **[Download the required models from Google Drive](https://drive.google.com/drive/folders/1FCKFRiEl4Lvxs1SJ5zi-iAWXtErip7j7?usp=drive_link)**

Download the models and place them inside a `models` folder in the project root.

The required structure is:

```text
Smart-Study-Companion/
│
├── models/
│   ├── student_engagement_modelCNN.h5
│   ├── yolov8n.pt
│   └── haarcascade_frontalface_default.xml
│
├── static/
├── templates/
├── app.py
├── requirements.txt
└── README.md
```

**Important:** The application will not work correctly without the required model files.

---

## 5. Configure Admin Credentials

The feedback page uses environment variables for administrator authentication.

### Windows CMD

```bash
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=your_password
```

### Windows PowerShell

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="your_password"
```

Do **not** commit your password to GitHub.

---

## 6. Run the Application

```bash
python app.py
```

Open your browser and go to:

```text
http://localhost:5000
```

Allow webcam access when prompted.

---

# Using the Application

1. Open the application.
2. Enter the **Focus Room**.
3. Select a study duration.
4. Start the session.
5. Allow webcam access.
6. Study normally while the system analyzes the webcam feed.
7. End the session.
8. View the generated session statistics.
9. Submit feedback if desired.

---

## Session Metrics

The application tracks metrics such as:

* Session duration
* Frames analyzed
* Engagement percentage
* Non-engagement percentage
* Phone detection
* Blink count
* Yawn count

---

## 📁 Project Structure

```text
Smart-Study-Companion/
│
├── models/                         # Download separately
│   ├── student_engagement_modelCNN.h5
│   ├── yolov8n.pt
│   └── haarcascade_frontalface_default.xml
│
├── static/
│   ├── css/
│   └── js/
│
├── templates/
│   ├── landing.html
│   └── index.html
│
├── app.py
├── requirements.txt
├── .gitignore
└── README.md
```

---

## ⚠️ Notes

* A working webcam is required for real-time monitoring.
* Detection accuracy can be affected by lighting, camera angle, and occlusion.
* The required ML model files must be downloaded separately and placed inside the `models/` directory.
* The model files are hosted externally because of GitHub's file-size restrictions.
* The application is currently intended for **local use**.
* The system is a productivity tool and is **not a medical or psychological assessment**.

---

## Future Improvements

* Historical study analytics
* Daily and weekly productivity tracking
* Improved engagement models
* Personalized distraction thresholds
* User accounts
* Cloud-based reports
* Production deployment
* Mobile application

---

## Author

**Juhi Vathsalya Kothapalli**

B.Tech — Computer Science & Engineering (AI & ML)

GitHub:
https://github.com/JuhiVathsalya001

---

## ⭐ Acknowledgements

This project uses open-source technologies including:

* TensorFlow
* Keras
* Ultralytics YOLO
* OpenCV
* MediaPipe
* Flask
* SQLite
