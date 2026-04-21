"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function MirroraChat() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [petname, setPetname] = useState("friend");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!sessionStorage.getItem("gv_current_user")) router.push("/login");
    const stored = sessionStorage.getItem("gv_petname");
    if (stored) setPetname(stored);

    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get("topic");
    if (topicId) {
      supabase.from("concepts").select("name").eq("id", topicId).single().then(({ data }) => {
        if (data && messages.length === 0) {
          setMessages([{ sender: "mirrora", text: `I see you are forgetting ${data.name}. Try to explain it to me in your own words, and I'll help guide you!` }]);
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
      utterance.rate = 0.9;
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

  const handleSubmit = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage("");
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);

    const history = messages.map((m) => ({
      user: m.sender === "user" ? m.text : "",
      mirrora: m.sender === "mirrora" ? m.text : "",
    })).filter((h) => h.user || h.mirrora);

    const res = await fetch("http://127.0.0.1:8000/mirrora", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg, petname, history }),
    });

    const data = await res.json();
    setMessages((prev) => [...prev, { sender: "mirrora", text: data.response }]);
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
          <h1 className="text-3xl font-bold text-purple-900">Mirrora</h1>
          <div className="w-12" />
        </div>

        <div className="backdrop-blur-lg bg-white/40 border border-purple-200 p-4 h-96 overflow-y-auto mb-4 rounded-2xl shadow-lg max-w-2xl mx-auto">
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
            placeholder="Explain a concept..."
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
    </div>
  );
}
