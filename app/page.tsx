"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// ── Daily topics ──
const TOPICS = [
  "Describe your favorite place in the world and why it matters to you.",
  "You are late to a job interview. Explain to the interviewer what happened.",
  "Your friend wants to quit his studies. Convince him to continue.",
  "Compare life in a city vs a village in Pakistan.",
  "Describe your dream job and why you are the right person for it.",
  "Should boys and girls study in the same school? Give your opinion.",
  "Talk about the most embarrassing moment of your life.",
  "What is one skill you wish you had learned earlier in life?",
  "Talk about a person who has greatly influenced your life.",
  "What are the advantages and disadvantages of social media?",
  "Describe your perfect day from morning to night.",
  "What does success mean to you personally?",
  "Talk about a challenge you overcame and what you learned.",
  "What technology has changed your life the most?",
  "Describe your hometown and what makes it special.",
  "You have to give a speech in front of 500 people tomorrow. How do you prepare?",
  "Talk about your favorite Pakistani food and how it is made.",
  "What would you change about the education system in Pakistan?",
  "Describe a time when you helped a stranger.",
  "What are your goals for the next five years?",
  "If you could have dinner with any person in history, who would it be and why?",
  "Talk about the importance of learning English in Pakistan today.",
  "Describe the best trip you have ever taken.",
  "What is the most important quality in a good leader?",
  "Talk about an invention that changed the world.",
  "If you had one million rupees, what would you do with it?",
  "Describe your morning routine and why it works for you.",
  "What advice would you give your younger self?",
  "Talk about the role of family in Pakistani culture.",
  "What does a perfect education system look like to you?",
];

function getDailyTopic(): string {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - start) / 86400000);
  return TOPICS[dayOfYear % TOPICS.length];
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Safe JSON parse with fallback ──
function safeParseResult(data: any) {
  try {
    return {
      scores: {
        fluency: Number(data?.scores?.fluency) || 0,
        grammar: Number(data?.scores?.grammar) || 0,
        vocabulary: Number(data?.scores?.vocabulary) || 0,
        total: Number(data?.scores?.total) || 0,
      },
      improvements: Array.isArray(data?.improvements) ? data.improvements.filter((i: any) => i?.original && i?.improved) : [],
      correctedSpeech: data?.correctedSpeech || "Could not generate corrected speech.",
      summary: data?.summary || "Great effort! Keep practicing every day.",
    };
  } catch {
    return {
      scores: { fluency: 0, grammar: 0, vocabulary: 0, total: 0 },
      improvements: [],
      correctedSpeech: "Could not generate corrected speech.",
      summary: "Great effort! Keep practicing every day.",
    };
  }
}

export default function Home() {
  // ── Chat state ──
  const [activeSession, setActiveSession] = useState<Id<"sessions"> | null>(null);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);

  // ── Translate state ──
  const [urduInput, setUrduInput] = useState("");
  const [isListeningUrdu, setIsListeningUrdu] = useState(false);

  // ── Speech state ──
  const [speechPhase, setSpeechPhase] = useState<"ready"|"speaking"|"processing"|"results"|"history">("ready");
  const [speechTranscript, setSpeechTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechTimer, setSpeechTimer] = useState(0);
  const [speechResult, setSpeechResult] = useState<any>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const speechTimerRef = useRef<any>(null);
  const speechRecogRef = useRef<any>(null);
  const speechTranscriptRef = useRef("");
  const speechTimerValRef = useRef(0);
  const speechPhaseRef = useRef<string>("ready");
  const isSavingRef = useRef(false);

  // ── Shared state ──
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat"|"translate"|"speech">("chat");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [editingId, setEditingId] = useState<Id<"sessions"> | null>(null);
  const [editingName, setEditingName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Convex ──
  const sessions = useQuery(api.sessions.getAllSessions) ?? [];
  const messages = useQuery(api.messages.getMessages, activeSession ? { sessionId: activeSession } : "skip") ?? [];
  const translations = useQuery(api.translations.getAllTranslations) ?? [];
  const speechSessions = useQuery(api.speechSessions.getAllSpeechSessions) ?? [];
  const streak = useQuery(api.speechSessions.getStreak) ?? 0;
  const bestScore = useQuery(api.speechSessions.getBestScore) ?? 0;

  const createSession = useMutation(api.sessions.createSession);
  const renameSession = useMutation(api.sessions.renameSession);
  const deleteSession = useMutation(api.sessions.deleteSession);
  const saveMessage = useMutation(api.messages.saveMessage);
  const saveTranslation = useMutation(api.translations.saveTranslation);
  const saveSpeechSession = useMutation(api.speechSessions.saveSpeechSession);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep refs in sync
  useEffect(() => { speechPhaseRef.current = speechPhase; }, [speechPhase]);
  useEffect(() => { speechTimerValRef.current = speechTimer; }, [speechTimer]);

  // ── Auto-save when tab changes during speech ──
  useEffect(() => {
    if (activeTab !== "speech" && speechPhaseRef.current === "speaking") {
      handleStopAndSave(true);
    }
  }, [activeTab]);

  // ── Warn before page close during speech ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (speechPhaseRef.current === "speaking") {
        e.preventDefault();
        e.returnValue = "You are currently recording a speech. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── TTS ──
  const speak = (text: string) => {
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[✏️✅💬🎯]/g, "");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "en-US"; utterance.rate = 0.95; utterance.pitch = 1.1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes("Jenny") || v.name.includes("Samantha") || v.name.includes("Google US English") || (v.lang === "en-US" && v.name.includes("Female")));
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch { setIsSpeaking(false); }
  };

  // ── Chat mic ──
  const startListening = (forUrdu = false) => {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { alert("Voice input requires Chrome browser."); return; }
      const r = new SR();
      r.lang = forUrdu ? "ur-PK" : "en-US";
      r.continuous = false; r.interimResults = false;
      r.onresult = (e: any) => { const t = e.results[0][0].transcript; if (forUrdu) setUrduInput(t); else setInputText(t); };
      r.onend = () => { setIsListening(false); setIsListeningUrdu(false); };
      r.onerror = (e: any) => {
        setIsListening(false); setIsListeningUrdu(false);
        if (e.error === "not-allowed") alert("Microphone permission denied. Please allow mic access in browser settings.");
      };
      recognitionRef.current = r; r.start();
      if (forUrdu) setIsListeningUrdu(true); else setIsListening(true);
    } catch (e) {
      setIsListening(false); setIsListeningUrdu(false);
      console.error("Mic error:", e);
    }
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setIsListening(false); setIsListeningUrdu(false);
  };

  // ── Speech Practice: Start ──
  const startSpeechPractice = () => {
    setMicError(null); setSpeechError(null); setSaveError(null);

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError("Voice input is not supported in this browser. Please use Google Chrome.");
      return;
    }

    // Check mic permission
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => beginSpeechPractice())
        .catch((err) => {
          if (err.name === "NotAllowedError") {
            setMicError("Microphone permission denied. Click the 🔒 icon in your browser's address bar and allow microphone access.");
          } else {
            setMicError("Could not access microphone. Please check your device settings.");
          }
        });
    } else {
      beginSpeechPractice();
    }
  };

  const beginSpeechPractice = () => {
    setSpeechTranscript("");
    setInterimTranscript("");
    setSpeechTimer(0);
    speechTranscriptRef.current = "";
    speechTimerValRef.current = 0;
    isSavingRef.current = false;
    setSpeechPhase("speaking");

    // Timer
    speechTimerRef.current = setInterval(() => {
      setSpeechTimer(prev => { speechTimerValRef.current = prev + 1; return prev + 1; });
    }, 1000);

    // Recognition
    startContinuousRecognition();
  };

  const startContinuousRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const r = new SR();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      if (final) {
        speechTranscriptRef.current += final;
        setSpeechTranscript(speechTranscriptRef.current);
      }
      setInterimTranscript(interim);
    };

    r.onerror = (e: any) => {
      // Ignore no-speech errors — just restart
      if (e.error === "no-speech" || e.error === "audio-capture") {
        if (speechPhaseRef.current === "speaking") {
          try { setTimeout(() => startContinuousRecognition(), 300); } catch {}
        }
      }
    };

    r.onend = () => {
      // Auto-restart if still speaking
      if (speechPhaseRef.current === "speaking" && !isSavingRef.current) {
        try { setTimeout(() => startContinuousRecognition(), 200); } catch {}
      }
    };

    try { r.start(); speechRecogRef.current = r; } catch {}
  };

  // ── Speech Practice: Stop & Save ──
  const handleStopAndSave = useCallback(async (autoSave = false) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    // Stop timer
    clearInterval(speechTimerRef.current);
    const duration = speechTimerValRef.current;

    // Stop recognition
    try { speechRecogRef.current?.stop(); } catch {}
    setInterimTranscript("");

    const finalTranscript = speechTranscriptRef.current.trim();

    // Too short check (10 seconds minimum)
    if (!finalTranscript || finalTranscript.length < 15 || duration < 10) {
      setSpeechPhase("ready");
      isSavingRef.current = false;
      if (!autoSave) setSpeechError("Speech too short. Please speak for at least 10 seconds.");
      return;
    }

    setSpeechPhase("processing");
    setSpeechError(null);

    try {
      // Check network
      if (!navigator.onLine) {
        throw new Error("You are offline. Please check your internet connection and try again.");
      }

      const res = await fetch("/api/speech-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: finalTranscript,
          topic: getDailyTopic(),
          durationSeconds: duration,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Server error (${res.status}). Please try again.`);
      }

      const rawData = await res.json();
      const data = safeParseResult(rawData);

      // Try to save — don't crash if Convex fails
      try {
        await saveSpeechSession({
          topic: getDailyTopic(),
          transcript: finalTranscript,
          correctedSpeech: data.correctedSpeech,
          improvements: data.improvements,
          scores: data.scores,
          durationSeconds: duration,
          date: getTodayDate(),
          timestamp: Date.now(),
        });
        setSaveError(null);
      } catch (dbErr) {
        console.error("DB save failed:", dbErr);
        setSaveError("Results shown below but could not save to history. Check your connection.");
      }

      setSpeechResult(data);
      setSpeechTimer(duration);
      setSpeechPhase("results");

    } catch (err: any) {
      console.error("Speech coach error:", err);
      setSpeechPhase("ready");
      setSpeechError(err?.message || "Something went wrong. Please try again.");
      isSavingRef.current = false;
    }
  }, [saveSpeechSession]);

  // ── Chat ──
  const handleNewSession = async () => {
    try {
      const id = await createSession({ sessionName: `Session ${sessions.length + 1}` });
      setActiveSession(id); setActiveTab("chat");
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e) { console.error("Create session failed:", e); }
  };

  const handleSendMessage = async (text?: string) => {
    const msgText = text || inputText;
    if (!msgText.trim() || !activeSession) return;
    setIsLoading(true); setInputText("");
    try {
      await saveMessage({ sessionId: activeSession, role: "user", originalText: msgText, language: "english", timestamp: Date.now() });
      if (messages.length === 0) {
        await renameSession({ sessionId: activeSession, sessionName: msgText.slice(0, 28) + (msgText.length > 28 ? "…" : "") });
      }
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msgText, history: messages }),
      });
      if (!res.ok) throw new Error("Coach API failed");
      const data = await res.json();
      await saveMessage({ sessionId: activeSession, role: "assistant", originalText: data.reply || "Sorry, I could not respond. Please try again.", ...(data.correction ? { correctedText: data.correction } : {}), language: "english", timestamp: Date.now() });
      if (data.reply) speak(data.reply);
    } catch (e) {
      console.error("Send message error:", e);
      try {
        await saveMessage({ sessionId: activeSession, role: "assistant", originalText: "⚠️ Could not get a response. Please check your connection and try again.", language: "english", timestamp: Date.now() });
      } catch {}
    }
    setIsLoading(false);
  };

  // ── Translate ──
  const handleTranslate = async () => {
    if (!urduInput.trim()) return;
    setIsLoading(true);
    try {
      if (!navigator.onLine) throw new Error("You are offline.");
      const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: urduInput }) });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      await saveTranslation({ inputText: urduInput, translatedText: data.translation, timestamp: Date.now() });
      setUrduInput(""); speak(data.translation);
    } catch (e: any) {
      alert(e?.message || "Translation failed. Please try again.");
    }
    setIsLoading(false);
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const userMsgCount = messages.filter(m => m.role === "user").length;
  const currentSessionName = sessions.find(s => s._id === activeSession)?.sessionName;
  const todayPracticed = speechSessions.some(s => s.date === getTodayDate());
  const dailyTopic = getDailyTopic();
  const scoreColor = (score: number, max = 10) => score / max >= 0.8 ? "#16a34a" : score / max >= 0.6 ? "#d97706" : "#dc2626";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #0f172a; -webkit-font-smoothing: antialiased; }
        .app { display: flex; height: 100vh; overflow: hidden; }

        .sidebar { width: 260px; min-width: 260px; background: #0f172a; border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; transition: width 0.22s ease, min-width 0.22s ease, opacity 0.2s; overflow: hidden; }
        .sidebar.closed { width: 0; min-width: 0; opacity: 0; pointer-events: none; }
        .sb-top { padding: 20px 16px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .logo { display: flex; align-items: center; gap: 11px; margin-bottom: 16px; }
        .logo-icon { width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(99,102,241,0.4); flex-shrink: 0; }
        .logo-name { font-size: 14px; font-weight: 700; color: #f1f5f9; letter-spacing: -0.3px; }
        .logo-sub { font-size: 11px; color: #475569; margin-top: 1px; }
        .btn-new { width: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; box-shadow: 0 4px 14px rgba(99,102,241,0.35); transition: opacity 0.15s, transform 0.1s; }
        .btn-new:hover { opacity: 0.9; } .btn-new:active { transform: scale(0.97); }
        .streak-banner { margin: 12px 10px 0; background: linear-gradient(135deg, rgba(251,146,60,0.15), rgba(239,68,68,0.1)); border: 1px solid rgba(251,146,60,0.25); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; }
        .streak-fire { font-size: 22px; }
        .streak-num { font-size: 18px; font-weight: 700; color: #fb923c; letter-spacing: -0.5px; }
        .streak-label { font-size: 10px; color: #92400e; font-weight: 500; margin-top: 1px; }
        .sb-label { font-size: 10px; font-weight: 600; color: #334155; letter-spacing: 0.9px; text-transform: uppercase; padding: 14px 16px 5px; }
        .sb-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
        .sb-list::-webkit-scrollbar { width: 3px; }
        .sb-list::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        .si { border-radius: 8px; margin-bottom: 1px; }
        .si.active { background: rgba(99,102,241,0.15); }
        .si:hover:not(.active) { background: rgba(255,255,255,0.04); }
        .si-row { display: flex; align-items: center; padding: 2px 4px 2px 10px; }
        .si-btn { flex: 1; background: none; border: none; padding: 7px 4px; font-size: 12.5px; font-family: inherit; color: #64748b; cursor: pointer; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
        .si.active .si-btn { color: #a5b4fc; font-weight: 600; }
        .si-act { background: none; border: none; cursor: pointer; padding: 5px; border-radius: 6px; font-size: 12px; color: #334155; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
        .si:hover .si-act { opacity: 1; }
        .si-act:hover { background: rgba(239,68,68,0.1); color: #f87171; }
        .si-edit { display: flex; gap: 4px; padding: 4px 8px; }
        .si-edit input { flex: 1; padding: 5px 9px; font-size: 12px; font-family: inherit; border: 1px solid #6366f1; border-radius: 6px; outline: none; color: #f1f5f9; background: #1e293b; min-width: 0; }
        .si-save { background: #6366f1; color: #fff; border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; cursor: pointer; }
        .sb-empty { font-size: 12px; color: #334155; text-align: center; padding: 20px 12px; line-height: 1.8; }
        .sb-stats { margin: 8px 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 11px 12px; display: flex; }
        .stat { flex: 1; text-align: center; }
        .stat + .stat { border-left: 1px solid rgba(255,255,255,0.06); }
        .stat-n { font-size: 18px; font-weight: 700; color: #e2e8f0; letter-spacing: -0.5px; }
        .stat-l { font-size: 10px; color: #475569; margin-top: 2px; font-weight: 500; }

        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc; }
        .topbar { background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; padding: 0 20px; height: 56px; gap: 12px; flex-shrink: 0; }
        .topbar-toggle { background: none; border: none; cursor: pointer; padding: 7px; border-radius: 8px; color: #64748b; display: flex; transition: background 0.1s; }
        .topbar-toggle:hover { background: #f1f5f9; }
        .tabs { display: flex; gap: 2px; background: #f1f5f9; border-radius: 10px; padding: 3px; }
        .tab { background: none; border: none; padding: 6px 14px; font-size: 13px; font-family: inherit; font-weight: 500; color: #64748b; cursor: pointer; border-radius: 8px; transition: all 0.15s; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
        .tab.on { background: #fff; color: #1e293b; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .tab-badge { background: #6366f1; color: #fff; font-size: 9px; font-weight: 700; border-radius: 4px; padding: 1px 5px; }
        .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
        .session-chip { font-size: 12.5px; font-weight: 500; color: #64748b; background: #f1f5f9; border-radius: 20px; padding: 5px 12px; border: 1px solid #e2e8f0; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .speaking-chip { display: flex; align-items: center; gap: 7px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; padding: 5px 12px; font-size: 12px; font-weight: 600; color: #1d4ed8; }
        .spk-dot { width: 7px; height: 7px; border-radius: 50%; background: #3b82f6; animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }

        /* Error banner */
        .err-banner { display: flex; align-items: flex-start; gap: 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 12px 16px; font-size: 13px; color: #9f1239; line-height: 1.5; }
        .err-banner svg { flex-shrink: 0; margin-top: 1px; }
        .warn-banner { display: flex; align-items: flex-start; gap: 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 16px; font-size: 13px; color: #78350f; line-height: 1.5; }

        /* Chat */
        .chat-scroll { flex: 1; overflow-y: auto; background: #f8fafc; display: flex; flex-direction: column; }
        .chat-scroll::-webkit-scrollbar { width: 5px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; gap: 20px; }
        .welcome-ring { width: 80px; height: 80px; border-radius: 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%); display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 12px 32px rgba(99,102,241,0.3); }
        .welcome h2 { font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; }
        .welcome p { font-size: 15px; color: #64748b; line-height: 1.7; max-width: 360px; }
        .wpills { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .wpill { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 6px 14px; font-size: 12.5px; color: #475569; font-weight: 500; }
        .wcta { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none; border-radius: 12px; padding: 13px 28px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; box-shadow: 0 6px 20px rgba(99,102,241,0.35); transition: transform 0.15s; display: flex; align-items: center; gap: 8px; }
        .wcta:hover { transform: translateY(-1px); }
        .msgs { padding: 28px 28px 8px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .mg { margin-bottom: 14px; }
        .mr { display: flex; gap: 10px; align-items: flex-end; }
        .mr.u { flex-direction: row-reverse; }
        .av { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-bottom: 2px; }
        .av.ai { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
        .av.us { background: #0f172a; color: #fff; }
        .bw { max-width: 65%; display: flex; flex-direction: column; gap: 5px; }
        .mr.u .bw { align-items: flex-end; }
        .bub { padding: 11px 15px; font-size: 14px; line-height: 1.65; word-break: break-word; border-radius: 16px; }
        .bub.ai { background: #fff; color: #1e293b; border: 1px solid #e2e8f0; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .bub.us { background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff; border-bottom-right-radius: 4px; box-shadow: 0 2px 8px rgba(99,102,241,0.3); }
        .corr { display: flex; align-items: flex-start; gap: 8px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 9px 13px; font-size: 12.5px; color: #92400e; line-height: 1.6; }
        .corr-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; background: #fde68a; color: #92400e; border-radius: 4px; padding: 2px 6px; flex-shrink: 0; margin-top: 1px; }
        .mt { font-size: 10.5px; color: #94a3b8; padding: 0 4px; }
        .tr-row2 { display: flex; gap: 10px; align-items: flex-end; padding: 0 28px 16px; }
        .tbub { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; border-bottom-left-radius: 4px; padding: 13px 16px; display: flex; gap: 4px; align-items: center; }
        .td { width: 6px; height: 6px; background: #cbd5e1; border-radius: 50%; animation: bounce 1.2s ease-in-out infinite; }
        .td:nth-child(2) { animation-delay: 0.16s; } .td:nth-child(3) { animation-delay: 0.32s; }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        .input-wrap { background: #fff; border-top: 1px solid #e2e8f0; padding: 16px 24px; flex-shrink: 0; }
        .ibar { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 50px; padding: 6px 8px 6px 18px; transition: border-color 0.15s; }
        .ibar:focus-within { border-color: #a5b4fc; background: #fff; }
        .ibar input { flex: 1; background: none; border: none; outline: none; font-size: 14px; font-family: inherit; color: #1e293b; padding: 5px 0; }
        .ibar input::placeholder { color: #94a3b8; }
        .ibar input:disabled { opacity: 0.5; }
        .mic { width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
        .mic.off { background: #f1f5f9; color: #64748b; }
        .mic.off:hover { background: #ede9fe; color: #7c3aed; }
        .mic.on { background: #fee2e2; color: #dc2626; animation: micglow 1.4s ease-in-out infinite; }
        .mic:disabled { opacity: 0.35; cursor: not-allowed; }
        @keyframes micglow { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.2)} 50%{box-shadow:0 0 0 8px rgba(220,38,38,0)} }
        .send { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(99,102,241,0.35); transition: transform 0.1s, opacity 0.15s; }
        .send:hover { transform: scale(1.05); } .send:active { transform: scale(0.92); }
        .send:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; transform: none; }
        .listening-bar { display: flex; align-items: center; gap: 8px; background: #fff1f2; border-top: 1px solid #fecdd3; padding: 9px 24px; font-size: 12.5px; color: #e11d48; font-weight: 500; }
        .l-dot { width: 7px; height: 7px; border-radius: 50%; background: #e11d48; animation: pulse 1s infinite; }

        /* Translate */
        .tarea { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; background: #f8fafc; }
        .card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px 22px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .card-hd { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 14px; display: flex; align-items: center; gap: 7px; }
        .card-hd-bar { width: 18px; height: 3px; border-radius: 2px; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .trow { display: flex; gap: 8px; align-items: center; }
        .tinput { flex: 1; padding: 11px 15px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; background: #f8fafc; color: #1e293b; transition: border-color 0.15s; }
        .tinput:focus { border-color: #a5b4fc; background: #fff; }
        .tinput::placeholder { color: #94a3b8; }
        .tbtn { background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff; border: none; border-radius: 10px; padding: 11px 20px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 7px; box-shadow: 0 3px 10px rgba(99,102,241,0.3); transition: opacity 0.15s; }
        .tbtn:hover { opacity: 0.9; } .tbtn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
        .hint { font-size: 11.5px; color: #94a3b8; margin-top: 10px; display: flex; align-items: center; gap: 5px; }
        .sec-hd { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 7px; }
        .hi { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 15px 18px; transition: border-color 0.15s; margin-bottom: 8px; }
        .hi:hover { border-color: #c7d2fe; }
        .hi-top { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
        .badge-ur { font-size: 9px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; color: #64748b; border-radius: 5px; padding: 2px 7px; }
        .hi-orig { font-size: 13px; color: #475569; }
        .sep { height: 1px; background: #f1f5f9; margin: 9px 0; }
        .hi-bot { display: flex; align-items: flex-start; gap: 8px; }
        .badge-en { font-size: 9px; font-weight: 700; text-transform: uppercase; background: #ede9fe; color: #6d28d9; border-radius: 5px; padding: 2px 7px; margin-top: 2px; }
        .hi-en { font-size: 15px; font-weight: 600; color: #4f46e5; }
        .empty { text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 13px; line-height: 1.8; }
        .empty-i { font-size: 36px; margin-bottom: 10px; opacity: 0.3; }

        /* Speech tab */
        .sp-area { flex: 1; overflow-y: auto; background: #f8fafc; display: flex; flex-direction: column; }
        .sp-area::-webkit-scrollbar { width: 5px; }
        .sp-area::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        .sp-ready { display: flex; flex-direction: column; align-items: center; padding: 28px 24px; gap: 16px; max-width: 680px; margin: 0 auto; width: 100%; }
        .sp-today-badge { display: flex; align-items: center; gap: 8px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #15803d; }
        .sp-today-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
        .topic-card { background: #fff; border-radius: 18px; border: 1px solid #e2e8f0; padding: 24px; width: 100%; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .topic-label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 7px; }
        .topic-label-bar { width: 18px; height: 3px; border-radius: 2px; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .topic-text { font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.4; letter-spacing: -0.3px; }
        .topic-sub { font-size: 13px; color: #64748b; margin-top: 8px; line-height: 1.6; }
        .sp-stats-row { display: flex; gap: 10px; width: 100%; }
        .sp-stat-card { flex: 1; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 14px 16px; text-align: center; }
        .sp-stat-n { font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; }
        .sp-stat-l { font-size: 11px; color: #94a3b8; margin-top: 2px; font-weight: 500; }
        .sp-start-btn { width: 100%; background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 6px 20px rgba(99,102,241,0.35); transition: transform 0.15s; }
        .sp-start-btn:hover { transform: translateY(-2px); }
        .sp-history-btn { width: 100%; background: none; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 13px; font-size: 14px; font-weight: 600; font-family: inherit; color: #475569; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .sp-history-btn:hover { border-color: #a5b4fc; color: #6366f1; background: #f5f3ff; }

        /* Speaking */
        .sp-speaking { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 32px 24px; gap: 22px; }
        .sp-mic-ring { width: 110px; height: 110px; border-radius: 50%; background: linear-gradient(135deg, #ef4444, #dc2626); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 0 rgba(239,68,68,0.4); animation: micpulse 1.5s ease-in-out infinite; cursor: pointer; border: none; transition: transform 0.1s; }
        .sp-mic-ring:hover { transform: scale(1.05); }
        @keyframes micpulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.35)} 50%{box-shadow:0 0 0 20px rgba(239,68,68,0)} }
        .sp-timer { font-size: 48px; font-weight: 700; color: #0f172a; letter-spacing: -2px; font-variant-numeric: tabular-nums; }
        .sp-timer-label { font-size: 13px; color: #94a3b8; font-weight: 500; text-align: center; }
        .sp-live-transcript { width: 100%; max-width: 620px; background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 16px 20px; min-height: 90px; max-height: 180px; overflow-y: auto; font-size: 14px; line-height: 1.7; color: #374151; }
        .sp-interim { color: #94a3b8; font-style: italic; }
        .sp-stop-btn { background: #fff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px 28px; font-size: 14px; font-weight: 600; font-family: inherit; color: #374151; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 8px; }
        .sp-stop-btn:hover { border-color: #fca5a5; color: #dc2626; background: #fff1f2; }

        /* Processing */
        .sp-processing { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 16px; }
        .sp-spinner { width: 52px; height: 52px; border: 3px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .sp-processing-text { font-size: 16px; font-weight: 600; color: #374151; }
        .sp-processing-sub { font-size: 13px; color: #94a3b8; }

        /* Results */
        .sp-results { padding: 24px; display: flex; flex-direction: column; gap: 16px; max-width: 760px; margin: 0 auto; width: 100%; }
        .score-card { background: #fff; border-radius: 18px; border: 1px solid #e2e8f0; padding: 22px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .score-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .score-total-n { font-size: 40px; font-weight: 800; letter-spacing: -1.5px; }
        .score-total-label { font-size: 11px; color: #94a3b8; font-weight: 500; }
        .score-bars { display: flex; flex-direction: column; gap: 10px; }
        .score-bar-row { display: flex; align-items: center; gap: 12px; }
        .score-bar-label { font-size: 12px; font-weight: 600; color: #374151; width: 80px; }
        .score-bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
        .score-bar-fill { height: 100%; border-radius: 4px; transition: width 0.8s ease; }
        .score-bar-num { font-size: 13px; font-weight: 700; width: 28px; text-align: right; }
        .summary-card { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1px solid #c4b5fd; border-radius: 14px; padding: 16px 18px; font-size: 14px; color: #4c1d95; line-height: 1.7; }
        .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #7c3aed; margin-bottom: 6px; }
        .improvements-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px 22px; }
        .imp-hd { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
        .imp-count { font-size: 11px; font-weight: 600; background: #fef3c7; color: #92400e; border-radius: 6px; padding: 2px 8px; }
        .imp-none { font-size: 13px; color: #16a34a; background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 12px 16px; text-align: center; font-weight: 500; }
        .imp-item { border: 1px solid #fde68a; border-radius: 10px; background: #fffbeb; padding: 12px 14px; margin-bottom: 8px; }
        .imp-item:last-child { margin-bottom: 0; }
        .imp-original { font-size: 13px; color: #92400e; margin-bottom: 6px; line-height: 1.5; }
        .imp-arrow { font-size: 11px; color: #a16207; margin-bottom: 4px; }
        .imp-improved { font-size: 13px; color: #15803d; font-weight: 600; line-height: 1.5; margin-bottom: 4px; }
        .imp-reason { font-size: 11px; color: #6b7280; font-style: italic; }
        .corrected-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px 22px; }
        .corrected-hd { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .corrected-text { font-size: 14px; color: #374151; line-height: 1.8; white-space: pre-wrap; }
        .sp-again-btn { width: 100%; background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff; border: none; border-radius: 14px; padding: 14px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: transform 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .sp-again-btn:hover { transform: translateY(-1px); }

        /* History */
        .sp-history { padding: 24px; display: flex; flex-direction: column; gap: 10px; }
        .sp-hist-back { background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: #6366f1; font-family: inherit; display: flex; align-items: center; gap: 6px; padding: 0; margin-bottom: 4px; }
        .sp-hist-back:hover { color: #4f46e5; }
        .sp-hist-item { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 14px 16px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; display: flex; align-items: center; gap: 12px; }
        .sp-hist-item:hover { border-color: #a5b4fc; box-shadow: 0 2px 8px rgba(99,102,241,0.1); }
        .sp-hist-score { width: 50px; height: 50px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
        .sp-hist-score-n { font-size: 18px; font-weight: 800; }
        .sp-hist-score-l { font-size: 8px; font-weight: 600; opacity: 0.7; }
        .sp-hist-info { flex: 1; min-width: 0; }
        .sp-hist-topic { font-size: 13px; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; }
        .sp-hist-meta { font-size: 11.5px; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
        .sp-hist-dot { width: 3px; height: 3px; border-radius: 50%; background: #cbd5e1; }
        .sp-detail { padding: 24px; display: flex; flex-direction: column; gap: 16px; max-width: 760px; margin: 0 auto; width: 100%; }
      `}</style>

      <div className="app">
        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
          <div className="sb-top">
            <div className="logo">
              <div className="logo-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
              </div>
              <div><div className="logo-name">English Coach</div><div className="logo-sub">AI-powered practice</div></div>
            </div>
            <button className="btn-new" onClick={handleNewSession}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 4v16M4 12h16"/></svg>
              New Session
            </button>
          </div>

          {streak > 0 && (
            <div className="streak-banner">
              <div className="streak-fire">🔥</div>
              <div><div className="streak-num">{streak} day{streak !== 1 ? "s" : ""}</div><div className="streak-label">Speaking streak</div></div>
            </div>
          )}

          <div className="sb-label">History</div>
          <div className="sb-list">
            {sessions.length === 0 ? (
              <div className="sb-empty">No sessions yet.<br />Click New Session to start.</div>
            ) : sessions.map(s => (
              <div key={s._id} className={`si ${activeSession === s._id ? "active" : ""}`}>
                {editingId === s._id ? (
                  <div className="si-edit">
                    <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === "Enter" && editingName.trim()) { await renameSession({ sessionId: s._id, sessionName: editingName.trim() }); setEditingId(null); }
                        if (e.key === "Escape") setEditingId(null);
                      }} />
                    <button className="si-save" onClick={async () => { if (editingName.trim()) await renameSession({ sessionId: s._id, sessionName: editingName.trim() }); setEditingId(null); }}>✓</button>
                  </div>
                ) : (
                  <div className="si-row">
                    <button className="si-btn" onClick={() => setActiveSession(s._id)}>{s.sessionName}</button>
                    <button className="si-act" onClick={() => { setEditingId(s._id); setEditingName(s.sessionName); }}>✏️</button>
                    <button className="si-act" onClick={async () => { if (confirm(`Delete "${s.sessionName}"?`)) { await deleteSession({ sessionId: s._id }); if (activeSession === s._id) setActiveSession(null); } }}>🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="sb-stats">
            <div className="stat"><div className="stat-n">{sessions.length}</div><div className="stat-l">Sessions</div></div>
            <div className="stat"><div className="stat-n">{speechSessions.length}</div><div className="stat-l">Speeches</div></div>
            <div className="stat"><div className="stat-n">{bestScore}</div><div className="stat-l">Best /30</div></div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <button className="topbar-toggle" onClick={() => setSidebarOpen(v => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
            <div className="tabs">
              <button className={`tab ${activeTab === "chat" ? "on" : ""}`} onClick={() => setActiveTab("chat")}>💬 Coach Chat</button>
              <button className={`tab ${activeTab === "translate" ? "on" : ""}`} onClick={() => setActiveTab("translate")}>🌐 Urdu → English</button>
              <button className={`tab ${activeTab === "speech" ? "on" : ""}`} onClick={() => setActiveTab("speech")}>
                🎤 Daily Speech {!todayPracticed && <span className="tab-badge">NEW</span>}
              </button>
            </div>
            <div className="topbar-right">
              {activeTab === "chat" && activeSession && !isSpeaking && currentSessionName && <div className="session-chip">{currentSessionName}</div>}
              {isSpeaking && <div className="speaking-chip"><span className="spk-dot" />Alex is speaking</div>}
            </div>
          </div>

          {/* ── CHAT TAB ── */}
          {activeTab === "chat" && (
            <>
              <div className="chat-scroll">
                {!activeSession ? (
                  <div className="welcome">
                    <div className="welcome-ring">🎙️</div>
                    <h2>Your AI English Coach</h2>
                    <p>Practice speaking English naturally. Get instant corrections, voice feedback, and smart follow-up questions from Alex.</p>
                    <div className="wpills">
                      <span className="wpill">✅ Grammar corrections</span>
                      <span className="wpill">🔊 Voice input & output</span>
                      <span className="wpill">💬 Follow-up questions</span>
                      <span className="wpill">📁 Session history</span>
                    </div>
                    <button className="wcta" onClick={handleNewSession}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 4v16M4 12h16"/></svg>
                      Start your first session
                    </button>
                  </div>
                ) : (
                  <div className="msgs">
                    {messages.map(msg => (
                      <div key={msg._id} className="mg">
                        <div className={`mr ${msg.role === "user" ? "u" : ""}`}>
                          <div className={`av ${msg.role === "user" ? "us" : "ai"}`}>
                            {msg.role === "user" ? "U" : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>}
                          </div>
                          <div className="bw">
                            <div className={`bub ${msg.role === "user" ? "us" : "ai"}`}>{msg.originalText}</div>
                            {msg.correctedText && <div className="corr"><span className="corr-tag">Fix</span><span>{msg.correctedText}</span></div>}
                            {msg.timestamp && <div className="mt">{formatTime(msg.timestamp)}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="tr-row2">
                        <div className="av ai"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
                        <div className="tbub"><div className="td"/><div className="td"/><div className="td"/></div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              <div className="input-wrap">
                <div className="ibar">
                  <button className={`mic ${isListening ? "on" : "off"}`} onClick={() => isListening ? stopListening() : startListening(false)} disabled={!activeSession}>
                    {isListening ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>}
                  </button>
                  <input ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()} placeholder={activeSession ? "Type or speak in English…" : "Create a session first"} disabled={!activeSession || isLoading} />
                  <button className="send" onClick={() => handleSendMessage()} disabled={!activeSession || isLoading || !inputText.trim()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                  </button>
                </div>
              </div>
              {isListening && <div className="listening-bar"><span className="l-dot" />Listening… speak clearly, then click ■ to stop</div>}
            </>
          )}

          {/* ── TRANSLATE TAB ── */}
          {activeTab === "translate" && (
            <div className="tarea">
              <div className="card">
                <div className="card-hd"><span className="card-hd-bar" />Roman Urdu or Urdu → English</div>
                <div className="trow">
                  <input className="tinput" value={urduInput} onChange={e => setUrduInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleTranslate()} placeholder='"khubsoorat", "mujhe pani chahiye"…' />
                  <button className={`mic ${isListeningUrdu ? "on" : "off"}`} style={{ width: 42, height: 42, border: "none" }} onClick={() => isListeningUrdu ? stopListening() : startListening(true)}>
                    {isListeningUrdu ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>}
                  </button>
                  <button className="tbtn" onClick={handleTranslate} disabled={isLoading || !urduInput.trim()}>
                    {isLoading ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:"spin 0.8s linear infinite"}}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9"/></svg> : <>Translate <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
                  </button>
                </div>
                <div className="hint"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Type Roman Urdu or click the mic to speak Urdu</div>
              </div>
              <div>
                <div className="sec-hd"><span className="card-hd-bar" />Translation History</div>
                {translations.length === 0 ? <div className="empty"><div className="empty-i">🌐</div>No translations yet.</div> : translations.map(t => (
                  <div key={t._id} className="hi">
                    <div className="hi-top"><span className="badge-ur">UR</span><span className="hi-orig">{t.inputText}</span></div>
                    <div className="sep" />
                    <div className="hi-bot"><span className="badge-en">EN</span><span className="hi-en">{t.translatedText}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DAILY SPEECH TAB ── */}
          {activeTab === "speech" && (
            <div className="sp-area">

              {/* READY */}
              {speechPhase === "ready" && (
                <div className="sp-ready">
                  {todayPracticed && <div className="sp-today-badge"><span className="sp-today-dot" />You practiced today! Great job 🎉</div>}

                  {/* Error banners */}
                  {speechError && (
                    <div className="err-banner">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      {speechError}
                    </div>
                  )}
                  {micError && (
                    <div className="err-banner">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      {micError}
                    </div>
                  )}

                  <div className="topic-card">
                    <div className="topic-label"><span className="topic-label-bar" />Today's Topic</div>
                    <div className="topic-text">{dailyTopic}</div>
                    <div className="topic-sub">Speak naturally for as long as you can. There are no wrong answers — just express your thoughts clearly in English.</div>
                  </div>

                  <div className="sp-stats-row">
                    <div className="sp-stat-card"><div className="sp-stat-n">🔥 {streak}</div><div className="sp-stat-l">Day streak</div></div>
                    <div className="sp-stat-card"><div className="sp-stat-n">{speechSessions.length}</div><div className="sp-stat-l">Total speeches</div></div>
                    <div className="sp-stat-card"><div className="sp-stat-n">{bestScore}<span style={{fontSize:12,color:"#94a3b8"}}>/30</span></div><div className="sp-stat-l">Best score</div></div>
                  </div>

                  <button className="sp-start-btn" onClick={startSpeechPractice}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                    Start Speaking
                  </button>

                  {speechSessions.length > 0 && (
                    <button className="sp-history-btn" onClick={() => setSpeechPhase("history")}>
                      📋 View Speech History ({speechSessions.length})
                    </button>
                  )}
                </div>
              )}

              {/* SPEAKING */}
              {speechPhase === "speaking" && (
                <div className="sp-speaking">
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:12,color:"#94a3b8",marginBottom:5,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.5px"}}>Speaking about</div>
                    <div style={{fontSize:15,fontWeight:700,color:"#1e293b",maxWidth:480,textAlign:"center",lineHeight:1.4}}>{dailyTopic}</div>
                  </div>

                  <button className="sp-mic-ring" onClick={() => handleStopAndSave(false)}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                  </button>

                  <div>
                    <div className="sp-timer">{formatDuration(speechTimer)}</div>
                    <div className="sp-timer-label">Tap the mic or click Stop to get feedback</div>
                  </div>

                  <div className="sp-live-transcript">
                    {speechTranscript || <span style={{color:"#cbd5e1"}}>Your speech will appear here as you talk…</span>}
                    {interimTranscript && <span className="sp-interim"> {interimTranscript}</span>}
                  </div>

                  <button className="sp-stop-btn" onClick={() => handleStopAndSave(false)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                    Stop & Get Feedback
                  </button>
                </div>
              )}

              {/* PROCESSING */}
              {speechPhase === "processing" && (
                <div className="sp-processing">
                  <div className="sp-spinner" />
                  <div className="sp-processing-text">Analyzing your speech…</div>
                  <div className="sp-processing-sub">Alex is reviewing your grammar, fluency, and vocabulary</div>
                </div>
              )}

              {/* RESULTS */}
              {speechPhase === "results" && speechResult && (
                <div className="sp-results">
                  {saveError && <div className="warn-banner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>{saveError}</div>}

                  <div className="score-card">
                    <div className="score-top">
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:4}}>Your Score</div>
                        <div style={{fontSize:13,color:"#64748b"}}>Spoken for {formatDuration(speechTimer)}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div className="score-total-n" style={{color:scoreColor(speechResult.scores.total,30)}}>{speechResult.scores.total}</div>
                        <div className="score-total-label">out of 30</div>
                      </div>
                    </div>
                    <div className="score-bars">
                      {[{label:"Fluency",val:speechResult.scores.fluency},{label:"Grammar",val:speechResult.scores.grammar},{label:"Vocabulary",val:speechResult.scores.vocabulary}].map(({label,val}) => (
                        <div key={label} className="score-bar-row">
                          <div className="score-bar-label">{label}</div>
                          <div className="score-bar-track"><div className="score-bar-fill" style={{width:`${val*10}%`,background:scoreColor(val)}}/></div>
                          <div className="score-bar-num" style={{color:scoreColor(val)}}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {speechResult.summary && (
                    <div className="summary-card"><div className="summary-label">Alex's Feedback</div>{speechResult.summary}</div>
                  )}

                  <div className="improvements-card">
                    <div className="imp-hd">Lines to Improve {speechResult.improvements.length > 0 && <span className="imp-count">{speechResult.improvements.length} found</span>}</div>
                    {speechResult.improvements.length === 0
                      ? <div className="imp-none">🎉 Excellent! No major improvements needed. Your English is great!</div>
                      : speechResult.improvements.map((imp: any, i: number) => (
                        <div key={i} className="imp-item">
                          <div className="imp-original">❌ <strong>You said:</strong> {imp.original}</div>
                          <div className="imp-arrow">↓</div>
                          <div className="imp-improved">✅ {imp.improved}</div>
                          <div className="imp-reason">💡 {imp.reason}</div>
                        </div>
                      ))
                    }
                  </div>

                  {speechResult.correctedSpeech && (
                    <div className="corrected-card">
                      <div className="corrected-hd">📝 Your Corrected Speech</div>
                      <div className="corrected-text">{speechResult.correctedSpeech}</div>
                    </div>
                  )}

                  <button className="sp-again-btn" onClick={() => { setSpeechPhase("ready"); setSpeechResult(null); setSpeechTranscript(""); setSpeechTimer(0); setSpeechError(null); setSaveError(null); }}>
                    🎤 Practice Again
                  </button>
                </div>
              )}

              {/* HISTORY LIST */}
              {speechPhase === "history" && !selectedHistoryItem && (
                <div className="sp-history">
                  <button className="sp-hist-back" onClick={() => setSpeechPhase("ready")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back
                  </button>
                  <div style={{fontSize:16,fontWeight:700,color:"#0f172a",marginBottom:4}}>Speech History</div>
                  {speechSessions.length === 0
                    ? <div className="empty"><div className="empty-i">📋</div>No speeches yet.</div>
                    : speechSessions.map((s: any) => (
                      <div key={s._id} className="sp-hist-item" onClick={() => setSelectedHistoryItem(s)}>
                        <div className="sp-hist-score" style={{background:`${scoreColor(s.scores.total,30)}18`}}>
                          <div className="sp-hist-score-n" style={{color:scoreColor(s.scores.total,30)}}>{s.scores.total}</div>
                          <div className="sp-hist-score-l" style={{color:scoreColor(s.scores.total,30)}}>/30</div>
                        </div>
                        <div className="sp-hist-info">
                          <div className="sp-hist-topic">{s.topic}</div>
                          <div className="sp-hist-meta">
                            <span>{s.date}</span><span className="sp-hist-dot"/><span>{formatDuration(s.durationSeconds)}</span><span className="sp-hist-dot"/><span>{s.improvements?.length ?? 0} improvements</span>
                          </div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* HISTORY DETAIL */}
              {speechPhase === "history" && selectedHistoryItem && (
                <div className="sp-detail">
                  <button className="sp-hist-back" onClick={() => setSelectedHistoryItem(null)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back to history
                  </button>

                  <div className="score-card">
                    <div className="score-top">
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:4}}>{selectedHistoryItem.date}</div>
                        <div style={{fontSize:13,color:"#64748b",maxWidth:380,lineHeight:1.4}}>{selectedHistoryItem.topic}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div className="score-total-n" style={{color:scoreColor(selectedHistoryItem.scores.total,30)}}>{selectedHistoryItem.scores.total}</div>
                        <div className="score-total-label">out of 30</div>
                      </div>
                    </div>
                    <div className="score-bars">
                      {[{label:"Fluency",val:selectedHistoryItem.scores.fluency},{label:"Grammar",val:selectedHistoryItem.scores.grammar},{label:"Vocabulary",val:selectedHistoryItem.scores.vocabulary}].map(({label,val}) => (
                        <div key={label} className="score-bar-row">
                          <div className="score-bar-label">{label}</div>
                          <div className="score-bar-track"><div className="score-bar-fill" style={{width:`${val*10}%`,background:scoreColor(val)}}/></div>
                          <div className="score-bar-num" style={{color:scoreColor(val)}}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="improvements-card">
                    <div className="imp-hd">Lines to Improve {selectedHistoryItem.improvements?.length > 0 && <span className="imp-count">{selectedHistoryItem.improvements.length} found</span>}</div>
                    {!selectedHistoryItem.improvements?.length
                      ? <div className="imp-none">🎉 No improvements needed for this speech!</div>
                      : selectedHistoryItem.improvements.map((imp: any, i: number) => (
                        <div key={i} className="imp-item">
                          <div className="imp-original">❌ <strong>You said:</strong> {imp.original}</div>
                          <div className="imp-arrow">↓</div>
                          <div className="imp-improved">✅ {imp.improved}</div>
                          <div className="imp-reason">💡 {imp.reason}</div>
                        </div>
                      ))
                    }
                  </div>

                  {selectedHistoryItem.correctedSpeech && (
                    <div className="corrected-card">
                      <div className="corrected-hd">📝 Corrected Speech</div>
                      <div className="corrected-text">{selectedHistoryItem.correctedSpeech}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}