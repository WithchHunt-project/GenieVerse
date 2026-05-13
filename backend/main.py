import time
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
import numpy as np
import joblib

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def _model_path(user_id: str, kind: str) -> str:
    safe = user_id.replace("-", "")
    return os.path.join(MODELS_DIR, f"{kind}_{safe}.joblib")

def _load_or_new(user_id: str, kind: str):
    path = _model_path(user_id, kind)
    if os.path.exists(path):
        return joblib.load(path)
    return RandomForestClassifier(n_estimators=50, random_state=42) if kind == "interest" else LogisticRegression(max_iter=200)

def _save_model(model, user_id: str, kind: str):
    joblib.dump(model, _model_path(user_id, kind))

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
You remember everything the student has told you across all past conversations — their struggles, topics they found hard, things they enjoyed, and personal details they shared. Use this memory naturally to feel like a real friend.
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
    user_id: str = ""

class ForgettingRecord(BaseModel):
    days_gap: float
    quiz_score: float
    revision_count: float
    difficulty: float
    concept_id: str
    subject: str

class ForgettingPredictRequest(BaseModel):
    records: list[ForgettingRecord]
    user_id: str = ""


@app.post("/predict-interest")
async def predict_interest(req: InterestPredictRequest):
    if len(req.records) < 2:
        subjects = list({r.subject for r in req.records})
        return {"interested_subjects": subjects, "method": "fallback"}

    X = np.array([[r.time_spent, r.quiz_score, r.revision_count, r.rating] for r in req.records])
    y = np.array([1 if (r.time_spent > 15 and r.rating > 3) else 0 for r in req.records])

    if len(set(y)) < 2:
        sorted_records = sorted(req.records, key=lambda r: r.time_spent + r.rating * 3, reverse=True)
        subjects = list(dict.fromkeys(r.subject for r in sorted_records))
        return {"interested_subjects": subjects, "method": "fallback_sorted"}

    model = _load_or_new(req.user_id, "interest")
    model.fit(X, y)
    if req.user_id:
        _save_model(model, req.user_id, "interest")

    probs = model.predict_proba(X)[:, 1]
    subject_scores: dict[str, list[float]] = {}
    for record, prob in zip(req.records, probs):
        subject_scores.setdefault(record.subject, []).append(prob)

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
    if len(req.records) < 2:
        return {"revise": [r.concept_id for r in req.records], "method": "fallback"}

    X = np.array([[r.days_gap, r.quiz_score, r.revision_count, r.difficulty] for r in req.records])
    y = np.array([1 if (r.quiz_score < 50 or r.days_gap > 7) else 0 for r in req.records])

    if len(set(y)) < 2:
        sorted_records = sorted(req.records, key=lambda r: r.days_gap, reverse=True)
        return {"revise": [r.concept_id for r in sorted_records], "probabilities": {}, "method": "fallback_sorted"}

    model = _load_or_new(req.user_id, "forgetting")
    model.fit(X, y)
    if req.user_id:
        _save_model(model, req.user_id, "forgetting")

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
    interests: list[str] = []  # array of user interests from profile
    user_id: str = ""

class UpdateInterestsRequest(BaseModel):
    user_id: str
    records: list[InterestRecord]


class MirroraRequest(BaseModel):
    message: str
    petname: str = "friend"
    history: list = []
    context: str = ""  # Jinn session context


class AbuRequest(BaseModel):
    message: str
    petname: str = "friend"
    history: list = []


class QbitRequest(BaseModel):
    message: str
    petname: str = "friend"
    history: list = []
    context: str = ""  # Jinn + Mirrora session context


@app.post("/comrade")
async def comrade(req: JinnRequest):
    topic = req.topic
    interests = [i.strip() for i in req.interests if i.strip()]

    if interests:
        # Ask Gemini to pick the best matching interest for this concept
        # and also suggest related fields (e.g. "cars" → "mechanics", "engineering")
        selection_prompt = (
            f"A student is learning about '{topic}'. Their interests are: {', '.join(interests)}. "
            f"Pick the single best interest from the list that can be used as an analogy to explain '{topic}'. "
            f"Also list 2-3 related fields to that interest (e.g. if interest is 'cars', related fields are 'mechanics, engineering, fuel chemistry'). "
            f"Reply in this exact format only — no extra text:\n"
            f"BEST: <chosen interest>\nRELATED: <field1>, <field2>, <field3>"
        )
        raw = generate(selection_prompt)
        chosen_interest = interests[0]  # fallback
        related_fields = []
        for line in raw.splitlines():
            if line.startswith("BEST:"):
                chosen_interest = line.replace("BEST:", "").strip()
            elif line.startswith("RELATED:"):
                related_fields = [f.strip() for f in line.replace("RELATED:", "").split(",")]

        analogy_context = chosen_interest
        if related_fields:
            analogy_context += f" and related areas like {', '.join(related_fields)}"

        prompt = (
            f"You are Jinn, a magical and friendly AI tutor. "
            f"Explain '{topic}' using '{analogy_context}' as analogies and real-world context. "
            f"Use examples from {chosen_interest} first, then naturally connect to {', '.join(related_fields) if related_fields else 'related real-world scenarios'}. "
            f"Keep it clear, engaging, and exciting for a student. "
            f"At the very end, on a new line, write exactly: USED_INTEREST: {chosen_interest}"
        )
    else:
        # No interests — use real-life examples and detect interest from response
        prompt = (
            f"You are Jinn, a magical and friendly AI tutor. "
            f"Explain '{topic}' using vivid, relatable real-life examples that any student would find interesting. "
            f"Use everyday scenarios, nature, sports, food, technology, or anything universally relatable. "
            f"Keep it clear, engaging, and exciting. "
            f"At the very end, on a new line, write exactly: DETECTED_INTEREST: <one word or short phrase describing the main real-world domain you used>"
        )

    response_text = generate(prompt)
    result = {"response": response_text}

    # Extract metadata tags from response for interest tracking
    for line in response_text.splitlines():
        if line.startswith("USED_INTEREST:"):
            result["used_interest"] = line.replace("USED_INTEREST:", "").strip()
            result["response"] = response_text[:response_text.rfind("USED_INTEREST:")].strip()
        elif line.startswith("DETECTED_INTEREST:"):
            result["detected_interest"] = line.replace("DETECTED_INTEREST:", "").strip()
            result["response"] = response_text[:response_text.rfind("DETECTED_INTEREST:")].strip()

    return result


@app.post("/update-interests")
async def update_interests(req: UpdateInterestsRequest):
    """
    Called after a session ends with rating. Uses ML to predict updated interests
    based on time_spent + rating across subjects, then expands each interest
    to related fields using Gemini. Returns updated detected_interests list.
    """
    records = req.records
    if len(records) < 2:
        subjects = list({r.subject for r in records})
        return {"updated_interests": subjects, "method": "fallback"}

    X = np.array([[r.time_spent, r.quiz_score, r.revision_count, r.rating] for r in records])
    y = np.array([1 if (r.time_spent > 15 and r.rating > 3) else 0 for r in records])

    if len(set(y)) < 2:
        sorted_records = sorted(records, key=lambda r: r.time_spent + r.rating * 3, reverse=True)
        top_subjects = list(dict.fromkeys(r.subject for r in sorted_records))[:3]
    else:
        model = _load_or_new(req.user_id, "interest")
        model.fit(X, y)
        if req.user_id:
            _save_model(model, req.user_id, "interest")
        probs = model.predict_proba(X)[:, 1]
        subject_scores: dict[str, list[float]] = {}
        for record, prob in zip(records, probs):
            subject_scores.setdefault(record.subject, []).append(prob)
        subject_avg = {s: float(np.mean(ps)) for s, ps in subject_scores.items()}
        ranked = sorted(subject_avg.items(), key=lambda x: x[1], reverse=True)
        top_subjects = [s for s, p in ranked if p >= 0.4][:4] or [ranked[0][0]]

    # Expand each top subject to related fields using Gemini
    expand_prompt = (
        f"For each of these interest areas: {', '.join(top_subjects)}, "
        f"list 2 closely related real-world fields a student might also enjoy. "
        f"Reply as a flat comma-separated list of all interests and their related fields combined. No explanations."
    )
    expanded_raw = generate(expand_prompt)
    expanded = [i.strip() for i in expanded_raw.split(",") if i.strip()]
    # Merge original top subjects + expanded, deduplicated, max 8
    all_interests = list(dict.fromkeys(top_subjects + expanded))[:8]

    return {"updated_interests": all_interests, "method": "random_forest"}


@app.post("/mirrora")
async def mirrora(req: MirroraRequest):
    history_text = ""
    for h in req.history[-6:]:
        history_text += f"User: {h['user']}\nMirrora: {h['mirrora']}\n"
    context_block = f"\n\nContext from the student's previous learning session:\n{req.context}\n" if req.context else ""
    prompt = f"{MIRRORA_SYSTEM}{context_block}\n\nThe user's pet name is {req.petname}.\n\n{history_text}User: {req.message}\nMirrora:"
    return {"response": generate(prompt)}


@app.post("/abu")
async def abu(req: AbuRequest):
    history_text = ""
    for h in req.history[-20:]:
        history_text += f"User: {h['user']}\nAbu: {h['abu']}\n"
    prompt = f"{ABU_SYSTEM}\n\nThe user's pet name is {req.petname}.\n\n{history_text}User: {req.message}\nAbu:"
    return {"response": generate(prompt)}


@app.post("/qbit")
async def qbit(req: QbitRequest):
    history_text = ""
    for h in req.history[-6:]:
        history_text += f"User: {h['user']}\nQbit: {h['qbit']}\n"
    context_block = f"\n\nContext from the student's previous learning session:\n{req.context}\n" if req.context else ""
    prompt = f"{QBIT_SYSTEM}{context_block}\n\nThe user's pet name is {req.petname}.\n\n{history_text}User: {req.message}\nQbit:"
    return {"response": generate(prompt)}
