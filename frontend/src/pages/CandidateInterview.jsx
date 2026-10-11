import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Video, VideoOff, Mic, MicOff, Settings, PhoneOff, Clock, CheckCircle2, 
  ChevronRight, AlertCircle, Sparkles, Volume2, VolumeX, RotateCcw, 
  BrainCircuit, ShieldCheck, ShieldAlert, Cpu, Activity, User, Eye, EyeOff, 
  Edit3, MessageSquare, Check, ArrowRight, CheckSquare, Loader2, AlertTriangle, 
  Play, HelpCircle, Layers, Award, Radio, RefreshCw, BarChart2, Shield, Info
} from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, setDoc, addDoc, collection, updateDoc, getDoc } from 'firebase/firestore';
import { API_BASE_URL } from '../config/api';

export default function CandidateInterview() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract active session ticket from location.state or recover from sessionStorage
  const sessionData = useMemo(() => {
    if (location.state?.requestId && location.state?.jobId) {
      return location.state;
    }
    try {
      const stored = sessionStorage.getItem('hv_active_interview_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.requestId && parsed?.jobId) return parsed;
      }
    } catch (e) {
      console.warn("Could not parse interview session recovery ticket:", e);
    }
    return null;
  }, [location.state]);

  const [isValidatingSession, setIsValidatingSession] = useState(true);

  // Raw questions from verified session data
  const rawQuestions = useMemo(() => sessionData?.generatedQuestions || [], [sessionData]);

  // Structured questions array with normalized metadata
  const questions = useMemo(() => {
    const defaultIntro = {
      id: "intro_0",
      text: "Hello! Welcome to your HireVision AI technical evaluation. To start us off, could you briefly introduce yourself, highlight your core background, and share the technical projects you are most proud of?",
      category: "introduction",
      difficulty: "core",
      target_skill: "Engineering Overview",
      resume_anchor: "Candidate Profile & Background",
      expected_signals: ["Clear communication", "Relevant technical stack", "Impactful project highlights"]
    };

    if (rawQuestions && rawQuestions.length > 0) {
      const parsed = rawQuestions.map((q, idx) => {
        if (typeof q === 'string') {
          return {
            id: `q_${idx + 1}`,
            text: q,
            category: "technical",
            difficulty: "mid",
            target_skill: "Core Technical Competencies",
            resume_anchor: "",
            expected_signals: ["Systematic problem solving", "Technical depth", "Clear architecture"]
          };
        }
        return {
          id: q.id || `q_${idx + 1}`,
          text: q.text || "Explain your technical approach.",
          category: q.category || "technical",
          difficulty: q.difficulty || "mid",
          target_skill: q.target_skill || "Domain Skills",
          resume_anchor: q.resume_anchor || "",
          expected_signals: q.expected_signals || ["Technical clarity", "Problem structuring"],
          red_flags: q.red_flags || [],
          follow_ups: q.follow_ups || []
        };
      });
      return [defaultIntro, ...parsed];
    }

    return [
      defaultIntro,
      {
        id: "q_1",
        text: "Can you describe a challenging architectural problem you faced recently in React or full-stack web development and how you solved it?",
        category: "technical",
        difficulty: "senior",
        target_skill: "Full-Stack Architecture",
        resume_anchor: "Web Applications Engineering",
        expected_signals: ["State management trade-offs", "Performance optimizations", "Robust error boundaries"]
      },
      {
        id: "q_2",
        text: "Tell me about a time you had to optimize application latency or database query performance under high load.",
        category: "situational",
        difficulty: "mid",
        target_skill: "Performance Optimization",
        resume_anchor: "Backend & System Throughput",
        expected_signals: ["Profiling methodologies", "Indexing strategies", "Caching implementation"]
      },
      {
        id: "q_3",
        text: "How do you resolve technical disagreements with teammates when choosing between competing libraries or design patterns?",
        category: "behavioral",
        difficulty: "core",
        target_skill: "Collaborative Leadership",
        resume_anchor: "Cross-Functional Collaboration",
        expected_signals: ["Objective benchmarking", "Empathetic communication", "Alignment on team goals"]
      }
    ];
  }, [rawQuestions]);

  // Current session & question progression
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = questions[currentIndex] || questions[0];
  const [answers, setAnswers] = useState(() => Array(questions.length).fill(""));
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [manualText, setManualText] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Time & Session telemetry
  const [timeLeft, setTimeLeft] = useState(180);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [wordsPerMinute, setWordsPerMinute] = useState(0);

  // Audio / Speech State
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");

  // Proctoring & Vision State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const animationFrameId = useRef(null);
  const [proctorStatus, setProctorStatus] = useState('initializing'); // 'initializing' | 'active' | 'warning' | 'error'
  const [proctoringFlags, setProctoringFlags] = useState([]);
  const [facesDetected, setFacesDetected] = useState(1);
  const [faceCentered, setFaceCentered] = useState(true);

  // Navigation & Dialog Modals
  const [showEndWarning, setShowEndWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);

  // 0. Session Authorization Gatekeeper & Firestore State Verification
  useEffect(() => {
    // Layer 1: Check for session ticket existence
    if (!sessionData || !sessionData.requestId || !sessionData.jobId) {
      navigate('/candidate/profile', {
        replace: true,
        state: {
          sessionError: "Direct interview URL access is disallowed. You must join via an active 6-digit job PIN and receive admission from the recruiter's waiting room."
        }
      });
      return;
    }

    let isSubscribed = true;
    const verifySessionTicket = async () => {
      try {
        const reqSnap = await getDoc(doc(db, 'interview_requests', sessionData.requestId));
        if (!isSubscribed) return;

        if (!reqSnap.exists()) {
          sessionStorage.removeItem('hv_active_interview_session');
          navigate('/candidate/profile', {
            replace: true,
            state: { sessionError: "The requested interview session record does not exist or has been removed." }
          });
          return;
        }

        const data = reqSnap.data();

        // Check if session has already ended
        if (data.status === 'completed') {
          sessionStorage.removeItem('hv_active_interview_session');
          navigate('/candidate/profile', {
            replace: true,
            state: { sessionError: "This interview session has already been completed and submitted. Re-entry is not permitted." }
          });
          return;
        }

        // Check if session was rejected or aborted
        if (data.status === 'rejected' || data.status === 'aborted') {
          sessionStorage.removeItem('hv_active_interview_session');
          navigate('/candidate/profile', {
            replace: true,
            state: { sessionError: "This interview session was terminated or declined by the recruiter." }
          });
          return;
        }

        // Lock session as 'in_progress' if currently 'approved'
        if (data.status === 'approved') {
          await updateDoc(doc(db, 'interview_requests', sessionData.requestId), {
            status: 'in_progress',
            startedAt: new Date().toISOString()
          });
        }

        setIsValidatingSession(false);
      } catch (err) {
        console.error("Firestore session verification notice:", err);
        setIsValidatingSession(false);
      }
    };

    verifySessionTicket();

    return () => {
      isSubscribed = false;
    };
  }, [sessionData, navigate]);

  // 1. Initialize Voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0) {
        const preferred = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Female'))
        );
        setSelectedVoiceURI(prev => prev || (preferred ? preferred.voiceURI : voices[0].voiceURI));
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // 2. Initialize Web Speech Recognition
  useEffect(() => {
    if (isValidatingSession) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setCurrentTranscript(prev => {
          const newTranscript = final ? (prev ? prev + " " + final : final) : prev;
          const displayEl = document.getElementById('live-answer-buffer');
          if (displayEl && interim) {
            displayEl.innerText = (newTranscript + " " + interim).trim();
          }
          return newTranscript;
        });
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.warn("Speech recognition notice:", event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
  }, []);

  // Sync mic state with speech recognition
  useEffect(() => {
    if (isValidatingSession) return;
    if (micEnabled && !isAISpeaking && recognitionRef.current && !isListening && !isManualMode) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Already active
      }
    } else if ((!micEnabled || isAISpeaking || isManualMode) && recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        // Already stopped
      }
    }
  }, [micEnabled, isListening, isAISpeaking, isManualMode, isValidatingSession]);

  // 3. AI Question TTS Readout
  const speakQuestion = (text) => {
    if (isValidatingSession) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const selected = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (selected) utterance.voice = selected;

      utterance.rate = 0.96;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsAISpeaking(true);
      utterance.onend = () => setIsAISpeaking(false);
      utterance.onerror = () => setIsAISpeaking(false);

      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (isValidatingSession) return;
    const timer = setTimeout(() => {
      speakQuestion(currentQuestion.text);
    }, 600);

    return () => {
      clearTimeout(timer);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentIndex, currentQuestion, selectedVoiceURI, isValidatingSession]);

  // 4. Question Countdown Timer
  useEffect(() => {
    if (isValidatingSession) return;
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft, isValidatingSession]);

  // 5. Calculate Real-Time Speech Metrics
  useEffect(() => {
    const activeText = isManualMode ? manualText : currentTranscript;
    const words = activeText.trim().split(/\s+/).filter(Boolean).length;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartTime) / 1000));
    const calculatedWPM = Math.round((words / elapsedSeconds) * 60);
    setWordsPerMinute(calculatedWPM > 220 ? 140 : calculatedWPM);
  }, [currentTranscript, manualText, isManualMode, questionStartTime]);

  // 6. Webcam & Hardware Streams
  useEffect(() => {
    if (isValidatingSession) return;
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: true 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera or microphone access denied:", err);
        setProctorStatus('error');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isValidatingSession]);

  // 7. TensorFlow.js & BlazeFace Proctoring Engine
  useEffect(() => {
    if (isValidatingSession) return;
    let isMounted = true;

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { 
          resolve(); 
          return; 
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    const initProctoring = async () => {
      setProctorStatus('initializing');
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface");

        const loadModel = () => Promise.race([
          window.blazeface.load(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Model download timeout")), 12000))
        ]);

        const model = await loadModel();
        if (isMounted) {
          setProctorStatus('active');
          detectFaces(model);
        }
      } catch (e) {
        console.error("Failed to load CV proctoring model:", e);
        if (isMounted) setProctorStatus('error');
      }
    };

    const detectFaces = async (model) => {
      if (!videoRef.current || !canvasRef.current) {
        if (isMounted) {
          animationFrameId.current = requestAnimationFrame(() => detectFaces(model));
        }
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        try {
          const predictions = await model.estimateFaces(video, false);
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          setFacesDetected(predictions.length);

          if (predictions.length === 0) {
            setProctorStatus('warning');
            setFaceCentered(false);
            if (Math.random() < 0.04) {
              setProctoringFlags(prev => [
                ...prev.slice(-4), 
                { time: new Date().toLocaleTimeString(), issue: 'Face absent from frame' }
              ]);
            }
          } else if (predictions.length > 1) {
            setProctorStatus('warning');
            setFaceCentered(false);
            if (Math.random() < 0.04) {
              setProctoringFlags(prev => [
                ...prev.slice(-4), 
                { time: new Date().toLocaleTimeString(), issue: 'Multiple persons detected' }
              ]);
            }
          } else {
            setProctorStatus('active');
            const pred = predictions[0];
            const start = pred.topLeft;
            const end = pred.bottomRight;
            const centerX = (start[0] + end[0]) / 2;
            const canvasMidX = canvas.width / 2;
            const isCentered = Math.abs(centerX - canvasMidX) < canvas.width * 0.28;
            setFaceCentered(isCentered);

            // Draw neural boundary box with sci-fi rounded brackets
            const size = [end[0] - start[0], end[1] - start[1]];
            ctx.strokeStyle = isCentered ? 'rgba(99, 102, 241, 0.85)' : 'rgba(234, 179, 8, 0.85)';
            ctx.lineWidth = 3;
            ctx.setLineDash([12, 6]);
            ctx.strokeRect(start[0], start[1], size[0], size[1]);
            ctx.setLineDash([]);

            // Draw landmark keypoints (eyes, nose, mouth corners)
            ctx.fillStyle = '#38bdf8';
            pred.landmarks.forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt[0], pt[1], 4, 0, 2 * Math.PI);
              ctx.fill();
            });
          }
        } catch (err) {
          // Frame drop protection
        }
      }

      if (isMounted) {
        animationFrameId.current = requestAnimationFrame(() => detectFaces(model));
      }
    };

    initProctoring();

    return () => {
      isMounted = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  // 8. Hardware Controls
  const toggleMic = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const audioTracks = videoRef.current.srcObject.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setMicEnabled(audioTracks[0].enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const videoTracks = videoRef.current.srcObject.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setVideoEnabled(videoTracks[0].enabled);
      }
    }
  };

  // 9. Answer Navigation & Submission
  const handleNextQuestion = async () => {
    const liveDisplay = document.getElementById('live-answer-buffer');
    let candidateResponse = isManualMode 
      ? manualText.trim() 
      : ((liveDisplay && liveDisplay.innerText.trim()) || currentTranscript.trim());

    if (!candidateResponse) {
      candidateResponse = "[No response verbalized by candidate]";
    }

    setIsProcessingAnswer(true);

    // Call Groq cleanup engine for speech artefacts
    let cleanedResponse = candidateResponse;
    if (candidateResponse.length >= 10 && !isManualMode) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/clean-transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: candidateResponse })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.cleaned) cleanedResponse = data.cleaned;
        }
      } catch (e) {
        console.warn("Autocorrect fallback, preserving raw speech:", e);
      }
    }

    setIsProcessingAnswer(false);

    const updatedAnswers = [...answers];
    updatedAnswers[currentIndex] = cleanedResponse;
    setAnswers(updatedAnswers);

    if (currentIndex < questions.length - 1) {
      // Advance to next question
      setCurrentIndex(prev => prev + 1);
      setCurrentTranscript("");
      setManualText("");
      setIsManualMode(false);
      setTimeLeft(180);
      setQuestionStartTime(Date.now());

      if (liveDisplay) liveDisplay.innerText = "";
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    } else {
      // Finalize and save interview
      await finalizeInterview(updatedAnswers);
    }
  };

  const finalizeInterview = async (finalAnswers) => {
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await addDoc(collection(db, 'interviews'), {
          candidateName: user.displayName || "Unknown Candidate",
          candidateUid: user.uid,
          recruiterId: sessionData?.recruiterId || null,
          jobId: sessionData?.jobId || null,
          jobTitle: sessionData?.jobTitle || "AI Technical Interview",
          requestId: sessionData?.requestId || null,
          questions: rawQuestions,
          uiQuestions: questions.map(q => q.text),
          answers: finalAnswers,
          proctoringSummary: {
            flagsLogged: proctoringFlags.length,
            flags: proctoringFlags,
            model: "TensorFlow.js BlazeFace Neural Mesh"
          },
          completedAt: new Date().toISOString()
        });
      }

      if (sessionData?.requestId) {
        await updateDoc(doc(db, 'interview_requests', sessionData.requestId), {
          status: 'completed'
        });
      }

      sessionStorage.removeItem('hv_active_interview_session');

      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }

      setIsSubmitting(false);
      setSubmissionComplete(true);
    } catch (err) {
      console.error("Error saving completed interview:", err);
      setIsSubmitting(false);
      alert("Error saving interview session: " + err.message);
    }
  };

  const handleEndInterview = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setShowEndWarning(true);
  };

  const confirmEnd = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    sessionStorage.removeItem('hv_active_interview_session');
    if (sessionData?.requestId) {
      try {
        await updateDoc(doc(db, 'interview_requests', sessionData.requestId), {
          status: 'aborted'
        });
      } catch (err) {
        console.error("Error updating status to aborted:", err);
      }
    }
    navigate('/candidate/profile');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeResponseText = isManualMode ? manualText : currentTranscript;
  const wordCount = activeResponseText.trim().split(/\s+/).filter(Boolean).length;

  if (isValidatingSession) {
    return (
      <div className="h-screen w-full bg-[#070b14] flex flex-col items-center justify-center text-slate-200">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
          <ShieldCheck size={32} />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Verifying Interview Authorization...</h3>
        <p className="text-xs text-slate-400 font-mono">Checking session token & waiting room clearance</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#070b14] text-slate-200 flex flex-col font-sans overflow-hidden select-none">
      
      {/* 1. TOP COMMAND BAR / HUD */}
      <header className="h-16 px-6 bg-[#0b1120]/90 backdrop-blur-xl border-b border-slate-800/80 flex items-center justify-between z-30 flex-shrink-0">
        
        {/* Left: Branding & Role Identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
              <BrainCircuit size={19} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-wide">HireVision</h1>
                <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-semibold tracking-wider">
                  Proctored Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {sessionData?.jobTitle || "AI Technical Interview"}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Interactive Question Stepper */}
        <div className="hidden lg:flex items-center gap-2 bg-[#0e1628] px-3.5 py-1.5 rounded-full border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 mr-1 font-mono">
            PROGRESS:
          </span>
          <div className="flex items-center gap-1.5">
            {questions.map((q, idx) => {
              const isDone = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono transition-all duration-300 ${
                    isDone 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isCurrent
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 border border-indigo-400/50 scale-105'
                      : 'bg-slate-800/60 text-slate-500 border border-slate-700/40'
                  }`}
                >
                  {isDone ? <Check size={11} strokeWidth={3} /> : `Q${idx + 1}`}
                </div>
              );
            })}
          </div>
          <div className="w-16 h-1.5 bg-slate-800 rounded-full ml-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500" 
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Right: Audio Voice Picker, Countdown Timer, and Exit */}
        <div className="flex items-center gap-3">
          
          {/* AI Voice Selector */}
          <div className="hidden sm:flex items-center bg-[#0e1628] rounded-xl px-2.5 py-1.5 border border-slate-800">
            <Volume2 size={14} className="text-indigo-400 mr-2" />
            <select
              className="bg-transparent text-xs text-slate-300 outline-none w-28 xl:w-36 truncate cursor-pointer"
              value={selectedVoiceURI}
              onChange={(e) => setSelectedVoiceURI(e.target.value)}
              title="Select AI Recruiter Speech Voice"
            >
              {availableVoices.filter(v => v.lang.startsWith('en')).map(v => (
                <option key={v.voiceURI} value={v.voiceURI} className="bg-[#0b1120] text-slate-200">
                  {v.name.replace('Microsoft ', '').replace(' Desktop', '').replace('English ', '')}
                </option>
              ))}
            </select>
          </div>

          {/* Replay Question TTS Audio */}
          <button
            onClick={() => speakQuestion(currentQuestion.text)}
            className="p-2 rounded-xl bg-[#0e1628] border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-400 transition"
            title="Replay AI Question Audio"
          >
            <RotateCcw size={15} />
          </button>

          {/* Countdown Timer with Warning Color */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold transition-all ${
            timeLeft < 30 
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 animate-pulse'
              : timeLeft < 60
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-[#0e1628] border-slate-800 text-slate-300'
          }`}>
            <Clock size={14} className={timeLeft < 30 ? 'text-rose-400' : 'text-slate-400'} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Exit / Abort Session Button */}
          <button 
            onClick={handleEndInterview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
          >
            <PhoneOff size={13} />
            <span className="hidden sm:inline">Exit</span>
          </button>

        </div>
      </header>

      {/* 2. MAIN INTERVIEW STAGE (2-COLUMN GRID) */}
      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        
        {/* LEFT COLUMN: CANDIDATE NEURAL VIDEO MONITOR & TELEMETRY (5 COLS) */}
        <section className="lg:col-span-5 flex flex-col gap-4 h-full overflow-hidden">
          
          {/* Main Video Monitor */}
          <div className="relative flex-1 min-h-[300px] bg-[#0b1120] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center group">
            
            {/* Live Camera Stream */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${!videoEnabled && 'opacity-0'}`}
            />
            
            {/* TensorFlow BlazeFace Landmark Overlay */}
            <canvas 
              ref={canvasRef} 
              className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] pointer-events-none z-10 transition-opacity duration-300 ${!videoEnabled && 'opacity-0'}`} 
            />

            {/* Futuristic Corner Brackets HUD Overlay */}
            <div className="absolute inset-4 pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-indigo-500/40 rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-indigo-500/40 rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-indigo-500/40 rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-indigo-500/40 rounded-br-sm" />
            </div>

            {/* Video Disabled Placeholder */}
            {!videoEnabled && (
              <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-3 text-slate-400">
                  <VideoOff size={28} />
                </div>
                <h4 className="text-sm font-semibold text-slate-300">Camera Feed Paused</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                  Turn on your camera to re-enable neural face alignment and proctoring.
                </p>
              </div>
            )}

            {/* Top HUD Badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
              
              {/* Rec Indicator */}
              <div className="flex items-center gap-2 bg-[#070b14]/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${videoEnabled ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
                <span className={videoEnabled ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {videoEnabled ? 'LIVE PROCTOR' : 'MUTED'}
                </span>
              </div>

              {/* BlazeFace Status Pill */}
              <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all ${
                proctorStatus === 'initializing' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' :
                proctorStatus === 'active' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                proctorStatus === 'error' ? 'bg-slate-700/50 border-slate-600 text-slate-400' :
                'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse'
              }`}>
                <ShieldCheck size={13} />
                <span>
                  {proctorStatus === 'initializing' ? 'Loading BlazeFace...' :
                   proctorStatus === 'active' ? (faceCentered ? '1 Face Locked' : 'Center Face in Frame') :
                   proctorStatus === 'error' ? 'Vision Fallback' : 'Proctor Alert'}
                </span>
              </div>
            </div>

            {/* AI Recruiter Speaking Visualizer Banner */}
            {isAISpeaking && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 bg-indigo-950/80 backdrop-blur-xl border border-indigo-500/40 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-xl shadow-indigo-950/50 animate-bounce">
                <div className="flex items-center gap-1">
                  {[40, 90, 60, 100, 70, 30].map((h, i) => (
                    <span 
                      key={i} 
                      className="w-1 bg-indigo-400 rounded-full animate-pulse" 
                      style={{ height: `${h * 0.22}px`, animationDelay: `${i * 120}ms` }} 
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-indigo-200">
                  AI Recruiter is speaking...
                </span>
              </div>
            )}

            {/* Live Subtitle Drawer (Optional candidate toggle) */}
            {showSubtitles && (currentTranscript || isListening) && (
              <div className="absolute bottom-20 left-4 right-4 bg-[#070b14]/85 backdrop-blur-xl border border-slate-700/60 p-3.5 rounded-xl z-20 shadow-2xl max-h-24 overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span>Real-Time Transcript Preview</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {wordCount} words
                  </span>
                </div>
                <p id="live-answer-buffer" className="text-xs text-slate-200 italic leading-relaxed">
                  {currentTranscript || "Listening for candidate voice response..."}
                </p>
              </div>
            )}

            {/* Floating Studio Controls Dock */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#0b1120]/95 backdrop-blur-2xl p-1.5 rounded-2xl border border-slate-700/70 z-20 shadow-2xl">
              
              <button
                onClick={toggleMic}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  micEnabled 
                    ? 'bg-slate-800/80 text-slate-200 hover:bg-slate-700' 
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                }`}
                title="Toggle Microphone"
              >
                {micEnabled ? <Mic size={15} className="text-emerald-400" /> : <MicOff size={15} />}
                <span className="hidden sm:inline">{micEnabled ? 'Mic On' : 'Muted'}</span>
              </button>

              <button
                onClick={toggleVideo}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  videoEnabled 
                    ? 'bg-slate-800/80 text-slate-200 hover:bg-slate-700' 
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                }`}
                title="Toggle Webcam"
              >
                {videoEnabled ? <Video size={15} className="text-emerald-400" /> : <VideoOff size={15} />}
                <span className="hidden sm:inline">{videoEnabled ? 'Cam On' : 'Cam Off'}</span>
              </button>

              <button
                onClick={() => setShowSubtitles(!showSubtitles)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  showSubtitles 
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' 
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle Live Subtitles"
              >
                <MessageSquare size={15} />
                <span className="hidden sm:inline">Captions</span>
              </button>

            </div>

          </div>

          {/* Real-Time Session Telemetry Strip (4 Bento Mini-Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-shrink-0">
            
            {/* Card 1: Speech Cadence */}
            <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider">Cadence</span>
                <Activity size={12} className="text-indigo-400" />
              </div>
              <div className="text-base font-bold text-white font-mono">
                {wordsPerMinute} <span className="text-[10px] text-slate-400 font-sans font-normal">WPM</span>
              </div>
              <span className="text-[9px] text-indigo-400 mt-1">
                {wordsPerMinute > 150 ? 'Rapid Delivery' : wordsPerMinute > 90 ? 'Optimal Rhythm' : 'Thoughtful Pace'}
              </span>
            </div>

            {/* Card 2: Response Volume */}
            <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider">Volume</span>
                <BarChart2 size={12} className="text-emerald-400" />
              </div>
              <div className="text-base font-bold text-white font-mono">
                {wordCount} <span className="text-[10px] text-slate-400 font-sans font-normal">words</span>
              </div>
              <span className="text-[9px] text-emerald-400 mt-1">
                {wordCount > 60 ? 'Comprehensive' : wordCount > 20 ? 'Active Form' : 'Awaiting Voice'}
              </span>
            </div>

            {/* Card 3: Face & Centering Alignment */}
            <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider">Vision</span>
                <Eye size={12} className="text-blue-400" />
              </div>
              <div className="text-base font-bold text-white font-mono">
                {facesDetected === 1 ? 'Locked' : facesDetected === 0 ? 'Zero' : 'Multiple'}
              </div>
              <span className={`text-[9px] mt-1 ${faceCentered ? 'text-emerald-400' : 'text-amber-400'}`}>
                {faceCentered ? 'Centered in Lens' : 'Align Head Posture'}
              </span>
            </div>

            {/* Card 4: Integrity / Security */}
            <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider">Integrity</span>
                <ShieldCheck size={12} className="text-purple-400" />
              </div>
              <div className="text-base font-bold text-white font-mono">
                {proctoringFlags.length === 0 ? 'Clean' : `${proctoringFlags.length} notice`}
              </div>
              <span className="text-[9px] text-purple-400 mt-1">
                Neural Guard
              </span>
            </div>

          </div>

        </section>

        {/* RIGHT COLUMN: ADAPTIVE QUESTION & ANSWER WORKSPACE (7 COLS) */}
        <section className="lg:col-span-7 flex flex-col gap-4 h-full overflow-hidden">
          
          <div className="flex-1 bg-[#0b1120] rounded-2xl border border-slate-800 p-5 sm:p-7 flex flex-col justify-between overflow-hidden relative shadow-2xl">
            
            {/* Top Question Category & Difficulty Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-slate-800/80 flex-shrink-0">
              
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Question Category Badge */}
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                  <Sparkles size={12} />
                  {currentQuestion.category.replace('_', ' ')}
                </span>

                {/* Target Skill Chip */}
                {currentQuestion.target_skill && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                    <Cpu size={12} className="text-cyan-400" />
                    <span>Focus: {currentQuestion.target_skill}</span>
                  </span>
                )}

                {/* Difficulty Rating */}
                <span className="px-2 py-0.5 rounded text-[11px] font-mono capitalize bg-slate-800/60 text-slate-400 border border-slate-700/50">
                  Tier: {currentQuestion.difficulty}
                </span>

              </div>

              {/* Toggle Mode: Voice vs Manual Text Polishing */}
              <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setIsManualMode(false)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    !isManualMode 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mic size={12} />
                  <span>Speech</span>
                </button>
                <button
                  onClick={() => {
                    setIsManualMode(true);
                    if (!manualText && currentTranscript) setManualText(currentTranscript);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    isManualMode 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Edit3 size={12} />
                  <span>Editor</span>
                </button>
              </div>

            </div>

            {/* Question Anchor & Statement Content */}
            <div className="py-4 overflow-y-auto custom-scrollbar flex-shrink-0">
              
              {/* Optional Resume Anchor Callout */}
              {currentQuestion.resume_anchor && (
                <div className="mb-3.5 px-3 py-2 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-start gap-2">
                  <Info size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-indigo-200">Grounded in your resume background: </span>
                    <span className="italic text-slate-300">"{currentQuestion.resume_anchor}"</span>
                  </div>
                </div>
              )}

              {/* Main Question Heading */}
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-mono font-bold text-sm flex-shrink-0 mt-0.5">
                  Q{currentIndex + 1}
                </span>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white leading-relaxed">
                  {currentQuestion.text}
                </h2>
              </div>

              {/* Signals / Evaluation Guidance */}
              {currentQuestion.expected_signals && currentQuestion.expected_signals.length > 0 && (
                <div className="mt-3.5 pl-11 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Recommended touchpoints:</span>
                  {currentQuestion.expected_signals.slice(0, 3).map((sig, i) => (
                    <span key={i} className="text-[11px] bg-slate-800/80 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded-md">
                      ✓ {sig}
                    </span>
                  ))}
                </div>
              )}

            </div>

            {/* Answer Workspace Box (Voice or Manual Text) */}
            <div className="flex-1 min-h-[160px] bg-[#070b14] rounded-xl border border-slate-800 p-4 flex flex-col justify-between overflow-hidden">
              
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isManualMode ? 'bg-amber-400' : isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="text-xs font-semibold text-slate-300">
                    {isManualMode ? 'Manual Response Editor' : isListening ? 'Speech Recognition Active' : 'Microphone Inactive'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    {wordCount} words
                  </span>
                  {(currentTranscript || manualText) && (
                    <button
                      onClick={() => {
                        setCurrentTranscript("");
                        setManualText("");
                        const displayEl = document.getElementById('live-answer-buffer');
                        if (displayEl) displayEl.innerText = "";
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 transition"
                      title="Clear Response"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Active Workspace View */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isManualMode ? (
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Type or refine your answer here directly..."
                    className="w-full h-full bg-transparent text-sm text-slate-200 outline-none resize-none placeholder:text-slate-600 leading-relaxed font-sans"
                  />
                ) : (
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {currentTranscript || (
                      <span className="text-slate-500 italic">
                        Speak into your microphone. Your answer will be transcribed in real time and automatically evaluated by the AI engine...
                      </span>
                    )}
                  </p>
                )}
              </div>

            </div>

            {/* Bottom Action Footer */}
            <div className="pt-4 mt-2 flex items-center justify-between gap-4 flex-shrink-0">
              
              <div className="text-xs text-slate-500 hidden sm:block">
                Question <span className="text-slate-300 font-bold">{currentIndex + 1}</span> of <span className="text-slate-300 font-bold">{questions.length}</span>
              </div>

              <button
                onClick={handleNextQuestion}
                disabled={isProcessingAnswer || isSubmitting}
                className={`flex-1 sm:flex-initial sm:min-w-[220px] py-3.5 px-6 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2.5 shadow-xl ${
                  isProcessingAnswer || isSubmitting 
                    ? 'bg-slate-700 cursor-not-allowed text-slate-400' 
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/25 active:scale-[0.98]'
                }`}
              >
                {isProcessingAnswer ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-indigo-300" />
                    <span>Neural Grammar Polish...</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Submitting Interview...</span>
                  </>
                ) : currentIndex < questions.length - 1 ? (
                  <>
                    <span>Next Question</span>
                    <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <span>Submit & Finish Interview</span>
                    <CheckSquare size={16} />
                  </>
                )}
              </button>

            </div>

          </div>

        </section>

      </main>

      {/* 3. CONFIRM END / EXIT MODAL */}
      {showEndWarning && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-700 p-6 rounded-2xl max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">End Interview Session?</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Are you sure you want to exit? Your session telemetry will be cancelled and your interview request will be marked as incomplete.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowEndWarning(false)} 
                className="px-4 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 font-semibold text-sm transition"
              >
                Resume Interview
              </button>
              <button 
                onClick={confirmEnd} 
                className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm transition shadow-lg shadow-rose-500/25"
              >
                Yes, Exit Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUCCESS SUBMISSION CELEBRATION MODAL */}
      {submissionComplete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-indigo-500/40 p-8 rounded-3xl max-w-lg w-full shadow-2xl text-center relative animate-in fade-in zoom-in-95">
            
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-500/30 border border-indigo-400/40">
              <CheckCircle2 size={40} strokeWidth={2.5} />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">Interview Completed!</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Your responses, speech transcripts, and neural proctoring telemetry have been securely packaged and submitted to the recruiter.
            </p>

            <div className="grid grid-cols-3 gap-3 p-4 bg-[#070b14] rounded-2xl border border-slate-800 mb-6">
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-medium">Questions</p>
                <p className="text-lg font-bold text-indigo-400 font-mono">{questions.length}/{questions.length}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-medium">Verification</p>
                <p className="text-lg font-bold text-emerald-400 font-mono">100%</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-medium">Status</p>
                <p className="text-lg font-bold text-purple-400 font-mono">Submitted</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/candidate/profile')}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold transition shadow-xl shadow-indigo-600/30"
            >
              Return to Candidate Dashboard
            </button>

          </div>
        </div>
      )}

    </div>
  );
}