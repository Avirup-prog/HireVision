# HireVision 🎯
### AI-Powered Intelligent Technical Interview & Automated Candidate Assessment Platform

HireVision is an enterprise-grade AI technical interview platform designed to conduct dynamic, proctored interviews and automate objective candidate scoring using Large Language Models (Groq LLaMA 3.3).

---

## 🌟 Key Features

### 👤 Candidate Portal
* **6-Digit PIN Launchpad**: Segmented, auto-advancing PIN input for frictionless interview lobby access.
* **Pre-Flight Hardware Check**: Real-time microphone audio metering & camera calibration before test entry.
* **AI Posture & Framing Calibration**: BlazeFace neural mesh framing guide with distance checks and a 2-second stability hold.
* **My Resumes Vault**: Persistent resume storage backed by Firestore with direct dropdown selection during application.
* **Interview Q&A Room**: Interactive AI interviewer with real-time speech-to-text, questions adapted to candidate resume context, and automated proctoring alerts.
* **My Interviews History**: Comprehensive record of past interviews with score breakdown, status tracking, and transcripts.

### 👔 Recruiter Intelligence Dashboard
* **Executive Hiring Velocity Command Center**: High-impact KPI bento grid tracking talent pool, active campaigns, AI evaluations, and conversion rates.
* **Live Waiting Room & Knocking Alert**: Real-time Firestore listener alerting recruiters when candidates enter the lobby, with 1-click **Admit** or **Deny**.
* **4-Stage Pipeline Funnel**: Visual tracking across Applied → Screened → Evaluated → Shortlisted.
* **Active Interview Access Codes**: Quick copy widget for 6-digit access codes.
* **Top Talent Leaderboard**: Real-time candidate ranking by AI match score, search filters, and 1-click **Applicant Review** drawer.

---

## 🛠️ Architecture & Tech Stack

* **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons
* **Backend**: FastAPI (Python), Uvicorn, PyMuPDF / pdfminer
* **AI & NLP**: Groq LLaMA 3.3 (high-throughput structured Q&A generation & rubric scoring)
* **Computer Vision**: TensorFlow.js / BlazeFace (real-time face presence & stability proctoring)
* **Database & Auth**: Google Firebase (Firestore real-time listeners & Firebase Authentication)

---

## 🚀 Getting Started

### 1. Prerequisites
* **Node.js** (v18+) & **npm**
* **Python** (v3.10+)
* A **Groq Cloud API Key** (for LLM inference)
* A **Firebase Project** (Firestore & Auth enabled)

---

### 2. Backend Setup
1. Open a terminal in the project root directory.
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure your `.env` file:
   ```bash
   cp .env.example .env
   ```
   Add your `GROQ_API_KEY` and optional `GEMINI_API_KEY`.
5. Start the FastAPI backend server:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

---

### 3. Frontend Setup
1. In a new terminal, navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Access the web application at `http://localhost:5173`.

---

## 🔒 Security & Privacy
* Real API keys (`.env`) and user-uploaded resumes (`backend/uploads/`) are protected via `.gitignore` and never committed to source control.
