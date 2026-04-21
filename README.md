# GenieVerse

An AI-powered learning companion app with four characters — Jinn, Mirrora, Abu, and Qbit. Includes a built-in "Digital Twin" Learning Tracker with Spaced Repetition.

---

## Project Structure

```
GenieVerse/
├── backend/        # Python FastAPI server (Handles AI Logic)
└── frontend/       # Next.js app (Handles UI & Supabase API Routes)
```

---

## Requirements & Prerequisites

### System
- Python 3.10 or higher
- Node.js 18 or higher
- npm

### 1. AI Model Setup (Backend)
All features use the **Google Gemini API** (`google-genai` SDK).
- Primary model: `gemini-2.5-flash`

You need a **Gemini API key** from: https://aistudio.google.com/app/apikey

Once you have the key, open `backend/main.py` and replace the value of `API_KEY`:
```python
API_KEY = "your_api_key_here"
```

### 2. Database Setup (Supabase)
This app uses Supabase for user profiles, concepts, and learning tracking. 

1. Create a free project at [Supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your new project and run this entire block to create the database:

```sql
create table if not exists profiles (
  id uuid primary key,
  username text,
  petname text,
  class text,
  interests text,
  initial_interests text[],
  detected_interests text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text,
  difficulty integer default 1,
  tags text[]
);

create table if not exists user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  concept_id uuid references concepts(id) on delete cascade,
  time_spent_seconds integer default 0,
  rating integer,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists digital_twin (
  user_id uuid references profiles(id) on delete cascade,
  concept_id uuid references concepts(id) on delete cascade,
  last_studied_at timestamp with time zone default timezone('utc'::text, now()),
  revision_count integer default 0,
  memory_score integer default 100,
  primary key (user_id, concept_id)
);

create table if not exists quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  concept_id uuid references concepts(id) on delete cascade,
  score integer not null,
  total_questions integer not null,
  taken_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Very Important: Disable RLS for local dev prototype
alter table profiles disable row level security;
alter table concepts disable row level security;
alter table user_progress disable row level security;
alter table digital_twin disable row level security;
alter table quiz_results disable row level security;
alter table profiles drop constraint profiles_id_fkey;

-- Insert Default Concepts so the recommendation engine works
INSERT INTO concepts (name, subject, difficulty, tags) 
VALUES 
  ('Photosynthesis', 'Biology', 2, ARRAY['Science', 'Nature', 'Biology']),
  ('Gravity', 'Physics', 3, ARRAY['Science', 'Physics', 'Space']),
  ('Black Holes', 'Space', 5, ARRAY['Space', 'Physics', 'Astronomy']),
  ('Machine Learning', 'Computer Science', 4, ARRAY['AI', 'Technology', 'Coding']),
  ('The Solar System', 'Astronomy', 1, ARRAY['Space', 'Science', 'Nature']);
```

### 3. Frontend Environment Setup
Create a file named `.env.local` inside the `frontend/` folder. Add your Supabase URL and Anon Key (found in your Supabase Project Settings -> API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Running the Application

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

---

## Features & Modules

| Character / Module | Route | Description |
|---|---|---|
| **Home Dashboard** | `/` | Shows Digital Twin alerts, Revisions, and Weak Topics (Your Genie Suggests) |
| **Jinn** | `/chat` | Explains topics using your interests as an analogy + Time & Rating tracking |
| **Mirrora** | `/mirrora` | Reflective learning guide — asks questions instead of giving direct answers |
| **Abu** | `/abu` | Friendly learning buddy — simple explanations |
| **Qbit** | `/qbit` | Resolves doubts quickly + Quiz Score Tracking |

Mirrora, Abu, and Qbit support **voice input** (browser mic) and **text-to-speech** output.
