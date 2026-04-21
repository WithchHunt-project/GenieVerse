"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function JinnChat() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [interest, setInterest] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const conceptIdRef = useRef<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("gv_current_user");
    if (!raw) { router.push("/login"); return; }
    try {
      const parsed = JSON.parse(raw);
      setUserId(parsed.id);
    } catch {}

    setStartTime(Date.now());

    // Check URL for concept ID
    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get("topic");
    if (topicId) {
      setConceptId(topicId);
      conceptIdRef.current = topicId;
      supabase.from("concepts").select("name").eq("id", topicId).single().then(({ data }) => {
        if (data) setTopic(data.name);
      });
    }
  }, [router]);

  const handleFinish = async () => {
    setShowRating(true);
  };

  const submitProgressAndRating = async (selectedRating: number) => {
    setIsSubmitting(true);
    setRating(selectedRating);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    if (userId && conceptIdRef.current) {
      try {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, conceptId: conceptIdRef.current, timeSpent })
        });
        await fetch("/api/rating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, conceptId: conceptIdRef.current, rating: selectedRating })
        });
      } catch (e) {
        console.error(e);
      }
    }

    setIsSubmitting(false);
    router.push("/");
  };

  const handleSubmit = async () => {
    if (!topic || !interest) return;

    const userMessage = `Explain ${topic} with ${interest}`;
    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);

    // Find or create concept so progress can be tracked
    if (!conceptId) {
      let { data: existing } = await supabase.from("concepts").select("id").ilike("name", topic).single();
      if (existing) {
        setConceptId(existing.id);
        conceptIdRef.current = existing.id;
      } else {
        const { data: created } = await supabase.from("concepts").insert({ name: topic, subject: topic }).select("id").single();
        if (created) { setConceptId(created.id); conceptIdRef.current = created.id; }
      }
    }

    const res = await fetch("http://127.0.0.1:8000/comrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, interest }),
    });

    const data = await res.json();
    setMessages((prev) => [...prev, { sender: "bot", text: data.response }]);
    setTopic("");
    setInterest("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* VIDEO BACKGROUND */}
      <video autoPlay loop muted playsInline preload="none"
        className="absolute top-0 left-0 w-full h-full object-cover z-0 scale-110">
        <source src="/clouds.mp4" type="video/mp4" preload="none" />
      </video>

      {/* GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/30 via-purple-200/30 to-blue-200/30 z-0" />

      {/* MAIN UI */}
      <div className="relative z-10 p-6 min-h-screen">

        {/* Header */}
        <div className="flex items-center justify-between max-w-2xl mx-auto mb-6">
          <button onClick={() => router.push("/")}
            className="text-purple-700 hover:text-purple-900 text-base font-semibold">
            Back
          </button>
          <h1 className="text-3xl font-bold text-purple-900">Jinn</h1>
          <button onClick={handleFinish}
            className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-semibold py-1.5 px-4 rounded-full shadow-sm transition-colors">
            Finish Session
          </button>
        </div>

        {/* Chat Box */}
        <div className="backdrop-blur-lg bg-white/40 border border-purple-200 p-4 h-96 overflow-y-auto mb-4 rounded-2xl shadow-lg max-w-2xl mx-auto">
          {messages.length === 0 && (
            <p className="text-purple-500 text-base text-center mt-8 italic">Ask Jinn anything...</p>
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

        {/* Inputs */}
        <div className="flex gap-2 max-w-2xl mx-auto">
          <input className="border border-purple-300 bg-white/40 backdrop-blur p-3 flex-1 rounded-xl text-base text-purple-900 placeholder-purple-400 outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Enter Topic..."
            value={topic} onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          <input className="border border-purple-300 bg-white/40 backdrop-blur p-3 flex-1 rounded-xl text-base text-purple-900 placeholder-purple-400 outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Enter Interest..."
            value={interest} onChange={(e) => setInterest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          <button className="bg-purple-600 text-white px-5 rounded-xl hover:bg-purple-700 font-semibold shadow transition-all hover:-translate-y-0.5"
            onClick={handleSubmit}>Send</button>
        </div>

      </div>

      {/* RATING MODAL */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="backdrop-blur-xl bg-white/60 border border-purple-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-bold text-purple-900">Session Complete! 🎉</h2>
            <p className="text-purple-700 text-sm">How well did you understand this topic?</p>
            <div className="flex gap-2 my-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} disabled={isSubmitting} onClick={() => submitProgressAndRating(star)}
                  className={`text-4xl transition-transform hover:scale-125 focus:outline-none ${rating >= star ? 'text-yellow-400' : 'text-gray-300 drop-shadow-sm grayscale opacity-70 hover:grayscale-0 hover:opacity-100'}`}>
                  ⭐
                </button>
              ))}
            </div>
            {isSubmitting && <p className="text-sm text-purple-600 animate-pulse">Saving your progress...</p>}
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
