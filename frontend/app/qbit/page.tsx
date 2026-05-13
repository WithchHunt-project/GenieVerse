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
  const [sessionContext, setSessionContext] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showNextStep, setShowNextStep] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);
  const conceptIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gv_current_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    setUserId(parsed.id);
    const stored = sessionStorage.getItem("gv_petname");
    if (stored) setPetname(stored);

    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get("topic");

    if (topicId) {
      setConceptId(topicId);
      conceptIdRef.current = topicId;

      const savedHistory = localStorage.getItem(`gv_qbit_history_${parsed.id}_${topicId}`);
      const loadedMessages: any[] = savedHistory ? JSON.parse(savedHistory) : [];

      const jinnCtx = sessionStorage.getItem(`gv_jinn_context_${topicId}`) || "";
      const mirroraSaved = localStorage.getItem(`gv_mirrora_history_${parsed.id}_${topicId}`);
      let ctx = "";
      if (jinnCtx) ctx += `Jinn session:\n${jinnCtx}\n\n`;
      if (mirroraSaved) {
        const mm: any[] = JSON.parse(mirroraSaved);
        ctx += `Mirrora session:\n${mm.map(m => `${m.sender === "user" ? "Student" : "Mirrora"}: ${m.text}`).join("\n")}`;
      }
      setSessionContext(ctx);

      supabase.from("concepts").select("name").eq("id", topicId).single().then(({ data }) => {
        if (data) {
          if (loadedMessages.length === 0) {
            const intro = ctx
              ? `I've seen your session on ${data.name}. Any doubts before we test your understanding?`
              : `We are revising ${data.name}. Any specific doubts before the quiz?`;
            setMessages([{ sender: "qbit", text: intro }]);
          } else {
            setMessages(loadedMessages);
          }
        }
      });
    }

    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SR();
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (e: any) => { setMessage(e.results[0][0].transcript); setIsListening(false); };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    if (userId && conceptIdRef.current && messages.length > 0)
      localStorage.setItem(`gv_qbit_history_${userId}_${conceptIdRef.current}`, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, userId]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try { recognitionRef.current.stop(); } catch {}
      setTimeout(() => { try { setIsListening(true); recognitionRef.current.start(); } catch {} }, 100);
    }
  };
  const stopListening = () => { if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } };
  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1;
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  };
  const stopSpeaking = () => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); setIsSpeaking(false); } };

  const submitQuizScore = async () => {
    setIsSubmitting(true);
    const cid = conceptIdRef.current || conceptId;
    if (userId && cid) {
      try {
        await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, conceptId: cid, score: quizScore, total: 10 }) });
      } catch (e) { console.error(e); }
    }
    setIsSubmitting(false);
    setShowQuiz(false);
    setShowNextStep(true);
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage("");

    if (!conceptIdRef.current) {
      const { data: ex } = await supabase.from("concepts").select("id").ilike("name", userMsg).single();
      if (ex) { setConceptId(ex.id); conceptIdRef.current = ex.id; }
      else {
        const { data: cr } = await supabase.from("concepts").insert({ name: userMsg, subject: userMsg }).select("id").single();
        if (cr) { setConceptId(cr.id); conceptIdRef.current = cr.id; }
      }
    }

    const updated = [...messages, { sender: "user", text: userMsg }];
    setMessages(updated);
    const history = updated.map(m => ({ user: m.sender === "user" ? m.text : "", qbit: m.sender === "qbit" ? m.text : "" })).filter(h => h.user || h.qbit);

    const res = await fetch("http://127.0.0.1:8000/qbit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg, petname, history, context: sessionContext }),
    });
    const data = await res.json();
    setMessages(prev => [...prev, { sender: "qbit", text: data.response }]);
    speak(data.response);
  };

  return (
    <div className="relative flex flex-col" style={{ height: "100dvh" }}>
      <video autoPlay loop muted playsInline preload="none" className="absolute top-0 left-0 w-full h-full object-cover z-0 scale-110">
        <source src="/clouds.mp4" type="video/mp4" preload="none" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/30 via-purple-200/30 to-blue-200/30 z-0" />
      <div className="relative z-10 flex flex-col p-6" style={{ height: "100dvh" }}>
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full mb-4 flex-shrink-0">
          <button onClick={() => router.push("/")} className="text-purple-700 hover:text-purple-900 text-base font-semibold">Back</button>
          <h1 className="text-3xl font-bold text-purple-900">Qbit</h1>
          <button onClick={() => setShowQuiz(true)} className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-semibold py-1.5 px-4 rounded-full shadow-sm transition-colors">Submit Score</button>
        </div>
        <div className="backdrop-blur-lg bg-white/40 border border-purple-200 p-4 overflow-y-auto mb-4 rounded-2xl shadow-lg max-w-2xl mx-auto w-full" style={{ flex: "1 1 0", minHeight: 0 }}>
          {messages.length === 0 && <p className="text-purple-500 text-base text-center mt-8 italic">Ask Qbit your doubts...</p>}
          {messages.map((msg, i) => (
            <div key={i} className={`mb-3 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow text-base leading-relaxed ${msg.sender === "user" ? "bg-purple-500 text-white rounded-br-sm" : "bg-white/60 text-purple-900 rounded-bl-sm border border-purple-200"}`}>
                <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2 max-w-2xl mx-auto w-full flex-shrink-0 items-center">
          <button onClick={isListening ? stopListening : startListening} className={`px-4 py-3 rounded-xl text-base font-semibold shadow transition-all ${isListening ? "bg-red-500 text-white" : "bg-purple-600 text-white hover:bg-purple-700"}`}>{isListening ? "Stop" : "Voice"}</button>
          <input className="border border-purple-300 bg-white/40 backdrop-blur p-3 flex-1 rounded-xl text-base text-purple-900 placeholder-purple-400 outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Ask your doubt..." value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          <button className="bg-purple-600 text-white px-5 py-3 rounded-xl hover:bg-purple-700 text-base font-semibold shadow transition-all" onClick={handleSubmit}>Send</button>
          {isSpeaking && <button onClick={stopSpeaking} className="bg-red-500 text-white px-4 py-3 rounded-xl text-base font-semibold shadow">Stop</button>}
        </div>
      </div>

      {showQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="backdrop-blur-xl bg-white/60 border border-purple-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-bold text-purple-900">Quiz Completed! 📝</h2>
            <p className="text-purple-700 text-sm">How many did you get right out of 10?</p>
            <input type="range" min="0" max="10" value={quizScore} onChange={e => setQuizScore(parseInt(e.target.value))} className="w-full accent-purple-600 mt-2" />
            <span className="text-4xl font-bold text-purple-900">{quizScore} <span className="text-xl text-purple-600">/ 10</span></span>
            <button disabled={isSubmitting} onClick={submitQuizScore} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl shadow w-full mt-2 disabled:opacity-60">
              {isSubmitting ? "Saving..." : "Submit Score"}
            </button>
            {!isSubmitting && <button onClick={() => router.push("/")} className="text-sm text-purple-500 hover:text-purple-700 underline">Skip & Return Home</button>}
          </div>
        </div>
      )}

      {showNextStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="backdrop-blur-xl bg-white/60 border border-purple-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-bold text-purple-900">Great session! ⚛️</h2>
            <p className="text-purple-700 text-sm">What would you like to do next?</p>
            <button onClick={() => router.push(`/mirrora?topic=${conceptId}`)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl shadow transition-all">🪞 Reflect more with Mirrora</button>
            <button onClick={() => router.push("/")} className="text-sm text-purple-500 hover:text-purple-700 underline">Return Home</button>
          </div>
        </div>
      )}
    </div>
  );
}
