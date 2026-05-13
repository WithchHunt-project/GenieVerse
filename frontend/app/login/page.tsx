"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // Signup fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [petname, setPetname] = useState("");
  const [cls, setCls] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [signupPw, setSignupPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const SUGGESTED_INTERESTS = ["Cars", "Sports", "Music", "Art", "Cooking", "Gaming", "Nature", "Space", "Technology", "Movies", "Animals", "Travel"];

  function addInterest(val: string) {
    const trimmed = val.trim();
    if (!trimmed || selectedInterests.length >= 4 || selectedInterests.map(i => i.toLowerCase()).includes(trimmed.toLowerCase())) return;
    setSelectedInterests(prev => [...prev, trimmed]);
    setInterestInput("");
  }

  function removeInterest(i: string) {
    setSelectedInterests(prev => prev.filter(x => x !== i));
  }

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 3200);
    return () => clearTimeout(t);
  }, []);

  function getUsers(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem("gv_users") || "{}"); } catch { return {}; }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    const users = getUsers();
    const key = loginId.includes("@")
      ? Object.keys(users).find(k => users[k].email === loginId)
      : Object.keys(users).find(k => users[k].username === loginId);
    if (!key || users[key].password !== loginPw) {
      setLoginError("Invalid username/email or password.");
      setLoading(false);
      return;
    }
    const user = users[key];
    sessionStorage.setItem("gv_current_user", JSON.stringify({ id: key, email: user.email }));
    sessionStorage.setItem("gv_petname", user.petname);

    const storedInterests = Array.isArray(user.interests)
      ? user.interests
      : (user.interests ? user.interests.split(",").map((s: string) => s.trim()) : []);
    await supabase.from("profiles").upsert({
      id: key,
      username: user.username,
      petname: user.petname,
      class: user.class,
      interests: user.interests,
      initial_interests: storedInterests,
      detected_interests: storedInterests
    }, { onConflict: "id" });

    setLoading(false);
    router.push("/");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError("");
    if (signupPw.length < 6) { setSignupError("Password must be at least 6 characters."); return; }
    if (signupPw !== confirmPw) { setSignupError("Passwords do not match."); return; }
    if (selectedInterests.length < 1) { setSignupError("Please add at least 1 interest."); return; }
    setLoading(true);
    const users = getUsers();
    const exists = Object.values(users).some((u: any) => u.email === email || u.username === name);
    if (exists) { setSignupError("Username or email already taken."); setLoading(false); return; }
    const id = crypto.randomUUID();
    users[id] = { email, username: name, password: signupPw, petname, class: cls, interests: selectedInterests.join(", ") };
    localStorage.setItem("gv_users", JSON.stringify(users));
    sessionStorage.setItem("gv_current_user", JSON.stringify({ id, email }));
    sessionStorage.setItem("gv_petname", petname);

    const { error: sbError } = await supabase.from("profiles").insert({
      id: id,
      username: name,
      petname: petname,
      class: cls,
      interests: selectedInterests.join(", "),
      initial_interests: selectedInterests,
      detected_interests: selectedInterests
    });
    if (sbError) {
      console.error("Supabase insert error raw:", sbError);
      console.error("Supabase insert error stringified:", JSON.stringify(sbError, null, 2));
      setSignupError("Failed to save to database. Check console for error stringified.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/");
  }

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* VIDEO BACKGROUND */}
      <video autoPlay loop muted playsInline preload="auto"
        className="absolute top-0 left-0 w-full h-full object-cover z-0 scale-110">
        <source src="/clouds.mp4" type="video/mp4" />
      </video>

      {/* GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/30 via-purple-200/30 to-blue-200/30 z-0" />

      {/* SPLASH SCREEN */}
      {splash && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 animate-bounce-slow">
            <Image src="/logo.png" alt="GenieVerse" width={280} height={280}
              className="drop-shadow-lg" />
            <h1 className="text-5xl font-bold text-purple-900 tracking-widest">GenieVerse</h1>
            <p className="text-purple-700 text-center text-sm">
              Unlock your Universe of Knowledge,<br />
              <span className="italic text-purple-500">Where Learning is Magical</span>
            </p>
            <div className="w-48 h-1.5 bg-white/40 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-purple-500 rounded-full animate-loader" />
            </div>
          </div>
        </div>
      )}

      {/* LOGIN CARD */}
      <div className={`relative z-10 min-h-screen flex items-center justify-center p-6 transition-opacity duration-700 ${splash ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="backdrop-blur-lg bg-white/40 border border-purple-200 rounded-2xl shadow-lg p-8 w-full max-w-md">

          {/* Logo + Title */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <Image src="/logo.png" alt="GenieVerse" width={52} height={52}
              className="drop-shadow" />
            <h1 className="text-2xl font-bold text-purple-900">GenieVerse</h1>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/30 rounded-xl p-1 mb-6 gap-1">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "login" ? "bg-purple-500 text-white shadow" : "text-purple-700 hover:bg-white/40"}`}
              onClick={() => { setTab("login"); setLoginError(""); setSignupError(""); }}
            >Login</button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "signup" ? "bg-purple-500 text-white shadow" : "text-purple-700 hover:bg-white/40"}`}
              onClick={() => { setTab("signup"); setLoginError(""); setSignupError(""); }}
            >Sign Up</button>
          </div>

          {/* LOGIN FORM */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div className="flex items-center border border-purple-200 bg-white/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-purple-400">
                <span className="mr-2">👤</span>
                <input className="flex-1 bg-transparent outline-none py-3 text-sm text-purple-900 placeholder-purple-400"
                  placeholder="Email or Username" value={loginId} onChange={e => setLoginId(e.target.value)} required />
              </div>
              <div className="flex items-center border border-purple-200 bg-white/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-purple-400">
                <span className="mr-2">🔒</span>
                <input className="flex-1 bg-transparent outline-none py-3 text-sm text-purple-900 placeholder-purple-400"
                  type={showLoginPw ? "text" : "password"} placeholder="Password"
                  value={loginPw} onChange={e => setLoginPw(e.target.value)} required />
                <span className="cursor-pointer opacity-60 hover:opacity-100 text-sm"
                  onClick={() => setShowLoginPw(p => !p)}>👁</span>
              </div>
              {loginError && <p className="text-red-500 text-xs pl-1">{loginError}</p>}
              <button type="submit" disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl shadow transition-all hover:-translate-y-0.5 disabled:opacity-60 mt-1">
                {loading ? "⏳ Please wait..." : "✨ Enter the Verse"}
              </button>
              <p className="text-center text-xs text-purple-600">
                Don't have an account?{" "}
                <span className="underline cursor-pointer font-semibold" onClick={() => setTab("signup")}>Sign Up</span>
              </p>
            </form>
          )}

          {/* SIGNUP FORM */}
          {tab === "signup" && (
            <form onSubmit={handleSignup} className="flex flex-col gap-3">
              {[
                { placeholder: "Student Name (Username)", value: name, set: setName, type: "text" },
                { placeholder: "Email Address", value: email, set: setEmail, type: "email" },
                { placeholder: "Pet Name (your genie will call you this)", value: petname, set: setPetname, type: "text" },
              ].map(({ placeholder, value, set, type }) => (
                <div key={placeholder} className="flex items-center border border-purple-200 bg-white/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-purple-400">
                  <input className="flex-1 bg-transparent outline-none py-3 text-sm text-purple-900 placeholder-purple-400"
                    type={type} placeholder={placeholder} value={value}
                    onChange={e => set(e.target.value)} required />
                </div>
              ))}

              {/* Interest Selector */}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-purple-700 font-semibold pl-1">Your Interests (pick 1–4) <span className="font-normal opacity-70">— Jinn will teach using these!</span></p>
                {/* Suggested chips */}
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_INTERESTS.map(s => (
                    <button key={s} type="button"
                      onClick={() => addInterest(s)}
                      disabled={selectedInterests.length >= 4 || selectedInterests.map(i => i.toLowerCase()).includes(s.toLowerCase())}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${
                        selectedInterests.map(i => i.toLowerCase()).includes(s.toLowerCase())
                          ? "bg-purple-500 text-white border-purple-500"
                          : "bg-white/50 text-purple-700 border-purple-200 hover:bg-purple-100 disabled:opacity-40"
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
                {/* Custom input */}
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-purple-200 bg-white/50 rounded-xl px-3 py-2 text-sm text-purple-900 placeholder-purple-400 outline-none focus:ring-2 focus:ring-purple-400"
                    placeholder="Or type your own interest..."
                    value={interestInput}
                    onChange={e => setInterestInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInterest(interestInput); } }}
                    disabled={selectedInterests.length >= 4}
                  />
                  <button type="button" onClick={() => addInterest(interestInput)}
                    disabled={selectedInterests.length >= 4 || !interestInput.trim()}
                    className="bg-purple-500 text-white text-xs px-3 rounded-xl disabled:opacity-40 hover:bg-purple-600">
                    Add
                  </button>
                </div>
                {/* Selected tags */}
                {selectedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedInterests.map(i => (
                      <span key={i} className="flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full border border-purple-300">
                        {i}
                        <button type="button" onClick={() => removeInterest(i)} className="text-purple-500 hover:text-red-500 font-bold leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center border border-purple-200 bg-white/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-purple-400">
                <span className="mr-2">📚</span>
                <select className="flex-1 bg-transparent outline-none py-3 text-sm text-purple-900"
                  value={cls} onChange={e => setCls(e.target.value)} required>
                  <option value="" disabled>Select Your Class</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={`Class ${i + 1}`}>Class {i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center border border-purple-200 bg-white/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-purple-400">
                <span className="mr-2">🔒</span>
                <input className="flex-1 bg-transparent outline-none py-3 text-sm text-purple-900 placeholder-purple-400"
                  type={showSignupPw ? "text" : "password"} placeholder="Password (min 6 chars)"
                  value={signupPw} onChange={e => setSignupPw(e.target.value)} required />
                <span className="cursor-pointer opacity-60 hover:opacity-100 text-sm"
                  onClick={() => setShowSignupPw(p => !p)}>👁</span>
              </div>
              <div className="flex items-center border border-purple-200 bg-white/50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-purple-400">
                <span className="mr-2">🔒</span>
                <input className="flex-1 bg-transparent outline-none py-3 text-sm text-purple-900 placeholder-purple-400"
                  type="password" placeholder="Confirm Password"
                  value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
              </div>
              {signupError && <p className="text-red-500 text-xs pl-1">{signupError}</p>}
              <button type="submit" disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl shadow transition-all hover:-translate-y-0.5 disabled:opacity-60 mt-1">
                {loading ? "⏳ Please wait..." : "🌟 Begin My Journey"}
              </button>
              <p className="text-center text-xs text-purple-600">
                Already have an account?{" "}
                <span className="underline cursor-pointer font-semibold" onClick={() => setTab("login")}>Login</span>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
