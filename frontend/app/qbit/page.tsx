"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function QbitChat() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [petname, setPetname] = useState("friend");
  const [userId, setUserId] = useState<string | null>(null);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);

  const conceptIdRef = useRef<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gv_current_user");
    if (!raw) { router.push("/login"); return; }
    try {
      const parsed = JSON.parse(raw);
      setUserId(parsed.id);
    } catch {}

    const stored = sessionStorage.getItem("gv_petname");
    if (stored) setPetname(stored);

    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get("topic");
    if (topicId) {
      setConceptId(topicId);
      conceptIdRef.current = topicId;
      supabase.from("concepts").select("name").eq("id", topicId).single().then(({ data }) => {
        if (data && messages.length === 0) {
          setMessages([{ sender: "qbit", text: `I see we are revising ${data.name}. Do you have any specific doubts before the quiz?` }]);
        }
      });
    }

    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event: any) => {
        setMessage(event.results[0][0].transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try { recognitionRef.current.stop(); } catch {}
      setTimeout(() => {
        try { setIsListening(true); recognitionRef.current.start(); } catch {}
      }, 100);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleFinish = () => {
    setShowQuiz(true);
  };

  const submitQuizScore = async () => {
    setIsSubmitting(true);
    const cid = conceptIdRef.current || conceptId;
    if (userId && cid) {
      try {
        await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, conceptId: cid, score: quizScore, total: 10 })
        });
      } catch (e) { console.error(e); }
    }
    setIsSubmitting(false);
    router.push("/");
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage("");
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);

    // Auto-create concept for tracking if not set
    if (!conceptIdRef.current) {
      const { data: existing } = await supabase.from("concepts").select("id").ilike("name", userMsg).single();
      if (existing) {
        setConceptId(existing.id); conceptIdRef.current = existing.id;
      } else {
        const { data: created } = await supabase.from("concepts").insert({ name: userMsg, subject: userMsg }).select("id").single();
        if (created) { setConceptId(created.id); conceptIdRef.current = created.id; }
      }
    }

    const history = messages.map((m) => ({
      user: m.sender === "user" ? m.text : "",
      qbit: m.sender === "qbit" ? m.text : "",
    })).filter((h) => h.user || h.qbit);

    const res = await fetch("http://127.0.0.1:8000/qbit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg, petname, history }),
    });

    const data = await res.json();
    setMessages((prev) => [...prev, { sender: "qbit", text: data.response }]);
    speak(data.response);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video autoPlay loop muted playsInline preload="none"
        className="absolute top-0 left-0 w-full h-full object-cover z-0 scale-110">
        <source src="/clouds.mp4" type="video/mp4" preload="none" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/30 via-purple-200/30 to-blue-200/30 z-0" />

      <div className="relative z-10 p-6 min-h-screen">
        <div className="flex items-center justify-between max-w-2xl mx-auto mb-6">
          <button onClick={() => router.push("/")}
            className="text-purple-700 hover:text-purple-900 text-base font-semibold">
            Back
          </button>
          <h1 className="text-3xl font-bold text-purple-900">Qbit</h1>
          <button onClick={handleFinish}
            className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-semibold py-1.5 px-4 rounded-full shadow-sm transition-colors">
            Submit Score
          </button>
        </div>

        <div className="backdrop-blur-lg bg-white/40 border border-purple-200 p-4 h-96 overflow-y-auto mb-4 rounded-2xl shadow-lg max-w-2xl mx-auto">
          {messages.length === 0 && (
            <p className="text-purple-500 text-base text-center mt-8 italic">Ask Qbit your doubts...</p>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`mb-3 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow text-base leading-relaxed ${
                msg.sender === "user"
                  ? "bg-purple-500 text-white rounded-br-sm"
                  : "bg-white/60 text-purple-900 rounded-bl-sm border border-purple-200"
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 max-w-2xl mx-auto items-center">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`px-4 py-3 rounded-xl text-base font-semibold shadow transition-all ${
              isListening ? "bg-red-500 text-white" : "bg-purple-600 text-white hover:bg-purple-700"
            }`}>
            {isListening ? "Stop" : "Voice"}
          </button>
          <input
            className="border border-purple-300 bg-white/40 backdrop-blur p-3 flex-1 rounded-xl text-base text-purple-900 placeholder-purple-400 outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Ask your doubt..."
            value={message} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          <button className="bg-purple-600 text-white px-5 py-3 rounded-xl hover:bg-purple-700 text-base font-semibold shadow transition-all"
            onClick={handleSubmit}>Send</button>
          {isSpeaking && (
            <button onClick={stopSpeaking}
              className="bg-red-500 text-white px-4 py-3 rounded-xl text-base font-semibold shadow">
              Stop
            </button>
          )}
        </div>
      </div>

      {/* QUIZ SCORE MODAL */}
      {showQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="backdrop-blur-xl bg-white/60 border border-purple-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-bold text-purple-900">Quiz Completed! 📝</h2>
            <p className="text-purple-700 text-sm">How many questions did you answer correctly out of 10?</p>
            
            <input type="range" min="0" max="10" value={quizScore} onChange={(e) => setQuizScore(parseInt(e.target.value))} 
              className="w-full accent-purple-600 mt-2" />
            <span className="text-4xl font-bold text-purple-900">{quizScore} <span className="text-xl text-purple-600">/ 10</span></span>
            
            <button disabled={isSubmitting} onClick={submitQuizScore}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl shadow w-full mt-2 transition-all disabled:opacity-60">
              {isSubmitting ? "Saving..." : "Submit Score"}
            </button>
            
            {!isSubmitting && (
              <button onClick={() => router.push("/")} className="mt-2 text-sm text-purple-500 hover:text-purple-700 underline">
                Skip & Return Home
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
