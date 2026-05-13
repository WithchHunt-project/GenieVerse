"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AbuChat() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [petname, setPetname] = useState("friend");
  const [userId, setUserId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gv_current_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    setUserId(parsed.id);

    const stored = sessionStorage.getItem("gv_petname");
    if (stored) setPetname(stored);

    // Load full persistent chat history for Abu
    const saved = localStorage.getItem(`gv_abu_history_${parsed.id}`);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch {}
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
    if (userId && messages.length > 0)
      localStorage.setItem(`gv_abu_history_${userId}`, JSON.stringify(messages));
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
      u.rate = 1; u.pitch = 1.1;
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  };
  const stopSpeaking = () => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); setIsSpeaking(false); } };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage("");
    const updated = [...messages, { sender: "user", text: userMsg }];
    setMessages(updated);

    // Send last 20 messages as history so Abu remembers context
    const history = updated.slice(-20).map(m => ({
      user: m.sender === "user" ? m.text : "",
      abu: m.sender === "abu" ? m.text : "",
    })).filter(h => h.user || h.abu);

    const res = await fetch("http://127.0.0.1:8000/abu", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg, petname, history }),
    });
    const data = await res.json();
    setMessages(prev => [...prev, { sender: "abu", text: data.response }]);
    speak(data.response);
  };

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <video autoPlay loop muted playsInline preload="none" className="absolute top-0 left-0 w-full h-full object-cover z-0 scale-110">
        <source src="/clouds.mp4" type="video/mp4" preload="none" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/30 via-purple-200/30 to-blue-200/30 z-0" />
      <div className="relative z-10 flex flex-col flex-1 min-h-0 p-6">
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full mb-4 flex-shrink-0">
          <button onClick={() => router.push("/")} className="text-purple-700 hover:text-purple-900 text-base font-semibold">Back</button>
          <h1 className="text-3xl font-bold text-purple-900">Abu</h1>
          <button onClick={() => { if (userId) { localStorage.removeItem(`gv_abu_history_${userId}`); setMessages([]); } }}
            className="text-xs text-purple-400 hover:text-red-500 underline">Clear Chat</button>
        </div>
        <div className="backdrop-blur-lg bg-white/40 border border-purple-200 p-4 flex-1 min-h-0 overflow-y-auto mb-4 rounded-2xl shadow-lg max-w-2xl mx-auto w-full">
          {messages.length === 0 && <p className="text-purple-500 text-base text-center mt-8 italic">Ask Abu anything...</p>}
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
            placeholder="Ask Abu anything..." value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          <button className="bg-purple-600 text-white px-5 py-3 rounded-xl hover:bg-purple-700 text-base font-semibold shadow transition-all" onClick={handleSubmit}>Send</button>
          {isSpeaking && <button onClick={stopSpeaking} className="bg-red-500 text-white px-4 py-3 rounded-xl text-base font-semibold shadow">Stop</button>}
        </div>
      </div>
    </div>
  );
}
