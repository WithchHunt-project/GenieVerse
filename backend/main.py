import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
import numpy as np

API_KEY = "AIzaSyCKl2pqg6xOaIsrTlYEr8X6HCdpBxWh530"
MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-2.0-flash-lite", "gemini-flash-latest"]

client = genai.Client(api_key=API_KEY)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MIRRORA_SYSTEM = """You are Mirrora, a magical reflection guide from GenieVerse.
Your purpose is to help users learn by thinking, not by directly giving answers.
Do NOT act like a normal teacher. Do NOT give direct answers immediately. Do NOT say correct or wrong.
Always follow this structure:
1. Appreciation: Acknowledge the user's effort warmly.
2. Reflection: Rephrase what the user said in a clearer and slightly improved way.
3. Guiding Questions: Ask 1 to 3 thoughtful questions that deepen understanding.
4. Gentle Hint (only if needed): Give a small hint without revealing the full answer.
5. Understanding Score: End with a line like "Understanding: 7 out of 10".
Do NOT use emojis, symbols, bullet points or markdown. Use smooth natural spoken English.
Tone: Friendly, encouraging, curious, calm, slightly magical.
If the user's pet name is available, use it naturally.
If the user is wrong, guide them with questions. If stuck, guide step by step."""

ABU_SYSTEM = """You are Abu, a friendly and intelligent companion from GenieVerse.
Your role is to act as a supportive learning buddy who helps the user understand concepts in a simple, clear, and engaging way.
You behave like a cheerful and smart friend who makes learning easy and enjoyable.
Respond with short, simple, easy-to-understand explanations. Keep your tone warm, friendly, and slightly playful.
Occasionally include a small follow-up question to keep the user engaged.
Do NOT use emojis, symbols, or complex formatting. Use smooth natural conversational sentences optimized for voice.
If the user's pet name is available, include it naturally.
If the user is confused, simplify further. If correct, appreciate and add a small insight. If wrong, gently correct them kindly."""

QBIT_SYSTEM = """You are Qbit, an intelligent doubt-clearing guide from GenieVerse.
Your role is to quickly and clearly resolve the user's doubts while also encouraging deeper understanding using a Socratic learning approach.
When a user asks a question or expresses confusion, first provide a short, clear, and direct explanation to remove the immediate doubt.
Then, guide the user further by asking one or two thoughtful questions that encourage them to think more deeply about the concept.
Keep your explanations simple, structured, and easy to follow, avoiding unnecessary complexity.
If the concept requires multiple steps, break it down clearly.
This system supports voice interaction, so your responses must be optimized for both text and speech.
Use smooth, natural, conversational sentences without emojis, symbols, or complex formatting, so that when spoken aloud they sound clear and human-like.
Keep sentences short and easy to understand when heard.
Maintain a calm, intelligent, and slightly futuristic tone, like a smart guide helping to resolve confusion quickly.
If the user's pet name is available, include it naturally in your response.
If the user is confused, simplify further instead of adding complexity.
If the user understands, push them slightly deeper with a question.
If the user is stuck, guide them step by step until clarity is achieved."""


def generate(prompt: str) -> str:
    for model in MODELS:
        for attempt in range(3):
            try:
                response = client.models.generate_content(model=model, contents=prompt)
                return response.text
            except Exception as e:
                err = str(e)
                if "503" in err:
                    time.sleep(2)
                    continue
                if "429" in err:
                    break
                return f"Error: {err}"
    return "All AI models are busy right now. Please try again in a moment."


# ── ML Models ──────────────────────────────────────────────────────────────

class InterestRecord(BaseModel):
    time_spent: float
    quiz_score: float
    revision_count: float
    rating: float
    subject: str

class InterestPredictRequest(BaseModel):
    records: list[InterestRecord]

class ForgettingRecord(BaseModel):
    days_gap: float
    quiz_score: float
    revision_count: float
    difficulty: float
    concept_id: str
    subject: str

class ForgettingPredictRequest(BaseModel):
    records: list[ForgettingRecord]


@app.post("/predict-interest")
async def predict_interest(req: InterestPredictRequest):
    """
    Trains a RandomForestClassifier on the user's own activity data,
    then predicts which subjects the user is interested in.
    Returns a ranked list of subjects by predicted interest probability.
    """
    if len(req.records) < 2:
        # Not enough data — fall back to returning all subjects
        subjects = list({r.subject for r in req.records})
        return {"interested_subjects": subjects, "method": "fallback"}

    X = np.array([[r.time_spent, r.quiz_score, r.revision_count, r.rating] for r in req.records])
    # Label: interested if time_spent > 15 AND rating > 3
    y = np.array([1 if (r.time_spent > 15 and r.rating > 3) else 0 for r in req.records])

    # Need at least one positive and one negative sample to train
    if len(set(y)) < 2:
        # All same label — return subjects with highest engagement
        sorted_records = sorted(req.records, key=lambda r: r.time_spent + r.rating * 3, reverse=True)
        subjects = list(dict.fromkeys(r.subject for r in sorted_records))
        return {"interested_subjects": subjects, "method": "fallback_sorted"}

    model = RandomForestClassifier(n_estimators=50, random_state=42)
    model.fit(X, y)

    # Predict probability of interest per record, then aggregate by subject
    probs = model.predict_proba(X)[:, 1]  # probability of class=1 (interested)

    subject_scores: dict[str, list[float]] = {}
    for record, prob in zip(req.records, probs):
        subject_scores.setdefault(record.subject, []).append(prob)

    # Average probability per subject, sorted descending
    subject_avg = {s: float(np.mean(ps)) for s, ps in subject_scores.items()}
    ranked = sorted(subject_avg.items(), key=lambda x: x[1], reverse=True)
    interested_subjects = [s for s, prob in ranked if prob >= 0.5]

    return {
        "interested_subjects": interested_subjects if interested_subjects else [ranked[0][0]],
        "scores": subject_avg,
        "method": "random_forest"
    }


@app.post("/predict-forgetting")
async def predict_forgetting(req: ForgettingPredictRequest):
    """
    Trains a LogisticRegression model on the user's revision history,
    then predicts forgetting probability for each concept.
    Returns concepts sorted by forgetting probability (highest first).
    """
    if len(req.records) < 2:
        return {"revise": [r.concept_id for r in req.records], "method": "fallback"}

    X = np.array([[r.days_gap, r.quiz_score, r.revision_count, r.difficulty] for r in req.records])
    # Label: forgotten if quiz_score < 50 OR days_gap > 7
    y = np.array([1 if (r.quiz_score < 50 or r.days_gap > 7) else 0 for r in req.records])

    if len(set(y)) < 2:
        # All same — sort by days_gap descending (longest unseen first)
        sorted_records = sorted(req.records, key=lambda r: r.days_gap, reverse=True)
        return {"revise": [r.concept_id for r in sorted_records], "probabilities": {}, "method": "fallback_sorted"}

    model = LogisticRegression(max_iter=200)
    model.fit(X, y)

    probs = model.predict_proba(X)[:, 1]

    result = [
        {"concept_id": r.concept_id, "subject": r.subject, "probability": float(p)}
        for r, p in zip(req.records, probs)
    ]
    result.sort(key=lambda x: x["probability"], reverse=True)

    return {
        "revise": [r["concept_id"] for r in result if r["probability"] >= 0.5],
        "all": result,
        "method": "logistic_regression"
    }


# ── Chat Endpoints ──────────────────────────────────────────────────────────

class JinnRequest(BaseModel):
    topic: str
    interest: str


class MirroraRequest(BaseModel):
    message: str
    petname: str = "friend"
    history: list = []


class AbuRequest(BaseModel):
    message: str
    petname: str = "friend"
    history: list = []


class QbitRequest(BaseModel):
    message: str
    petname: str = "friend"
    history: list = []


@app.post("/comrade")
async def comrade(req: JinnRequest):
    prompt = f"You are Jinn, a magical and friendly AI tutor. Explain '{req.topic}' in a fun and engaging way using '{req.interest}' as an analogy or context. Keep it clear and exciting for a student."
    return {"response": generate(prompt)}


@app.post("/mirrora")
async def mirrora(req: MirroraRequest):
    history_text = ""
    for h in req.history[-6:]:
        history_text += f"User: {h['user']}\nMirrora: {h['mirrora']}\n"
    prompt = f"{MIRRORA_SYSTEM}\n\nThe user's pet name is {req.petname}.\n\n{history_text}User: {req.message}\nMirrora:"
    return {"response": generate(prompt)}


@app.post("/abu")
async def abu(req: AbuRequest):
    history_text = ""
    for h in req.history[-6:]:
        history_text += f"User: {h['user']}\nAbu: {h['abu']}\n"
    prompt = f"{ABU_SYSTEM}\n\nThe user's pet name is {req.petname}.\n\n{history_text}User: {req.message}\nAbu:"
    return {"response": generate(prompt)}


@app.post("/qbit")
async def qbit(req: QbitRequest):
    history_text = ""
    for h in req.history[-6:]:
        history_text += f"User: {h['user']}\nQbit: {h['qbit']}\n"
    prompt = f"{QBIT_SYSTEM}\n\nThe user's pet name is {req.petname}.\n\n{history_text}User: {req.message}\nQbit:"
    return {"response": generate(prompt)}
