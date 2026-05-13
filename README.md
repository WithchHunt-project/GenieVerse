# GenieVerse

An AI-Powered Personalized Learning Companion

**Problem statement:** Many learners struggle with one-size-fits-all education systems, lack of revision planning, and low engagement.
GenieVerse addresses this by providing adaptive AI-based personalized (interest-based conceptual) learning companions with memory-aware revision support.

GenieVerse is an intelligent learning platform designed to make education interactive, adaptive, and personalized.
The application features four unique AI companions — Jinn, Mirrora, Abu, and Qbit — each designed with a different teaching style to support diverse learning needs.

The platform also includes a Digital Twin Learning Tracker powered by Spaced Repetition, enabling personalized revision schedules, weak-topic detection, and memory retention analysis.

---

## Project Structure

```
GenieVerse/
├── backend/        # FastAPI server handling AI and ML logic
└── frontend/       # Next.js application handling UI and Supabase integration
```

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Frontend** | Next.js, React, Tailwind CSS, Supabase |
| **Backend** | Python, FastAPI, Google Gemini API (google-genai SDK) |
| **Machine Learning** | Random Forest (Interest Prediction), Logistic Regression (Forgetting Pattern Prediction) |
| **Database** | Supabase PostgreSQL |

---

## System Requirements

| Requirement | Version |
|-------------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | Latest |

---

## AI Model Configuration

GenieVerse uses the Google Gemini API for conversational learning and intelligent responses.

**Primary Model:** `gemini-2.5-flash`

Get your API key from: [Google AI Studio](https://aistudio.google.com/app/apikey)

Replace the API key in `backend/main.py`:
```python
API_KEY = "your_api_key_here"
```

---

## Database Setup (Supabase)

Create a free project at: [Supabase](https://supabase.com)

Open the SQL Editor and execute the provided SQL schema to create:
- User Profiles
- Concepts
- User Progress
- Digital Twin Tracking
- Quiz Results

The schema also inserts default concepts required for the recommendation engine.

---

## Frontend Environment Setup

Create a `.env.local` file inside the `frontend/` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Running the Application

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
# source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open the application in your browser: [http://localhost:3000](http://localhost:3000)

---

## Core Features

| Module | Route | Description |
|--------|-------|-------------|
| Home Dashboard | `/` | Displays revision reminders, weak topics, and Digital Twin insights |
| Jinn | `/chat` | Explains concepts using personalized interest-based analogies |
| Mirrora | `/mirrora` | Encourages reflective learning through guided questioning |
| Abu | `/abu` | Provides beginner-friendly and simplified explanations |
| Qbit | `/qbit` | Offers fast doubt resolution and quiz-based evaluation |

---

## Intelligent Learning Features

- Personalized AI tutoring experience
- Interest-based concept explanation
- Weak-topic identification
- Memory retention tracking
- Spaced repetition revision system
- Quiz score analysis
- Adaptive learning recommendations

---

## Accessibility Features

- Voice Input Support
- Text-to-Speech Responses
- Interactive Conversational Learning
- Beginner-Friendly Interface

---

## Digital Twin Learning System

The Digital Twin module continuously analyzes:
- Learning patterns
- Revision frequency
- Topic difficulty
- Memory retention score
- Forgetting trends

This helps GenieVerse recommend:
- When to revise
- Which topics need improvement
- Personalized learning paths

---

## Vision

GenieVerse aims to create a more human-centered AI learning experience where education becomes:
- Personalized
- Interactive
- Adaptive
- Accessible to every learner

### Future Scope

- Mobile application deployment for Android and iOS platforms
- Personalized study schedule generation based on user learning patterns
- Multi-language support for regional and global accessibility
- Advanced analytics dashboard for tracking long-term learning progress
- AI-generated notes, flashcards, and revision summaries
