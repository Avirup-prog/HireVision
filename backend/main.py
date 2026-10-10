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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)