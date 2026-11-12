# Smart AI Attendance System 📷✨

A fast, privacy-first, browser-based student attendance system that uses real-time facial recognition powered by **face-api.js** and **localStorage**.

> **100% Client-Side Privacy**: Biometric face descriptors, camera streams, and attendance records are processed and saved exclusively on your local device. No facial data or video ever leaves your browser.

---

## 🌟 Key Features

### 1. Student Registration & Biometric Enrollment
- **Multi-Angle Capture**: Collects 3 to 5 face samples per student with a live alignment oval.
- **Biometric Descriptor Computation**: Generates 128-dimensional embedding vectors for each sample and crops high-res profile thumbnails.
- **Directory & Roster**: Searchable student roster with sample inspection, profile editing, and deletion.

### 2. Real-Time Face Recognition Attendance
- **Live Video Feed**: Tracks and identifies multiple faces simultaneously with real-time bounding boxes.
  - 🟢 **Recognized Student**: Displays student name, roll number, and match percentage.
  - 🔵 **Already Marked**: Detects previous check-in for the day and informs the user.
  - 🟡 **Unknown Person**: Flags unrecognized individuals and prevents unauthorized attendance.
- **Duplicate Prevention**: Enforces a strict one-record-per-student-per-day rule.
- **Audio & Visual Feedback**: Synthesized Web Audio chime and toast notifications upon verification.
- **Anti-Spoofing Liveness Hint**: Real-time Eye Aspect Ratio (EAR) blink detection using 68-point landmarks.
- **Simulation Mode**: Test matching and attendance logging without needing a physical camera.

### 3. Attendance Analytics Dashboard
- **KPI Metrics**: Total Enrolled, Present Today, Absent Today, Attendance Percentage with progress bars.
- **7-Day Trend Chart**: Weekly attendance volume visualization.
- **Absent Student Roster**: Instant list of students who haven't checked in, with 1-click manual marking.

### 4. Records & Reporting
- Comprehensive attendance ledger with 12-hour AM/PM timestamps, days, and dates.
- Search by student name or roll number, and filter by date or division.
- **Export to CSV**: Download spreadsheet reports instantly.
- **Printable Sheet**: Formatted view for physical printouts or PDF export (`window.print()`).

---

## 🚀 Getting Started

### Option A: Standard Full App (React + Vite)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

### Option B: Standalone Single File (No Node.js Required)

You can also run the self-contained `standalone.html` file by double-clicking it or serving it with any static web server (such as GitHub Pages):

1. Open `standalone.html` in Chrome, Edge, Safari, or Firefox.
2. Grant camera permissions when prompted.

---

## 🛠️ Built With

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Face Recognition**: [@vladmandic/face-api](https://github.com/vladmandic/face-api) (TinyFaceDetector, 68-Point Facial Landmarks, FaceRecognitionNet)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Audio**: Web Audio API Synthesizer
- **Storage**: Browser LocalStorage API

---

## 🔒 Biometric Data Policy

All biometric computations (face detection, landmark mapping, and feature vector matching) occur in volatile GPU/CPU memory inside your browser via WebGL and WebAssembly. No biometrics are transmitted to any cloud servers.
