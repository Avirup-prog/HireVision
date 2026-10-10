import os
import json
import pymupdf
from google import genai
from google.genai import types

def extract_text_from_pdf(pdf_path: str) -> str:
    """Reads a PDF file and extracts all text."""
    text = ""
    try:
        with pymupdf.open(pdf_path) as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def analyze_resume_with_gemini(text: str, config: list = None, focused_skills: list = None):
    """
    Sends the raw resume text to Gemini to extract skills and generate personalized questions.
    Uses dynamic recruiter configuration if provided.
    """
    from dotenv import load_dotenv

    env_path = os.path.join(os.path.dirname(__file__), "../../.env")
    load_dotenv(dotenv_path=env_path)
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    total_questions = 0
    instructions = ""
    
    if config:
        instructions += "The recruiter has requested a specific interview structure:\\n"
        for i, sec in enumerate(config):
            count = sec.get("count", 1)
            total_questions += int(count)
            instructions += f"- Section {i+1}: Generate {count} question(s) from the '{sec.get('category')}' category at a '{sec.get('difficulty')}' difficulty level.\\n"
    else:
        total_questions = 5
        instructions += "Generate exactly 5 progressive interview questions designed to simulate a real human interview (1 Ice-breaker, 1 Behavioral, 2 Technical, 1 Architecture).\\n"

    if focused_skills and len(focused_skills) > 0:
        skills_str = ", ".join(focused_skills)
        instructions += f"\\nCRITICAL FOCUSED SKILLS: The recruiter has specifically prioritized the following technologies: {skills_str}. When generating 'Core Technical Skills' questions, you MUST heavily prioritize these specific technologies. You must evaluate the candidate's depth in these focused areas based on their resume context. You may still ask about other technologies present on the resume, but the primary technical focus must remain on the recruiter's requested skills.\\n"

    from pydantic import BaseModel
    
    class InterviewResponse(BaseModel):
        detected_skills: list[str]
        generated_questions: list[str]

    prompt = f"""
    You are an expert HR manager and Senior Technical Recruiter. 
    Analyze the following candidate resume text:
    ---
    {text}
    ---
    
    1. Extract up to 5 of the most important technical skills or tools mentioned in the resume.
    
    2. YOU MUST GENERATE EXACTLY {total_questions} PERSONALIZED INTERVIEW QUESTIONS based on the resume. NO MORE, NO LESS.
    
    {instructions}
    
    CRITICAL INSTRUCTION: YOU MUST RETURN EXACTLY {total_questions} STRINGS IN THE `generated_questions` ARRAY.
    DO NOT summarize or combine questions. Output EXACTLY {total_questions} distinct questions.
    Even if the resume is very short or completely empty, you MUST invent generic questions that fit the requested categories to ensure the array has EXACTLY {total_questions} items.
    """

    try:
        # Use models.generate_content since interactions API might not support structured outputs as cleanly in this SDK version
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=InterviewResponse,
                temperature=0.7
            ),
            contents=prompt
        )
        
        parsed = json.loads(response.text)
        
        # Absolute safety net: if the model still disobeys, we pad the array manually
        questions = parsed.get("generated_questions", [])
        while len(questions) < total_questions:
            questions.append(f"Follow up question regarding your experience.")
            
        parsed["generated_questions"] = questions[:total_questions] # Force exact length
        
        return parsed
    except Exception as e:
        print(f"Gemini Error: {e}")
        
        # Fallback padding to match expected length
        fallback_questions = ["What is your background?", "Can you describe a challenging project you've worked on?"]
        while len(fallback_questions) < total_questions:
            fallback_questions.append("Could you elaborate on your previous experience?")
            
        return {
            "detected_skills": ["API Error"],
            "generated_questions": fallback_questions[:total_questions]
        }
