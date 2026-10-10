import os
import re
import json
import pymupdf
import spacy
from typing import List, Dict, Any

try:
    nlp = spacy.load("en_core_web_sm")
except:
    nlp = None

SKILL_DICTIONARY = [
    "python", "java", "c++", "c#", "javascript", "typescript", "react", "angular", "vue",
    "node.js", "express", "django", "flask", "fastapi", "spring boot", "ruby on rails",
    "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "cassandra",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "jenkins", "cicd",
    "git", "github", "gitlab", "agile", "scrum", "jira",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "scikit-learn",
    "pandas", "numpy", "matplotlib", "seaborn", "tableau", "power bi",
    "html", "css", "sass", "tailwind", "bootstrap", "material ui",
    "redux", "graphql", "rest api", "microservices", "system design"
]

def extract_text_from_pdf(pdf_path: str) -> str:
    """Reads a PDF file and extracts all text."""
    text = ""
    try:
        with pymupdf.open(pdf_path) as doc:
            for page in doc:
                text += page.get_text() + "\n"
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def detect_sections(text: str) -> Dict[str, str]:
    """
    Splits the resume into basic sections using regex heuristics.
    """
    sections = {
        "summary": "",
        "skills": "",
        "experience": "",
        "projects": "",
        "education": "",
        "certifications": ""
    }
    
    # Very basic heuristic for demo purposes - in a real app, use robust regex or a classifier
    lines = text.split('\n')
    current_section = "summary"
    
    for line in lines:
        lower_line = line.strip().lower()
        if not lower_line:
            continue
            
        if "skill" in lower_line and len(lower_line) < 20:
            current_section = "skills"
            continue
        elif "experience" in lower_line or "employment" in lower_line:
            current_section = "experience"
            continue
        elif "project" in lower_line:
            current_section = "projects"
            continue
        elif "education" in lower_line:
            current_section = "education"
            continue
        elif "certification" in lower_line or "achievement" in lower_line:
            current_section = "certifications"
            continue
            
        sections[current_section] += line + "\n"
        
    return sections

def extract_skills_spacy(text: str) -> List[str]:
    """
    Extracts skills using a curated dictionary and basic token matching.
    """
    text_lower = text.lower()
    found_skills = set()
    for skill in SKILL_DICTIONARY:
        # Simple word boundary regex to avoid partial matches (e.g. "c" in "cat")
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            found_skills.add(skill.title())
    return list(found_skills)

def generate_chunks(sections: Dict[str, str]) -> List[Dict[str, str]]:
    """
    Converts the structured sections into semantic chunks for the vector database.
    """
    chunks = []
    
    if sections.get("summary"):
        chunks.append({"text": sections["summary"], "metadata": {"section": "summary"}})
        
    if sections.get("skills"):
        chunks.append({"text": sections["skills"], "metadata": {"section": "skills"}})
        
    if sections.get("experience"):
        # Split by empty lines to separate jobs (rough heuristic)
        jobs = [j.strip() for j in sections["experience"].split('\n\n') if j.strip()]
        for job in jobs:
            chunks.append({"text": job, "metadata": {"section": "experience"}})
            
    if sections.get("projects"):
        projects = [p.strip() for p in sections["projects"].split('\n\n') if p.strip()]
        for proj in projects:
            chunks.append({"text": proj, "metadata": {"section": "projects"}})
            
    if sections.get("education"):
        chunks.append({"text": sections["education"], "metadata": {"section": "education"}})
        
    return chunks

def build_vector_store(chunks: List[Dict[str, str]]):
    """
    Builds an in-memory ChromaDB vector store for the chunks.
    """
    import chromadb
    client = chromadb.Client()
    
    # Use try-except to handle existing collections in memory
    try:
        collection = client.create_collection(name="resume_chunks")
    except:
        client.delete_collection(name="resume_chunks")
        collection = client.create_collection(name="resume_chunks")
        
    documents = [c["text"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]
    ids = [f"chunk_{i}" for i in range(len(chunks))]
    
    if documents:
        collection.add(documents=documents, metadatas=metadatas, ids=ids)
        
    return collection

def plan_and_generate_questions(collection, config: list, focused_skills: list, api_key: str):
    """
    Two-stage Question Engine: Planner -> Generator with RAG.
    Includes robust retries and sleeps to bypass Google's free-tier rate limits and 503 errors.
    """
    from google import genai
    import json
    import time
    
    client = genai.Client(api_key=api_key)
    generated_questions = []
    
    for sec in config:
        category = sec.get("category", "General")
        count = int(sec.get("count", 1))
        difficulty = sec.get("difficulty", "Intermediate")
        
        # 1. RAG Retrieval - Find relevant context from the vector DB for this category
        query = category
        if "Technical" in category and focused_skills:
            query += " " + " ".join(focused_skills)
            
        results = collection.query(query_texts=[query], n_results=3)
        context_chunks = results["documents"][0] if results["documents"] else []
        context_str = "\n---\n".join(context_chunks)
        
        # 2. LLM Generator - Generate strictly bounded questions
        prompt = f"""
        You are an expert technical recruiter.
        Based ONLY on the following verified resume evidence, generate {count} personalized interview question(s).
        Category: {category}
        Difficulty: {difficulty}
        
        Verified Resume Evidence:
        {context_str}
        
        CRITICAL RULES:
        1. DO NOT invent any skills, projects, or experiences that are not mentioned in the evidence.
        2. If the evidence is empty or insufficient, generate generic but relevant questions for the category.
        3. Output EXACTLY {count} distinct questions as a JSON array of strings.
        
        Format:
        {{ "questions": ["Question 1", "Question 2"] }}
        Do not wrap in markdown tags.
        """
        
        success = False
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model='gemini-flash-latest',
                    contents=prompt
                )
                
                raw_text = response.text or ""
                raw_text = raw_text.strip()
                
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif raw_text.startswith("```"):
                    raw_text = raw_text.split("```")[1].strip()
                    
                try:
                    parsed = json.loads(raw_text)
                except json.JSONDecodeError:
                    parsed = {"questions": []}
                    
                q_list = parsed.get("questions", [])
                
                # Manual padding to ensure strict count
                while len(q_list) < count:
                    q_list.append(f"Generic {category} question.")
                
                generated_questions.extend(q_list[:count])
                success = True
                break 
                
            except Exception as e:
                print(f"Attempt {attempt+1} failed for {category}: {e}")
                time.sleep(3) # Wait and try again
                
        if not success:
            print(f"All attempts failed for {category}. Using fallback.")
            for _ in range(count):
                generated_questions.append(f"Could you elaborate on your experience in {category}?")
                
        # Sleep after every category to respect rate limits
        time.sleep(3)
                
    return generated_questions

def process_resume_v2(text: str, config: list = None, focused_skills: list = None):
    """
    Main orchestration function for the new NLP pipeline.
    """
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), "../../.env")
    load_dotenv(dotenv_path=env_path)
    api_key = os.getenv("GEMINI_API_KEY")
    
    # 1. Extraction & Sectioning
    sections = detect_sections(text)
    
    # 2. NLP Extraction
    detected_skills = extract_skills_spacy(text)
    if not detected_skills:
        detected_skills = ["No technical skills detected"]
        
    # 3. Semantic Layer
    chunks = generate_chunks(sections)
    collection = build_vector_store(chunks)
    
    # 4. Question Generation
    if not config:
        config = [
            {"category": "Introduction", "count": 1, "difficulty": "Intermediate"},
            {"category": "Core Technical Skills", "count": 2, "difficulty": "Intermediate"},
            {"category": "Behavioral", "count": 1, "difficulty": "Intermediate"},
            {"category": "System Design", "count": 1, "difficulty": "Intermediate"}
        ]
        
    questions = plan_and_generate_questions(collection, config, focused_skills, api_key)
    
    return {
        "detected_skills": detected_skills[:5], # Keep top 5 for the UI
        "generated_questions": questions
    }
