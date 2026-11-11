from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from typing import Optional, List
import json
import os
import shutil
import time
import re
import urllib.parse
import socket
import ipaddress
import requests
import uuid
import smtplib
import email.utils
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pydantic import BaseModel

from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

# Dynamically resolve root and backend environment configurations across Windows/Linux/Render
root_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
if os.path.exists(root_env_path):
    load_dotenv(dotenv_path=root_env_path)

backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(backend_env_path):
    load_dotenv(dotenv_path=backend_env_path)

# Ensure project root is in sys.path so 'backend.nlp...' imports work from any directory
import sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from backend.nlp.interview_engine import GroqClient, InterviewConfig, build_interview, extract_text, evaluate_answer, Question
except ModuleNotFoundError:
    from nlp.interview_engine import GroqClient, InterviewConfig, build_interview, extract_text, evaluate_answer, Question

app = FastAPI(title="HireVision AI API", version="1.0.0")

# =========================================================================
# CORS RESTRICTION
# =========================================================================

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://hirevision.vercel.app",
    "https://hirevision-5c3d2.web.app",
    "https://hirevision-5c3d2.firebaseapp.com",
]

env_frontend = os.getenv("FRONTEND_URL")
if env_frontend:
    ALLOWED_ORIGINS.extend([o.strip() for o in env_frontend.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "resumes"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "recordings"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

@app.get("/")
def health_check():
    return {"status": "API is running successfully!"}

# =========================================================================
# SECURITY DEFENSE HELPERS (Path Traversal & SSRF Prevention)
# =========================================================================

def is_safe_filename(filename: str, base_dir: str) -> tuple[bool, str]:
    """
    Validates that a filename does not contain path traversal characters
    and that its canonical path resolves strictly inside base_dir.
    """
    if not filename or not filename.strip():
        return False, "Filename is required."
    clean = filename.strip()
    
    # 1. Reject path separators and parent directory tokens
    if "/" in clean or "\\" in clean or ".." in clean:
        return False, "Path traversal sequence detected."
        
    # 2. Extract basename and validate allowed characters (alphanumeric, dot, underscore, dash)
    safe_name = os.path.basename(clean)
    if not safe_name or safe_name in ('.', '..'):
        return False, "Invalid filename."
        
    if not re.match(r'^[a-zA-Z0-9_.-]+$', safe_name):
        return False, "Filename contains invalid or dangerous characters."
        
    # 3. Canonical path sandboxing
    canonical_base = os.path.abspath(base_dir)
    target = os.path.abspath(os.path.join(canonical_base, safe_name))
    if os.path.commonpath([canonical_base, target]) != canonical_base or target == canonical_base:
        return False, "Path resolution escaped base directory."
        
    return True, target


def is_safe_external_url(url: str) -> tuple[bool, str]:
    """
    Validates that an external URL is safe to fetch and does not target internal services,
    cloud metadata services (169.254.169.254), or private IP networks (SSRF prevention).
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, "Only HTTP and HTTPS URLs are permitted."

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL hostname."

        # Disallow loopback, metadata, or cloud internal hostnames
        blocked_hostnames = {
            "localhost",
            "metadata.google.internal",
            "instance-data",
            "169.254.169.254"
        }
        if hostname.lower() in blocked_hostnames or hostname.endswith(".internal"):
            return False, "Access to internal hostnames is prohibited."

        # Whitelist check for known trusted cloud storage providers
        trusted_storage_domains = (
            "firebasestorage.googleapis.com",
            "storage.googleapis.com",
            "drive.google.com"
        )
        if any(hostname.lower() == d or hostname.lower().endswith("." + d) for d in trusted_storage_domains):
            return True, "Trusted storage provider"

        # Resolve IP addresses and verify none are private, loopback, or link-local
        addr_info = socket.getaddrinfo(hostname, None)
        for item in addr_info:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
                or ip_str in ("0.0.0.0", "::")
            ):
                return False, f"URL resolves to restricted IP space ({ip_str})."

        return True, "Safe URL"
    except Exception as e:
        return False, f"URL resolution error: {str(e)}"

# =========================================================================
# RESUME STORAGE & RETRIEVAL ENDPOINTS
# =========================================================================

@app.post("/api/store-resume")
async def store_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    try:
        # Validate allowed resume file extension
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in {".pdf", ".docx", ".doc"}:
            raise HTTPException(status_code=400, detail="Only PDF, DOCX, and DOC resume files are permitted.")

        # Sanitize user_id to alphanumeric characters only
        safe_user_id = re.sub(r'[^a-zA-Z0-9_-]', '', user_id)
        if not safe_user_id:
            safe_user_id = "user"

        resumes_dir = os.path.abspath(os.path.join(UPLOADS_DIR, "resumes"))
        os.makedirs(resumes_dir, exist_ok=True)
        
        # Clean filename and create unique path
        safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename or "resume.pdf")
        unique_filename = f"{safe_user_id}_{int(time.time())}_{safe_name}"
        
        is_safe, target_or_err = is_safe_filename(unique_filename, resumes_dir)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Invalid filename: {target_or_err}")
            
        dest_path = target_or_err
        
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size = os.path.getsize(dest_path)
        formatted_size = f"{file_size / (1024*1024):.1f} MB" if file_size > 1024*1024 else f"{file_size / 1024:.0f} KB"
        
        file_url = f"http://localhost:8000/uploads/resumes/{unique_filename}"
        return {
            "name": file.filename,
            "url": file_url,
            "size": formatted_size
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.post("/api/upload-recording")
async def upload_interview_recording(
    file: UploadFile = File(...),
    candidate_uid: str = Form("anonymous"),
    interview_id: Optional[str] = Form(None),
    duration: Optional[float] = Form(None)
):
    try:
        # Validate allowed video extension
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in {".webm", ".mp4", ".mov", ".ogg"}:
            ext = ".webm"

        safe_uid = re.sub(r'[^a-zA-Z0-9_-]', '', candidate_uid) or "candidate"
        recordings_dir = os.path.abspath(os.path.join(UPLOADS_DIR, "recordings"))
        os.makedirs(recordings_dir, exist_ok=True)

        unique_filename = f"{safe_uid}_{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
        is_safe, target_or_err = is_safe_filename(unique_filename, recordings_dir)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Invalid filename: {target_or_err}")

        dest_path = target_or_err
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(dest_path)
        formatted_size = f"{file_size / (1024*1024):.1f} MB" if file_size > 1024*1024 else f"{file_size / 1024:.0f} KB"
        file_url = f"http://localhost:8000/uploads/recordings/{unique_filename}"

        return {
            "status": "success",
            "url": file_url,
            "filename": unique_filename,
            "size": formatted_size,
            "duration": duration
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.delete("/api/delete-resume")
async def delete_stored_resume(filename: str):
    try:
        resumes_dir = os.path.abspath(os.path.join(UPLOADS_DIR, "resumes"))
        is_safe, result = is_safe_filename(filename, resumes_dir)
        if not is_safe:
            raise HTTPException(status_code=400, detail=f"Security violation: {result}")

        target = result
        if os.path.exists(target) and os.path.isfile(target):
            os.remove(target)
            return {"success": True, "message": f"Successfully deleted {os.path.basename(target)}"}
        return {"success": False, "message": "File not found"}
    except HTTPException as he:
        raise he
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/upload-resume")
async def upload_resume(
    file: Optional[UploadFile] = File(None),
    resume_url: Optional[str] = Form(None),
    config: Optional[str] = Form(None),
    focusedSkills: Optional[str] = Form(None)
):
    temp_file_path = f"temp_{uuid.uuid4()}.pdf"
    
    try:
        if file:
            with open(temp_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        elif resume_url:
            clean_url = resume_url.strip()
            # 1. Check if this is a locally stored resume in uploads/resumes/
            if "uploads/resumes/" in clean_url:
                local_fname = clean_url.split("uploads/resumes/")[-1]
                # Strip query parameters if present
                if "?" in local_fname:
                    local_fname = local_fname.split("?")[0]
                
                resumes_dir = os.path.abspath(os.path.join(UPLOADS_DIR, "resumes"))
                is_safe, result = is_safe_filename(local_fname, resumes_dir)
                if not is_safe:
                    return {"error": f"Invalid local resume reference: {result}"}
                    
                local_fpath = result
                if os.path.exists(local_fpath) and os.path.isfile(local_fpath):
                    shutil.copyfile(local_fpath, temp_file_path)
                else:
                    return {"error": f"Referenced resume file not found on server ({local_fname})."}
            else:
                # 2. External URL (e.g. Firebase Cloud Storage)
                is_safe_url, reason = is_safe_external_url(clean_url)
                if not is_safe_url:
                    return {"error": f"SSRF Security Block: {reason}"}
                    
                response = requests.get(clean_url, timeout=12, stream=True)
                response.raise_for_status()
                with open(temp_file_path, "wb") as buffer:
                    for chunk in response.iter_content(chunk_size=64 * 1024):
                        buffer.write(chunk)
        else:
            return {"error": "No file or URL provided"}

        raw_text = extract_text(temp_file_path)
        
        # Parse the frontend config into the new engine's expected format
        parsed_config = json.loads(config) if config else []
        parsed_skills = json.loads(focusedSkills) if focusedSkills else []
        
        question_counts = {}
        for sec in parsed_config:
            cat = sec.get("category", "General")
            count = int(sec.get("count", 1))
            question_counts[cat] = count
            
        cfg = InterviewConfig(
            job_title="Candidate Interview", 
            question_counts=question_counts,
            focus_skills=parsed_skills[:2] 
        )
        
        llm_client = GroqClient(api_key=os.getenv("GROQ_API_KEY"))
        plan = build_interview(llm_client, cfg, raw_text)

        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        return {
            "filename": file.filename if file else os.path.basename(resume_url or "resume.pdf"),
            "detected_skills": plan.profile.skills,
            "generated_questions": [q.model_dump() for q in plan.questions]
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
        return {"error": str(e)}

# =========================================================================
# INTERVIEW TRANSCRIPT & EVALUATION ENDPOINTS
# =========================================================================

class EvaluateRequest(BaseModel):
    questions: List[dict]
    answers: List[str]

class CleanTranscriptRequest(BaseModel):
    text: str

@app.post("/api/clean-transcript")
async def clean_transcript(data: CleanTranscriptRequest):
    if not data.text or len(data.text.strip()) < 5:
        return {"cleaned": data.text}
    
    try:
        llm_client = GroqClient(api_key=os.getenv("GROQ_API_KEY"))
        system = "You are a professional transcription autocorrect engine. The user provides a raw speech-to-text transcript from a software engineering interview. Your job is to fix phonetic spelling mistakes (e.g., 'maintain ability' -> 'maintainability', 'pie thon' -> 'Python') and basic grammar. DO NOT change the meaning, tone, or remove words. Return ONLY the cleaned text, nothing else."
        
        cleaned = llm_client.complete(system, data.text, max_tokens=1000)
        return {"cleaned": cleaned.strip()}
    except Exception as e:
        # If Groq fails, fallback to raw text immediately
        return {"cleaned": data.text}

@app.post("/api/evaluate-interview")
async def evaluate_interview(data: EvaluateRequest):
    try:
        llm_client = GroqClient(api_key=os.getenv("GROQ_API_KEY"))
        evaluations = []
        total_score = 0
        
        for i, q_dict in enumerate(data.questions):
            question = Question.model_validate(q_dict)
            answer = data.answers[i] if i < len(data.answers) else ""
            
            if not answer or len(answer.strip()) < 5:
                evaluations.append({
                    "score": 1,
                    "signals_hit": [],
                    "signals_missed": question.expected_signals,
                    "red_flags_seen": [],
                    "feedback": "Candidate did not provide a meaningful answer."
                })
                total_score += 1
                continue
            
            result = evaluate_answer(llm_client, question, answer)
            evaluations.append(result.model_dump())
            total_score += result.score
            time.sleep(1)  
            
        max_possible = len(data.questions) * 5
        score_out_of_10 = (total_score / max_possible) * 10 if max_possible > 0 else 0
        
        return {
            "evaluations": evaluations,
            "overall_score_out_of_10": round(score_out_of_10, 1)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# =========================================================================
# INTERVIEW INVITATION EMAILS
# =========================================================================

class InviteRequest(BaseModel):
    jobId: str
    jobTitle: str
    candidateEmails: List[str]
    startTime: Optional[str] = "Flexible"
    endTime: Optional[str] = "Open"
    recruiterName: Optional[str] = "Recruiter"
    customMessage: Optional[str] = ""

def generate_invite_text(job_id: str, job_title: str, start_time: str, end_time: str, recruiter_name: str, custom_message: str):
    launch_url = f"http://localhost:5173/login?code={job_id}"
    note_line = f"\nNote from Recruiter:\n\"{custom_message}\"\n" if custom_message and custom_message.strip() else ""
    return f"""Hello Candidate,

You have been invited by {recruiter_name} to complete your AI-proctored technical interview for the position of {job_title}.
{note_line}
Your 6-Digit Access PIN: {job_id}

Interview Details:
- Position: {job_title}
- Valid Window Start: {start_time or 'Flexible'}
- Valid Window End: {end_time or 'Open'}

Direct Interview Link:
{launch_url}

Pre-Flight System Checklist:
1. Ensure your webcam and microphone are connected and allowed in browser permissions.
2. Complete the session in a well-lit and quiet room.
3. Recommended browser: Google Chrome or Microsoft Edge.

Best regards,
HireVision Autonomous Technical Interview Platform
"""

def generate_invite_html(job_id: str, job_title: str, start_time: str, end_time: str, recruiter_name: str, custom_message: str):
    launch_url = f"http://localhost:5173/login?code={job_id}"
    year_str = str(time.localtime().tm_year)
    custom_quote = ""
    if custom_message and custom_message.strip():
        custom_quote = f'''<div style="margin: 0 0 24px 0; padding: 14px 18px; background-color: #0b1121; border-left: 4px solid #6366f1; border-radius: 8px; font-size: 13px; color: #cbd5e1; font-style: italic;">
          "{custom_message.strip()}"
        </div>'''

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Interview Invitation - HireVision</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #151e32; border: 1px solid #334155; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">HireVision</h1>
              <p style="margin: 6px 0 0 0; color: #e0e7ff; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1.5px;">Autonomous Technical Interview Invitation</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #ffffff; font-weight: 600;">Hello Candidate,</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                You have been invited by <strong style="color: #ffffff;">{recruiter_name}</strong> to complete your AI-proctored technical interview for the position of <strong style="color: #818cf8;">{job_title}</strong>.
              </p>
              
              {custom_quote}

              <!-- PIN Access Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1121; border: 1px dashed #6366f1; border-radius: 14px; margin: 20px 0 28px 0; padding: 20px; text-align: center;">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Your 6-Digit Access PIN</span>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #818cf8; letter-spacing: 10px; margin: 10px 0 6px 0;">{job_id}</div>
                    <span style="font-size: 12px; color: #64748b;">Keep this PIN safe. Enter it on the candidate launchpad to enter the waiting room.</span>
                  </td>
                </tr>
              </table>

              <!-- Schedule / Role Details -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #101728; border: 1px solid #1e293b; border-radius: 12px; margin-bottom: 28px; padding: 16px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Target Position:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">{job_title}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Valid Window Start:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">{start_time or 'Flexible'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Valid Window End:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">{end_time or 'Open'}</td>
                </tr>
              </table>

              <!-- Action CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="{launch_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
                      Launch Interview Studio &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Pre-Flight Checklist -->
              <div style="background-color: #0b1121; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 12px;">
                <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">Pre-Interview System Checklist</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.8; color: #94a3b8;">
                  <li>Webcam and microphone connected and allowed in browser permissions.</li>
                  <li>Well-lit and quiet room (AI proctor monitors biometric posture & gaze).</li>
                  <li>Recommended browser: Google Chrome or Microsoft Edge.</li>
                </ul>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0e1424; padding: 20px 40px; text-align: center; border-top: 1px solid #1e293b;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                &copy; {year_str} HireVision Autonomous Interview Platform. All rights reserved.<br>
                This is an automated interview invitation dispatched from your recruiter.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

@app.post("/api/send-interview-invites")
async def send_interview_invites(data: InviteRequest):
    try:
        raw_emails = data.candidateEmails
        valid_emails = []
        for em in raw_emails:
            clean = em.strip()
            if clean and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
                valid_emails.append(clean)
        
        if not valid_emails:
            return {"status": "error", "message": "No valid recipient email addresses provided."}
        
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")
        if smtp_pass:
            smtp_pass = smtp_pass.replace(" ", "")
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))

        raw_from = (os.getenv("SMTP_FROM") or "").strip().strip('"').strip("'")
        if raw_from and "<" in raw_from and ">" in raw_from:
            smtp_from = raw_from
        elif smtp_user:
            smtp_from = f"HireVision <{smtp_user}>"
        else:
            smtp_from = "HireVision <invites@hirevision.ai>"

        text_content = generate_invite_text(
            job_id=data.jobId,
            job_title=data.jobTitle,
            start_time=data.startTime or "Flexible",
            end_time=data.endTime or "Open",
            recruiter_name=data.recruiterName or "Your Recruiter",
            custom_message=data.customMessage or ""
        )

        html_content = generate_invite_html(
            job_id=data.jobId,
            job_title=data.jobTitle,
            start_time=data.startTime or "Flexible",
            end_time=data.endTime or "Open",
            recruiter_name=data.recruiterName or "Your Recruiter",
            custom_message=data.customMessage or ""
        )

        if smtp_user and smtp_pass:
            sent_count = 0
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                for recipient in valid_emails:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = f"Interview Invitation: {data.jobTitle} (PIN: {data.jobId})"
                    msg["From"] = smtp_from
                    msg["To"] = recipient
                    msg["Reply-To"] = smtp_user
                    msg["Date"] = email.utils.formatdate(localtime=True)
                    msg["Message-ID"] = email.utils.make_msgid(domain=smtp_user.split("@")[-1] if "@" in smtp_user else "gmail.com")
                    msg["X-Mailer"] = "HireVision Mail Engine 1.0"
                    msg["List-Unsubscribe"] = f"<mailto:{smtp_user}?subject=unsubscribe>"
                    
                    # 1. Attach plain text first
                    msg.attach(MIMEText(text_content, "plain", "utf-8"))
                    # 2. Attach HTML part second
                    msg.attach(MIMEText(html_content, "html", "utf-8"))

                    server.sendmail(smtp_user, recipient, msg.as_string())
                    sent_count += 1

            return {
                "status": "success",
                "mode": "live",
                "sentCount": sent_count,
                "recipients": valid_emails,
                "message": f"Successfully delivered {sent_count} live email invitation(s)!"
            }
        else:
            print(f"\n[DEV SIMULATION] Sent Interview Invite for Job '{data.jobTitle}' (PIN: {data.jobId})")
            print(f"Recipients ({len(valid_emails)}): {', '.join(valid_emails)}")
            return {
                "status": "success",
                "mode": "simulated",
                "sentCount": len(valid_emails),
                "recipients": valid_emails,
                "message": f"Simulated delivery to {len(valid_emails)} candidate(s)."
            }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

# =========================================================================
# WELCOME EMAILS (CANDIDATE & RECRUITER)
# =========================================================================

class WelcomeEmailRequest(BaseModel):
    email: str
    name: Optional[str] = ""
    role: str = "candidate"
    company: Optional[str] = ""

def generate_candidate_welcome_text(name: str, email: str):
    display_name = name.strip() if name and name.strip() else "Candidate"
    portal_url = "http://localhost:5173/login"
    return f"""Hello {display_name},

Welcome to HireVision!

We are thrilled to welcome you to the HireVision Autonomous Technical Interview Platform. HireVision provides fair, unbiased, real-time AI-powered technical interviews designed to showcase your true engineering capabilities.

What You Can Do on HireVision:
1. Join Interviews with 6-Digit PIN:
   Enter your recruiter-provided access PIN on your dashboard to instantly launch your waiting room and begin your session.

2. Hardware Pre-Flight Check:
   Test your webcam, microphone, and browser latency directly in your settings to ensure optimal performance.

3. Deep AI Evaluations & Instant Feedback:
   Receive objective, real-time feedback on problem-solving, architectural depth, and communication skills.

4. Smart Resume Vault:
   Upload and manage your CVs to match against role requirements effortlessly.

Access Your Candidate Portal:
{portal_url}

Top Interview Tips:
- Choose a well-lit, quiet environment.
- Use Google Chrome or Microsoft Edge.
- Speak naturally and articulate your technical reasoning clearly.

Best of luck with your upcoming interviews!

Best regards,
The HireVision Team
Autonomous Technical Interview Platform
"""

def generate_candidate_welcome_html(name: str, email: str):
    display_name = name.strip() if name and name.strip() else "Candidate"
    portal_url = "http://localhost:5173/login"
    year_str = str(time.localtime().tm_year)
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to HireVision</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b14; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #111a2e; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); padding: 36px 40px; text-align: center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 14px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 22px; font-weight: 900;">
                    HV
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">Welcome to HireVision!</h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Your AI-Powered Interview Journey Starts Here</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 40px;">
              <p style="margin: 0 0 14px 0; font-size: 18px; color: #ffffff; font-weight: 700;">Hello {display_name},</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Welcome to HireVision! We are excited to support your technical journey. HireVision provides fair, unbiased, real-time AI technical interviews designed to let your engineering problem-solving and coding skills shine.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1121; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">🔑</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">6-Digit Access PIN</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">When a recruiter invites you, easily join your session by entering your 6-digit access code on your candidate dashboard.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1121; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">🎙️</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">Interactive Voice & Video AI</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">Experience natural spoken conversation with our adaptive AI interviewer that understands your technical answers in real time.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1121; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">📊</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">Transparent AI Evaluations</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">Review your technical score breakdowns, strengths, and areas of growth immediately following your interview.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1121; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">📄</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">Resume Management</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">Upload your latest resume to automatically match your profile against technical competencies.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="{portal_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 15px 40px; border-radius: 14px; box-shadow: 0 4px 20px rgba(79, 70, 229, 0.45);">
                      Go to Candidate Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #0b1121; border-left: 4px solid #06b6d4; border-radius: 10px; padding: 18px 20px;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Pro-Tips for Your Sessions</h4>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.7; color: #94a3b8;">
                  <li>Run a quick hardware check in your Settings before joining an interview.</li>
                  <li>Ensure good lighting so your camera feed remains crisp and clear.</li>
                  <li>Speak into your microphone naturally — you can take your time to organize thoughts before answering.</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0a0f1d; padding: 24px 40px; text-align: center; border-top: 1px solid #1e293b;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                &copy; {year_str} HireVision Autonomous Interview Platform. All rights reserved.<br>
                You received this email because you created a candidate account on HireVision.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

def generate_recruiter_welcome_text(name: str, company: str, email: str):
    display_name = name.strip() if name and name.strip() else "Recruiter"
    company_phrase = f" for {company.strip()}" if company and company.strip() else ""
    dashboard_url = "http://localhost:5173/login"
    return f"""Hello {display_name},

Welcome to HireVision{company_phrase}!

We are thrilled to welcome you to the HireVision Recruiter Platform. HireVision empowers technical hiring teams to run objective, autonomous, AI-proctored technical interviews at scale without tying up senior engineering hours.

What You Can Do on HireVision:
1. Create Custom Job Campaigns:
   Configure target roles, required tech stacks, difficulty levels, and automatically generate unique 6-digit access PINs.

2. Automated Candidate Invites:
   Disseminate customized email invitations directly to applicants' inboxes with one click, complete with scheduling windows and PINs.

3. Live Knocking Waiting Room & Real-Time Proctoring:
   Admit knocking candidates, monitor live sessions, and track biometric telemetry (eye-gaze anomalies, emotion tracking, face visibility) in real time.

4. Objective AI Evaluations & Instant Shortlisting:
   Review comprehensive Groq LLaMA 3.3 scorecards, audio-to-text transcripts, and shortlist high-caliber talent in seconds.

Access Your Recruiter Dashboard:
{dashboard_url}

Happy Hiring!

Best regards,
The HireVision Talent Engineering Team
HireVision Recruiter Platform
"""

def generate_recruiter_welcome_html(name: str, company: str, email: str):
    display_name = name.strip() if name and name.strip() else "Recruiter"
    company_phrase = f" for <strong style=\"color: #a78bfa;\">{company.strip()}</strong>" if company and company.strip() else ""
    dashboard_url = "http://localhost:5173/login"
    year_str = str(time.localtime().tm_year)
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to HireVision Recruiter Suite</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b14; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #121526; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #059669 100%); padding: 36px 40px; text-align: center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 14px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 22px; font-weight: 900;">
                    HV
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">Welcome to HireVision!</h1>
              <p style="margin: 8px 0 0 0; color: #ede9fe; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Supercharge Your Technical Hiring with AI</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 40px;">
              <p style="margin: 0 0 14px 0; font-size: 18px; color: #ffffff; font-weight: 700;">Hello {display_name},</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Welcome to the HireVision Recruiter Platform{company_phrase}! We are delighted to partner with you. HireVision empowers talent acquisition and engineering hiring teams to run objective, proctored, real-time AI technical interviews at infinite scale without tying up senior engineering hours.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1222; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">🎯</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">Launch Custom Job Campaigns</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">Configure target technical roles, custom tech stacks, and generate unique 6-digit access PINs in seconds.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1222; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">✉️</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">One-Click Email Invitations</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">Send automated, beautifully branded email invites directly to candidate inboxes with custom notes and schedule windows.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1222; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">🛡️</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">Real-Time Proctoring & Anti-Cheat</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">Full biometric telemetry tracking: face visibility, eye-gaze tracking, emotion insights, and anti-deepfake wave verification.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d1222; border: 1px solid #1e293b; border-radius: 14px; padding: 16px;">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 1;">📈</td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">AI Evaluations & Instant Shortlisting</div>
                          <div style="font-size: 12px; line-height: 1.5; color: #94a3b8;">Evaluate candidates objectively using Groq LLaMA 3.3 scorecards, full conversation transcripts, and one-click shortlisting.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="{dashboard_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 15px 40px; border-radius: 14px; box-shadow: 0 4px 20px rgba(124, 58, 237, 0.45);">
                      Open Recruiter Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #0d1222; border-left: 4px solid #10b981; border-radius: 10px; padding: 18px 20px;">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #34d399; text-transform: uppercase;">3-Step Quick Start</h4>
                <ol style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.8; color: #94a3b8;">
                  <li><strong style="color: #ffffff;">Create Job:</strong> Click "Create New Job" on your dashboard and specify required skills.</li>
                  <li><strong style="color: #ffffff;">Invite Candidates:</strong> Send email invites with the 6-digit access PIN.</li>
                  <li><strong style="color: #ffffff;">Review & Shortlist:</strong> Inspect comprehensive AI evaluation reports and shortlist top performers.</li>
                </ol>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0a0c16; padding: 24px 40px; text-align: center; border-top: 1px solid #1e293b;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                &copy; {year_str} HireVision Autonomous Interview Platform. All rights reserved.<br>
                You received this email because you created a recruiter account on HireVision.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

@app.post("/api/send-welcome-email")
async def send_welcome_email(data: WelcomeEmailRequest):
    try:
        clean_email = data.email.strip()
        if not clean_email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean_email):
            return {"status": "error", "message": "Invalid recipient email address."}
        
        role = (data.role or "candidate").strip().lower()
        is_recruiter = role == "recruiter"

        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")
        if smtp_pass:
            smtp_pass = smtp_pass.replace(" ", "")
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))

        raw_from = (os.getenv("SMTP_FROM") or "").strip().strip('"').strip("'")
        if raw_from and "<" in raw_from and ">" in raw_from:
            smtp_from = raw_from
        elif smtp_user:
            smtp_from = f"HireVision <{smtp_user}>"
        else:
            smtp_from = "HireVision <welcome@hirevision.ai>"

        user_name = data.name.strip() if data.name and data.name.strip() else clean_email.split("@")[0]

        if is_recruiter:
            subject = f"Welcome to HireVision, {user_name} - Recruiter Portal Setup"
            text_content = generate_recruiter_welcome_text(user_name, data.company or "", clean_email)
            html_content = generate_recruiter_welcome_html(user_name, data.company or "", clean_email)
        else:
            subject = f"Welcome to HireVision, {user_name} - Candidate Portal Setup"
            text_content = generate_candidate_welcome_text(user_name, clean_email)
            html_content = generate_candidate_welcome_html(user_name, clean_email)

        if smtp_user and smtp_pass:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = smtp_from
                msg["To"] = clean_email
                msg["Reply-To"] = smtp_user
                msg["Date"] = email.utils.formatdate(localtime=True)
                msg["Message-ID"] = email.utils.make_msgid(domain=smtp_user.split("@")[-1] if "@" in smtp_user else "gmail.com")
                msg["X-Mailer"] = "HireVision Mail Engine 1.0"
                msg["List-Unsubscribe"] = f"<mailto:{smtp_user}?subject=unsubscribe>"
                
                # 1. Attach plain text first
                msg.attach(MIMEText(text_content, "plain", "utf-8"))
                # 2. Attach HTML part second
                msg.attach(MIMEText(html_content, "html", "utf-8"))

                server.sendmail(smtp_user, clean_email, msg.as_string())

            print(f"[WELCOME EMAIL SENT] Delivered {role} welcome email to {clean_email}")
            return {
                "status": "success",
                "mode": "live",
                "recipient": clean_email,
                "role": role,
                "message": f"Successfully delivered welcome email to {clean_email}!"
            }
        else:
            print(f"\n[DEV SIMULATION] Sent {role.capitalize()} Welcome Email to {clean_email}")
            print(f"Subject: {subject}")
            return {
                "status": "success",
                "mode": "simulated",
                "recipient": clean_email,
                "role": role,
                "message": f"Simulated welcome email delivery to {clean_email}."
            }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)