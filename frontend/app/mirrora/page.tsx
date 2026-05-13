"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function MirroraChat() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [petname, setPetname] = useState("friend");
  const [userId, setUserId] = useState<string | null>(null);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [jinnContext, setJinnContext] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showNextStep, setShowNextStep] = useState(false);
  const recognitionRef = useRef<any>(null);
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
    const from = urlParams.get("from");

    if (topicId) {
      setConceptId(topicId);

      // Load persistent chat history for this concept
      const historyKey = `gv_mirrora_history_${parsed.id}_${topicId}`;
      const savedHistory = localStorage.getItem(historyKey);
      const loadedMessages: any[] = savedHistory ? JSON.parse(savedHistory) : [];

      // Load Jinn context if coming from Jinn
      let ctx = "";
      if (from === "jinn") {
        ctx = sessionStorage.getItem(`gv_jinn_context_${topicId}`) || "";
        setJinnContext(ctx);
      }

      supabase.from("concepts").select("name").eq("id", topicId).single().then(({ data }) => {
        if (data) {
          if (loadedMessages.length === 0) {
            const intro = from === "jinn" && ctx
              ? `I can see you just learned about ${data.name} with Jinn. Now let's reflect — explain it back to me in your own words, and I'll guide you deeper.`
              : `I see you are revisiting ${data.name}. Try to explain it to me in your own words, and I'll help guide you!`;
            setMessages([{ sender: "mirrora", text: intro }]);
          } else {
            setMessages(loadedMessages);
          }
        }
      });
    }

    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
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

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (userId && conceptId && messages.length > 0) {
      localStorage.setItem(`gv_mirrora_history_${userId}_${conceptId}`, JSON.stringify(messages));
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, userId, conceptId]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try { recognitionRef.current.stop(); } catch {}
      setTimeout(() => {
        try { setIsListening(true); recognitionRef.current.start(); } catch {}
      }, 100);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage("");
    const updatedMessages = [...messages, { sender: "user", text: userMsg }];
    setMessages(updatedMessages);

    const history = updatedMessages.map((m) => ({
      user: m.sender === "user" ? m.text : "",
      mirrora: m.sender === "mirrora" ? m.text : "",
    })).filter((h) => h.user || h.mirrora);

    const res = await fetch("http://127.0.0.1:8000/mirrora", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg, petname, history, context: jinnContext }),
    });

    const data = await res.json();
    setMessages((prev) => [...prev, { sender: "mirrora", text: data.response }]);
    speak(data.response);
  };

  return (
    <div className="relative flex flex-col" style={{ height: "100dvh" }}>
      <video autoPlay loop muted playsInline preload="none"
        className="absolute top-0 left-0 w-full h-full object-cover z-0 scale-110">
        <source src="/clouds.mp4" type="video/mp4" preload="none" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/30 via-purple-200/30 to-blue-200/30 z-0" />

      <div className="relative z-10 flex flex-col p-6" style={{ height: "100dvh" }}>
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full mb-4 flex-shrink-0">
          <button onClick={() => router.push("/")} className="text-purple-700 hover:text-purple-900 text-base font-semibold">Back</button>
          <h1 className="text-3xl font-bold text-purple-900">Mirrora</h1>
          <button onClick={() => setShowNextStep(true)}
            className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-semibold py-1.5 px-4 rounded-full shadow-sm transition-colors">
            Finish Session
          </button>
        </div>

        <div className="backdrop-blur-lg bg-white/40 border border-purple-200 p-4 overflow-y-auto mb-4 rounded-2xl shadow-lg max-w-2xl mx-auto w-full" style={{ flex: "1 1 0", minHeight: 0 }}>
          {messages.length === 0 && (
            <p className="text-purple-500 text-base text-center mt-8 italic">Explain a concept to Mirrora...</p>
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
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 max-w-2xl mx-auto w-full flex-shrink-0 items-center">
          <button onClick={isListening ? stopListening : startListening}
            className={`px-4 py-3 rounded-xl text-base font-semibold shadow transition-all ${isListening ? "bg-red-500 text-white" : "bg-purple-600 text-white hover:bg-purple-700"}`}>
            {isListening ? "Stop" : "Voice"}
          </button>
          <input
            className="border border-purple-300 bg-white/40 backdrop-blur p-3 flex-1 rounded-xl text-base text-purple-900 placeholder-purple-400 outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Explain a concept..."
            value={message} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          <button className="bg-purple-600 text-white px-5 py-3 rounded-xl hover:bg-purple-700 text-base font-semibold shadow transition-all"
            onClick={handleSubmit}>Send</button>
          {isSpeaking && (
            <button onClick={stopSpeaking} className="bg-red-500 text-white px-4 py-3 rounded-xl text-base font-semibold shadow">Stop</button>
          )}
        </div>
      </div>

      {/* NEXT STEP MODAL */}
      {showNextStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="backdrop-blur-xl bg-white/60 border border-purple-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-bold text-purple-900">Well reflected! ✨</h2>
            <p className="text-purple-700 text-sm">What would you like to do next?</p>
            <button
              onClick={() => router.push(`/qbit?topic=${conceptId}&from=mirrora`)}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-xl shadow transition-all">
              ⚛️ Clear Doubts with Qbit
            </button>
            <button onClick={() => router.push("/")} className="text-sm text-purple-500 hover:text-purple-700 underline">
              Return Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
