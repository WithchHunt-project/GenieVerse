"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Stage = "lamp" | "genie" | "done";

export default function Home() {
  const router = useRouter();
  const [petName, setPetName] = useState("Friend");
  const [stage, setStage] = useState<Stage>("lamp");
  const [lampVisible, setLampVisible] = useState(true);
  const [genieVisible, setGenieVisible] = useState(false);
  const [msgVisible, setMsgVisible] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [digitalTwin, setDigitalTwin] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gv_current_user");
    if (!raw) { router.push("/login"); return; }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.id) setUserId(parsed.id);
    } catch {}
    const stored = sessionStorage.getItem("gv_petname");
    if (stored) setPetName(stored);

    // Skip lamp if returning from a session
    if (sessionStorage.getItem("gv_visited")) {
      setStage("done");
    } else {
      sessionStorage.setItem("gv_visited", "1");
    }
  }, [router]);

  useEffect(() => {
    if (stage === "done" && userId) {
      console.log("Fetching data for userId:", userId);

      fetch(`/api/revise?userId=${userId}`)
        .then(res => res.json())
        .then(data => { 
          console.log("Revise API response:", data);
          if (Array.isArray(data)) setRevisions(data); 
        })
        .catch(err => console.error("Revise error:", err));

      fetch(`/api/recommend?userId=${userId}`)
        .then(res => res.json())
        .then(data => { 
          console.log("Recommend API response:", data);
          if (Array.isArray(data)) setRecommendations(data);
        })
        .catch(err => console.error("Recommend error:", err));

      fetch(`/api/digital-twin?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          console.log("Digital twin API response:", data);
          setDigitalTwin(data);
        })
        .catch(err => console.error("Digital twin error:", err));
    }
  }, [stage, userId]);

  function handleLampClick() {
    setLampVisible(false);
    const t1 = setTimeout(() => setGenieVisible(true), 600);
    const t2 = setTimeout(() => setMsgVisible(true), 1200);
    const t3 = setTimeout(() => setMsgVisible(false), 6000);
    const t4 = setTimeout(() => setGenieVisible(false), 6600);
    const t5 = setTimeout(() => setStage("done"), 7200);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* VIDEO BACKGROUND */}
      <video autoPlay loop muted playsInline preload="none"
        className="absolute top-0 left-0 w-full h-full object-cover z-0 scale-110">
        <source src="/clouds.mp4" type="video/mp4" preload="none" />
      </video>

      {/* GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/30 via-purple-200/30 to-blue-200/30 z-0" />

      {/* ── LAMP INTRO SCREEN ── */}
      {stage !== "done" && (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center gap-6 p-6">

          {/* Title — hide when genie is showing */}
          <h1 className={`text-4xl font-bold text-purple-900 transition-opacity duration-500 ${genieVisible ? "opacity-0" : "opacity-100"}`}>GenieVerse</h1>

          {/* Lamp */}
          <div className={`flex flex-col items-center gap-4 transition-all duration-500 ${lampVisible ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}>
            <p className="text-purple-700 text-sm italic">Tap the lamp to begin your journey...</p>
            <button onClick={handleLampClick} className="hover:scale-110 active:scale-95 transition-transform">
              <Image src="/lamp.png" alt="Magic Lamp" width={400} height={400} className="drop-shadow-xl" />
            </button>
          </div>

          {/* Genie + message — full screen overlay, no overlap */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 transition-all duration-700 ${genieVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <Image
              src="/genie.png"
              alt="Genie"
              width={600}
              height={600}
              className="drop-shadow-2xl animate-genie-pop flex-shrink-0"
            />
            <div className={`transition-all duration-700 text-center ${msgVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              <p style={{ fontFamily: "Nyala, 'Times New Roman', serif" }}
                className="text-purple-900 text-3xl drop-shadow-lg">
                Welcome to GenieVerse,
              </p>
              <p style={{ fontFamily: "Nyala, 'Times New Roman', serif" }}
                className="text-purple-600 text-4xl font-semibold drop-shadow-lg mt-1">
                {petName}!
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ── MAIN HOME SCREEN ── */}
      {stage === "done" && (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center gap-8 p-6 transition-opacity duration-700 opacity-100">

          <h1 className="text-4xl font-bold text-purple-900">GenieVerse</h1>
          <p className="text-purple-700 text-sm">Choose your companion</p>

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">

            <button onClick={() => router.push("/chat")}
              className="backdrop-blur-lg bg-white/40 border border-purple-200 rounded-2xl shadow-lg p-6 flex flex-col items-center gap-2 hover:bg-white/60 hover:scale-105 transition-all">
              <span className="font-bold text-purple-900 text-xl" style={{ fontFamily: "var(--font-poppins)" }}>Jinn</span>
            </button>

            <button onClick={() => router.push("/mirrora")}
              className="backdrop-blur-lg bg-white/40 border border-purple-200 rounded-2xl shadow-lg p-6 flex flex-col items-center gap-2 hover:bg-white/60 hover:scale-105 transition-all">
              <span className="font-bold text-purple-900 text-xl" style={{ fontFamily: "var(--font-poppins)" }}>Mirrora</span>
            </button>

            <button onClick={() => router.push("/abu")}
              className="backdrop-blur-lg bg-white/40 border border-purple-200 rounded-2xl shadow-lg p-6 flex flex-col items-center gap-2 hover:bg-white/60 hover:scale-105 transition-all">
              <span className="font-bold text-purple-900 text-xl" style={{ fontFamily: "var(--font-poppins)" }}>Abu</span>
            </button>

            <button onClick={() => router.push("/qbit")}
              className="backdrop-blur-lg bg-white/40 border border-purple-200 rounded-2xl shadow-lg p-6 flex flex-col items-center gap-2 hover:bg-white/60 hover:scale-105 transition-all">
              <span className="font-bold text-purple-900 text-xl" style={{ fontFamily: "var(--font-poppins)" }}>Qbit</span>
            </button>

          </div>

          {/* YOUR GENIE SUGGESTS SECTION */}
          <div className="w-full max-w-sm flex flex-col gap-4 mt-2">
            <h2 className="text-xl font-bold text-purple-900 flex items-center gap-2">
              <span></span> Your Genie Suggests
            </h2>

            {revisions.length > 0 && (
              <div className="backdrop-blur-lg bg-white/40 border border-red-200 rounded-2xl shadow-lg p-4 flex flex-col gap-2">
                <h3 className="text-red-700 font-semibold text-sm flex items-center gap-1">
                  <span></span> Revision Alert
                </h3>
                {revisions.slice(0, 2).map((rev: any, idx: number) => (
                  <div key={idx} className="bg-white/60 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-purple-900 font-medium text-sm">{rev.concepts?.name || "A concept"}</p>
                      <p className="text-xs text-red-600">You might be forgetting this</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => router.push(`/mirrora?topic=${rev.concept_id}`)} className="text-xl hover:scale-110 transition-transform" title="Explain it (Mirrora)">🪞</button>
                      <button onClick={() => router.push(`/qbit?topic=${rev.concept_id}`)} className="text-xl hover:scale-110 transition-transform" title="Quick Quiz (Qbit)">⚛️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="backdrop-blur-lg bg-white/40 border border-green-200 rounded-2xl shadow-lg p-4 flex flex-col gap-2">
                <h3 className="text-green-700 font-semibold text-sm flex items-center gap-1">
                  <span></span> Learn Next
                </h3>
                {recommendations.slice(0, 2).map((rec: any, idx: number) => (
                  <div key={idx} className="bg-white/60 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-white/80 transition-colors" onClick={() => router.push(`/chat?topic=${rec.id}`)}>
                    <div>
                      <p className="text-purple-900 font-medium text-sm">{rec.name}</p>
                      <p className="text-xs text-green-700">{rec.subject}</p>
                    </div>
                    <span></span>
                  </div>
                ))}
              </div>
            )}

            {digitalTwin?.weak && digitalTwin.weak.length > 0 && (
              <div className="backdrop-blur-lg bg-white/40 border border-orange-200 rounded-2xl shadow-lg p-4 flex flex-col gap-2">
                <h3 className="text-orange-700 font-semibold text-sm flex items-center gap-1">
                  <span></span> Practice Weak Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {digitalTwin.weak.map((topic: string, idx: number) => (
                    <span key={idx} className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-200">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {revisions.length === 0 && recommendations.length === 0 && (!digitalTwin?.weak || digitalTwin.weak.length === 0) && (
              <div className="backdrop-blur-lg bg-white/40 border border-purple-200 rounded-2xl shadow-lg p-4 text-center">
                 <p className="text-sm text-purple-700 italic">No new suggestions yet. Explore the universe!</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
