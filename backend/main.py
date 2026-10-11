from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from typing import Optional
import json
import os
import shutil
import time
import re

from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

env_path = r'D:\MCA Major Project\HireVision\.env'
load_dotenv(dotenv_path=env_path)
# Also load backend/.env if present so credentials work in either location
backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(backend_env_path):
    load_dotenv(dotenv_path=backend_env_path)

from backend.nlp.interview_engine import GroqClient, InterviewConfig, build_interview, extract_text

app = FastAPI(title="HireVision AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "resumes"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

@app.get("/")
def health_check():
    return {"status": "API is running successfully!"}

import requests
import uuid

@app.post("/api/store-resume")
async def store_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    try:
        resumes_dir = os.path.join(UPLOADS_DIR, "resumes")
        os.makedirs(resumes_dir, exist_ok=True)
        
        # Clean filename and create unique path
        safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)
        unique_filename = f"{user_id}_{int(time.time())}_{safe_name}"
        dest_path = os.path.join(resumes_dir, unique_filename)
        
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
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.delete("/api/delete-resume")
async def delete_stored_resume(filename: str):
    try:
        target = os.path.join(UPLOADS_DIR, "resumes", filename)
        if os.path.exists(target):
            os.remove(target)
        return {"success": True}
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
    
    if file:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    elif resume_url:
        if "uploads/resumes/" in resume_url:
            local_fname = resume_url.split("uploads/resumes/")[-1]
            local_fpath = os.path.join(UPLOADS_DIR, "resumes", local_fname)
            if os.path.exists(local_fpath):
                shutil.copyfile(local_fpath, temp_file_path)
            else:
                response = requests.get(resume_url)
                with open(temp_file_path, "wb") as buffer:
                    buffer.write(response.content)
        else:
            response = requests.get(resume_url)
            with open(temp_file_path, "wb") as buffer:
                buffer.write(response.content)
    else:
        return {"error": "No file or URL provided"}

    try:
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
            os.remove(temp_file_path)
        return {"error": str(e)}

from pydantic import BaseModel
from typing import List

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
    from backend.nlp.interview_engine import evaluate_answer, Question
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
            
            import time
            time.sleep(3)  
            
        
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

import smtplib
import email.utils
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pydantic import BaseModel
from typing import List, Optional

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
                    
                    # 1. Attach plain text first (crucial for inbox deliverability)
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
            # Simulated Dev Mode: Logs delivery to terminal
            print(f"\n[DEV SIMULATION] Sent Interview Invite for Job '{data.jobTitle}' (PIN: {data.jobId})")
            print(f"Recipients ({len(valid_emails)}): {', '.join(valid_emails)}")
            print(f"Notice: Add SMTP_USER and SMTP_PASS in .env to enable live mailbox delivery.\n")

            return {
                "status": "success",
                "mode": "simulated",
                "sentCount": len(valid_emails),
                "recipients": valid_emails,
                "message": f"Simulated delivery to {len(valid_emails)} candidate(s). (Add SMTP_USER in .env for live sending)"
            }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)