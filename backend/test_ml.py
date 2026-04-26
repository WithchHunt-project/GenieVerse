import urllib.request, json

BASE = "http://127.0.0.1:8000"

def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req).read().decode())

# Test 1: Interest Prediction
interest_result = post("/predict-interest", {
    "records": [
        {"time_spent": 25, "quiz_score": 80, "revision_count": 3, "rating": 5, "subject": "Physics"},
        {"time_spent": 5,  "quiz_score": 30, "revision_count": 0, "rating": 2, "subject": "Chemistry"},
        {"time_spent": 20, "quiz_score": 70, "revision_count": 2, "rating": 4, "subject": "Physics"},
        {"time_spent": 3,  "quiz_score": 20, "revision_count": 0, "rating": 1, "subject": "Biology"},
    ]
})
print("=== Interest Prediction ===")
print("Method:", interest_result.get("method"))
print("Interested Subjects:", interest_result.get("interested_subjects"))
print("Scores:", interest_result.get("scores"))

# Test 2: Forgetting Prediction
forgetting_result = post("/predict-forgetting", {
    "records": [
        {"concept_id": "abc1", "subject": "Physics",   "days_gap": 10, "quiz_score": 40, "revision_count": 1, "difficulty": 3},
        {"concept_id": "abc2", "subject": "Chemistry", "days_gap": 1,  "quiz_score": 80, "revision_count": 5, "difficulty": 2},
        {"concept_id": "abc3", "subject": "Biology",   "days_gap": 8,  "quiz_score": 35, "revision_count": 0, "difficulty": 4},
        {"concept_id": "abc4", "subject": "Physics",   "days_gap": 2,  "quiz_score": 90, "revision_count": 4, "difficulty": 1},
    ]
})
print("\n=== Forgetting Prediction ===")
print("Method:", forgetting_result.get("method"))
print("Revise (highest risk first):", forgetting_result.get("revise"))
print("All with probabilities:")
for r in forgetting_result.get("all", []):
    print(f"  {r['subject']} ({r['concept_id']}) -> {r['probability']:.2f} forgetting probability")
