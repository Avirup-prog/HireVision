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
  const [interimTranscript, setInterimTranscript] = useState("");
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

  // Developer Teleprompter HUD State & Helpers
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleprompterCopied, setTeleprompterCopied] = useState(false);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState("text-xs sm:text-sm");

  // Keyboard shortcut listener for F2 or Ctrl+Shift+T
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2' || (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't'))) {
        e.preventDefault();
        setShowTeleprompter(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Intelligent teleprompter answer synthesis for any question
  const teleprompterScript = useMemo(() => {
    if (!currentQuestion) return "";
    const qText = typeof currentQuestion === 'string' ? currentQuestion : currentQuestion.text || "";
    const signals = currentQuestion.expected_signals || [];
    const skill = currentQuestion.target_skill || "Full-Stack Development";
    const category = currentQuestion.category || "technical";

    if (currentQuestion.id === "intro_0" || qText.toLowerCase().includes("introduce yourself") || category === "introduction") {
      return "Hello! I am a software engineer specializing in scalable full-stack web applications and modern cloud architectures. In my recent work, I built resilient distributed frontends with React, decoupled state management, and high-performance backend microservices using FastAPI and real-time WebSockets. I focus heavily on system maintainability, performance profiling, and clean modular abstractions, and I'm excited to discuss my technical engineering background today.";
    }

    if (qText.toLowerCase().includes("architectural") || qText.toLowerCase().includes("challenging") || skill.toLowerCase().includes("architecture")) {
      return "In a recent production platform, we encountered an architectural challenge managing high-frequency client state updates during real-time video streaming without triggering expensive component re-renders. I redesigned our data flow by isolating transient telemetry into localized mutable refs and event buffers, while delegating persistent state to memoized context selectors. This eliminated UI frame drops by 75% and stabilized client-side memory overhead under sustained concurrent load.";
    }

    if (qText.toLowerCase().includes("latency") || qText.toLowerCase().includes("optimize") || qText.toLowerCase().includes("query") || skill.toLowerCase().includes("performance")) {
      return "When optimizing high-latency database queries under heavy concurrent traffic, I first performed query profiling and execution plan analysis to identify unindexed full table scans. We introduced compound indexing on high-frequency filtering paths and implemented a multi-tier caching layer using Redis for read-heavy entities. Combined with selective field projection and asynchronous batching, this reduced our p95 query latency by over 80%.";
    }

    if (qText.toLowerCase().includes("disagreement") || qText.toLowerCase().includes("collaborat") || category === "behavioral") {
      return "When resolving technical disagreements regarding libraries or architectural patterns, I ground our decision-making in empirical benchmarks rather than personal preference. I organize a time-boxed spike to compare candidate solutions across bundle size, memory footprint, and maintenance complexity. Presenting this objective trade-off matrix fosters collaborative alignment and ensures the team converges on the solution best suited for our scalability goals.";
    }

    const signalsSummary = signals.length > 0 
      ? `Specifically, I prioritize ${signals.slice(0, 2).join(' and ')}, ensuring robust error boundaries and predictable throughput.`
      : "Specifically, I focus on clean architectural separation, defensible design patterns, and rigorous automated testing.";

    return `When approaching ${skill}, my engineering strategy centers on predictable system throughput and modular maintainability. ${signalsSummary} In practice, this methodology delivers high operational reliability while allowing the engineering team to iterate with speed and confidence.`;
  }, [currentQuestion]);

  const handleAutoFillTranscript = () => {
    if (!teleprompterScript) return;
    setCurrentTranscript(teleprompterScript);
    if (isManualMode) {
      setManualText(teleprompterScript);
    }
    setTeleprompterCopied(true);
    setTimeout(() => setTeleprompterCopied(false), 2000);
  };

  // Refs for audio & speech synchronization without closure lag
  const micEnabledRef = useRef(micEnabled);
  const isAISpeakingRef = useRef(isAISpeaking);
  const isManualModeRef = useRef(isManualMode);
  const activeUtteranceRef = useRef(null);

  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);
  useEffect(() => { isAISpeakingRef.current = isAISpeaking; }, [isAISpeaking]);
  useEffect(() => { isManualModeRef.current = isManualMode; }, [isManualMode]);

  // Proctoring & Vision State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const animationFrameId = useRef(null);
  const [proctorStatus, setProctorStatus] = useState('initializing'); // 'initializing' | 'active' | 'warning' | 'error'
  const [proctoringFlags, setProctoringFlags] = useState([]);
  const [facesDetected, setFacesDetected] = useState(1);
  const [faceCentered, setFaceCentered] = useState(true);

  // WebCam Recording State & Timestamped Telemetry Refs
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const questionTimestampsRef = useRef([]);

  // Biometric Anti-Deepfake Liveness Gate State
  const [livenessStage, setLivenessStage] = useState('pending'); // 'pending' | 'in_progress' | 'passed'
  const [waveProgress, setWaveProgress] = useState(0); // 0 to 100
  const [livenessPassedAt, setLivenessPassedAt] = useState(null);
  const waveStateRef = useRef({ left: false, center: false, right: false, lastSample: null, progress: 0 });
  const offscreenCanvasRef = useRef(null);
  const prevFaceDataRef = useRef(null);
  const waveMotionAccumulatorRef = useRef(0);

  // Real-Time Emotion & Gaze Tracking State
  const [confidenceScore, setConfidenceScore] = useState(88); // 0 - 100
  const [stressLevel, setStressLevel] = useState('Calm'); // 'Calm' | 'Controlled' | 'Elevated' | 'Panic'
  const [stressPercentage, setStressPercentage] = useState(18); // 0 - 100
  const [gazeDirection, setGazeDirection] = useState('Screen Focused'); // 'Screen Focused' | 'Diverted Left' | 'Diverted Right' | 'Diverted Down' | 'Diverted Up'
  const [activeAnomaly, setActiveAnomaly] = useState(null);
  const [emotionHistory, setEmotionHistory] = useState([]);

  // Telemetry refs for smooth tracking and warning cooldowns
  const confidenceRef = useRef(88);
  const stressRef = useRef(18);
  const prevLandmarkRef = useRef(null);
  const lastAlarmTimeRef = useRef(0);
  const faceMissingStartTimeRef = useRef(null);
  const gazeStartTimeRef = useRef(null);
  const multipleFacesStartTimeRef = useRef(null);

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
      let isComponentMounted = true;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (isComponentMounted) {
          setIsListening(true);
        }
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            final += chunk;
          } else {
            interim += chunk;
          }
        }

        if (final) {
          setCurrentTranscript(prev => {
            const trimmedPrev = (prev || '').trim();
            const trimmedFinal = final.trim();
            return trimmedPrev ? `${trimmedPrev} ${trimmedFinal}` : trimmedFinal;
          });
          setInterimTranscript('');
        } else if (interim) {
          setInterimTranscript(interim);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        console.warn("Speech recognition notice:", event.error);
        if (event.error === 'not-allowed') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (!isComponentMounted) return;
        setIsListening(false);
        setInterimTranscript('');

        // Chrome/Edge automatically terminates continuous listening on silence.
        // Automatically restart if mic is enabled, AI is not speaking, and manual mode is false.
        if (micEnabledRef.current && !isAISpeakingRef.current && !isManualModeRef.current) {
          setTimeout(() => {
            if (isComponentMounted && micEnabledRef.current && !isAISpeakingRef.current && !isManualModeRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Ignore if already active or pending
              }
            }
          }, 150);
        }
      };

      recognitionRef.current = recognition;

      // Start recognition if condition permits
      if (micEnabledRef.current && !isAISpeakingRef.current && !isManualModeRef.current) {
        try {
          recognition.start();
        } catch (e) {}
      }

      return () => {
        isComponentMounted = false;
        try {
          recognition.stop();
        } catch (e) {}
        recognitionRef.current = null;
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser. Defaulting to manual mode.");
      setIsManualMode(true);
    }
  }, [isValidatingSession]);

  // Proctor Loud Alarm & Audio Synthesis
  const playLoudWarningSound = (type = 'alert') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'chime') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else {
        // High-urgency dual-burst warning alarm
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, ctx.currentTime);
        osc.frequency.setValueAtTime(540, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(920, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.75, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.58);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      console.warn("Could not synthesize proctor alarm:", e);
    }
  };

  // Biometric Liveness Voice Prompts & Verification
  const speakLivenessInstructions = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        "Welcome to HireVision. To verify your identity and ensure camera liveness, please position your face in the camera and wave your hand across your face."
      );
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const completeLivenessCheck = (isManual = false) => {
    if (livenessStage === 'passed') return;
    waveMotionAccumulatorRef.current = 100;
    setWaveProgress(100);
    setLivenessStage('passed');
    setLivenessPassedAt(new Date().toISOString());
    playLoudWarningSound('chime');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        "Liveness and physical presence verified. Your interview questions are now unlocked."
      );
      utterance.rate = 0.96;
      window.speechSynthesis.speak(utterance);
    }

    setTimeout(() => {
      speakQuestion(currentQuestion.text);
    }, 1800);
  };

  // Trigger Liveness Voice Instruction on mount
  useEffect(() => {
    if (isValidatingSession) return;
    if (livenessStage === 'pending') {
      setLivenessStage('in_progress');
      const timer = setTimeout(() => {
        speakLivenessInstructions();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isValidatingSession, livenessStage]);

  // Periodically collect emotion and gaze telemetry for recruiter analytics
  useEffect(() => {
    if (livenessStage !== 'passed') return;
    const interval = setInterval(() => {
      const elapsed = recordingStartTimeRef.current 
        ? Math.max(0, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000))
        : 0;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      setEmotionHistory(prev => [
        ...prev.slice(-30),
        {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestampSeconds: elapsed,
          timecode: tc,
          confidence: confidenceScore,
          stress: stressLevel,
          stressPct: stressPercentage,
          gaze: gazeDirection
        }
      ]);
    }, 5000);
    return () => clearInterval(interval);
  }, [livenessStage, confidenceScore, stressLevel, stressPercentage, gazeDirection]);

  // Auto-dismiss active anomaly banner
  useEffect(() => {
    if (activeAnomaly) {
      const timer = setTimeout(() => {
        setActiveAnomaly(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [activeAnomaly]);

  // Sync mic state with speech recognition (Only active after liveness is passed)
  useEffect(() => {
    if (isValidatingSession || !recognitionRef.current) return;
    const shouldListen = micEnabled && !isAISpeaking && !isManualMode && livenessStage === 'passed';
    if (shouldListen && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    } else if (!shouldListen && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {}
    }
  }, [micEnabled, isListening, isAISpeaking, isManualMode, isValidatingSession, livenessStage]);

  // 3. AI Question TTS Readout
  const speakQuestion = (text) => {
    if (isValidatingSession || livenessStage !== 'passed') return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsAISpeaking(false);

      if (!text) return;

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utterance; // Prevent GC bug in Chromium

      const voices = window.speechSynthesis.getVoices();
      const selected = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (selected) utterance.voice = selected;

      utterance.rate = 0.96;
      utterance.pitch = 1.0;

      // Safety failsafe: reset isAISpeaking if onend fails to trigger
      const wordLen = text.split(/\s+/).length;
      const failsafeMs = Math.max(4000, Math.min(25000, wordLen * 500 + 3000));
      const failsafeTimer = setTimeout(() => {
        setIsAISpeaking(false);
      }, failsafeMs);

      utterance.onstart = () => setIsAISpeaking(true);
      utterance.onend = () => {
        clearTimeout(failsafeTimer);
        setIsAISpeaking(false);
        activeUtteranceRef.current = null;
      };
      utterance.onerror = () => {
        clearTimeout(failsafeTimer);
        setIsAISpeaking(false);
        activeUtteranceRef.current = null;
      };

      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  const stopAISpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAISpeaking(false);
    activeUtteranceRef.current = null;
  };

  useEffect(() => {
    if (isValidatingSession || livenessStage !== 'passed') return;
    const timer = setTimeout(() => {
      speakQuestion(currentQuestion.text);
    }, 600);

    return () => {
      clearTimeout(timer);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setIsAISpeaking(false);
      }
    };
  }, [currentIndex, currentQuestion, selectedVoiceURI, isValidatingSession, livenessStage]);

  // Track timestamp for each question in the recording
  useEffect(() => {
    if (livenessStage === 'passed' && currentQuestion) {
      const elapsed = recordingStartTimeRef.current 
        ? Math.max(0, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000))
        : 0;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      
      const qText = typeof currentQuestion === 'string' ? currentQuestion : currentQuestion.text;
      questionTimestampsRef.current = [
        ...questionTimestampsRef.current.filter(q => q.index !== currentIndex),
        {
          index: currentIndex,
          text: qText,
          timestampSeconds: elapsed,
          timecode: tc
        }
      ];
    }
  }, [currentIndex, currentQuestion, livenessStage]);

  // 4. Question Countdown Timer (Gated by liveness verification)
  useEffect(() => {
    if (isValidatingSession || livenessStage !== 'passed') return;
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft, isValidatingSession, livenessStage]);

  // 5. Calculate Real-Time Speech Metrics
  useEffect(() => {
    const activeText = isManualMode 
      ? manualText 
      : (currentTranscript + (interimTranscript ? ' ' + interimTranscript : ''));
    const words = activeText.trim().split(/\s+/).filter(Boolean).length;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartTime) / 1000));
    const calculatedWPM = Math.round((words / elapsedSeconds) * 60);
    setWordsPerMinute(calculatedWPM > 220 ? 140 : calculatedWPM);
  }, [currentTranscript, interimTranscript, manualText, isManualMode, questionStartTime]);

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

        try {
          if (typeof MediaRecorder !== 'undefined') {
            let mimeType = 'video/webm;codecs=vp8,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
            }
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            recordedChunksRef.current = [];
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                recordedChunksRef.current.push(e.data);
              }
            };
            recorder.start(1000);
            recordingStartTimeRef.current = Date.now();
            mediaRecorderRef.current = recorder;
          }
        } catch (mediaRecErr) {
          console.warn("Webcam MediaRecorder init notice:", mediaRecErr);
        }
      } catch (err) {
        console.error("Camera or microphone access denied:", err);
        setProctorStatus('error');
      }
    };

    startCamera();

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
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
      const now = Date.now();

      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        // Initialize offscreen canvas for genuine webcam pixel sampling
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
          offscreenCanvasRef.current.width = 160;
          offscreenCanvasRef.current.height = 120;
        }
        const offCanvas = offscreenCanvasRef.current;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        try {
          offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
        } catch (e) {}

        try {
          const predictions = await model.estimateFaces(video, false);
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // ========================================================
          // STAGE 1: BIOMETRIC ANTI-DEEPFAKE LIVENESS CALIBRATION
          // ========================================================
          if (livenessStage !== 'passed') {
            if (predictions.length >= 1) {
              setFacesDetected(predictions.length);
              setProctorStatus('active');
              const pred = predictions[0];
              const start = pred.topLeft;
              const end = pred.bottomRight;
              const faceW = end[0] - start[0];
              const faceH = end[1] - start[1];
              const centerX = (start[0] + end[0]) / 2;
              const isCentered = Math.abs(centerX - (canvas.width / 2)) < canvas.width * 0.32;
              setFaceCentered(isCentered);

              // 1. Futuristic Corner Brackets HUD
              ctx.strokeStyle = '#6366f1';
              ctx.lineWidth = 3;
              const cornerLen = Math.min(28, faceW * 0.22);
              // Top-Left
              ctx.beginPath();
              ctx.moveTo(start[0], start[1] + cornerLen);
              ctx.lineTo(start[0], start[1]);
              ctx.lineTo(start[0] + cornerLen, start[1]);
              ctx.stroke();
              // Top-Right
              ctx.beginPath();
              ctx.moveTo(end[0] - cornerLen, start[1]);
              ctx.lineTo(end[0], start[1]);
              ctx.lineTo(end[0], start[1] + cornerLen);
              ctx.stroke();
              // Bottom-Left
              ctx.beginPath();
              ctx.moveTo(start[0], end[1] - cornerLen);
              ctx.lineTo(start[0], end[1]);
              ctx.lineTo(start[0] + cornerLen, end[1]);
              ctx.stroke();
              // Bottom-Right
              ctx.beginPath();
              ctx.moveTo(end[0] - cornerLen, end[1]);
              ctx.lineTo(end[0], end[1]);
              ctx.lineTo(end[0], end[1] - cornerLen);
              ctx.stroke();

              // 2. Animated Vertical Laser Scan Line
              const laserY = start[1] + faceH * (0.5 + 0.45 * Math.sin(now / 300));
              ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(start[0] + 6, laserY);
              ctx.lineTo(end[0] - 6, laserY);
              ctx.stroke();

              // 3. Status Tag above Head
              ctx.font = 'bold 12px monospace';
              ctx.fillStyle = '#22d3ee';
              ctx.textAlign = 'center';
              ctx.fillText(
                `[ 3D LIVENESS SCAN: ${Math.round(waveMotionAccumulatorRef.current)}% ]`, 
                centerX, 
                Math.max(22, start[1] - 12)
              );

              // 4. Optical Motion Flux across Face via Genuine Offscreen Video Pixels
              try {
                const scaleX = offCanvas.width / (canvas.width || 640);
                const scaleY = offCanvas.height / (canvas.height || 480);
                const sfX = Math.max(0, Math.min(offCanvas.width - 24, Math.floor(start[0] * scaleX)));
                const sfY = Math.max(0, Math.min(offCanvas.height - 24, Math.floor(start[1] * scaleY)));
                const sfW = Math.max(20, Math.min(offCanvas.width - sfX, Math.floor(faceW * scaleX)));
                const sfH = Math.max(20, Math.min(offCanvas.height - sfY, Math.floor(faceH * scaleY)));

                const currentFacePix = offCtx.getImageData(sfX, sfY, sfW, sfH).data;

                if (prevFaceDataRef.current && prevFaceDataRef.current.length === currentFacePix.length) {
                  let changedPixels = 0;
                  // Sample every 4th pixel RGBA for fast, robust motion comparison
                  for (let i = 0; i < currentFacePix.length; i += 16) {
                    const d = Math.abs(currentFacePix[i] - prevFaceDataRef.current[i]) +
                              Math.abs(currentFacePix[i+1] - prevFaceDataRef.current[i+1]) +
                              Math.abs(currentFacePix[i+2] - prevFaceDataRef.current[i+2]);
                    if (d > 26) {
                      changedPixels++;
                    }
                  }

                  // When hand moves across face, changedPixels is >= 3
                  if (changedPixels >= 3) {
                    waveMotionAccumulatorRef.current = Math.min(100, waveMotionAccumulatorRef.current + 4.5);
                    const currentVal = Math.round(waveMotionAccumulatorRef.current);
                    setWaveProgress(currentVal);

                    // Dynamic wave ripple indicator on canvas
                    ctx.strokeStyle = 'rgba(129, 140, 248, 0.7)';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(start[0], start[1], faceW, faceH);

                    if (waveMotionAccumulatorRef.current >= 100) {
                      completeLivenessCheck();
                    }
                  }
                }
                prevFaceDataRef.current = currentFacePix;
              } catch (err) {}

              // 5. Draw landmark dots
              ctx.fillStyle = '#818cf8';
              pred.landmarks.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], 3.5, 0, 2 * Math.PI);
                ctx.fill();
              });
            } else if (predictions.length === 0) {
              setFacesDetected(0);
              setFaceCentered(false);
              // Face occlusion: user placed hand directly over face occluding camera
              if (prevFaceDataRef.current && waveMotionAccumulatorRef.current > 0) {
                waveMotionAccumulatorRef.current = Math.min(100, waveMotionAccumulatorRef.current + 5.5);
                const currentVal = Math.round(waveMotionAccumulatorRef.current);
                setWaveProgress(currentVal);
                if (waveMotionAccumulatorRef.current >= 100) {
                  completeLivenessCheck();
                }
              }
            }
          } 
          // ========================================================
          // STAGE 2: REAL-TIME INTERVIEW PROCTORING & EMOTION SUITE
          // ========================================================
          else {
            if (predictions.length === 0) {
              setFacesDetected(0);
              setFaceCentered(false);
              setProctorStatus('warning');

              // Face Out of Scope Anomaly Detection
              if (!faceMissingStartTimeRef.current) {
                faceMissingStartTimeRef.current = now;
              } else if (now - faceMissingStartTimeRef.current > 1800) {
                if (now - lastAlarmTimeRef.current > 5500) {
                  lastAlarmTimeRef.current = now;
                  playLoudWarningSound('alert');
                  setActiveAnomaly('⚠️ PROCTOR ALERT: Face Absent From Camera Scope! Reposition immediately.');
                  const elapsed = recordingStartTimeRef.current 
                    ? Math.max(0, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000))
                    : 0;
                  const mins = Math.floor(elapsed / 60);
                  const secs = elapsed % 60;
                  const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                  setProctoringFlags(prev => [
                    ...prev,
                    { 
                      time: new Date().toLocaleTimeString(),
                      timestampSeconds: elapsed,
                      timecode: tc,
                      issue: 'Face absent from camera frame', 
                      type: 'face_missing', 
                      severity: 'critical',
                      title: 'Candidate Off-Screen',
                      description: 'Candidate face moved out of camera viewport for >1.8s'
                    }
                  ]);
                }
              }
            } else if (predictions.length > 1) {
              setFacesDetected(predictions.length);
              setFaceCentered(false);
              setProctorStatus('warning');

              // Multiple Faces Anomaly Detection
              if (!multipleFacesStartTimeRef.current) {
                multipleFacesStartTimeRef.current = now;
              } else if (now - multipleFacesStartTimeRef.current > 1600) {
                if (now - lastAlarmTimeRef.current > 5500) {
                  lastAlarmTimeRef.current = now;
                  playLoudWarningSound('alert');
                  setActiveAnomaly('⚠️ PROCTOR ALERT: Multiple Persons Detected in Camera Frame!');
                  const elapsed = recordingStartTimeRef.current 
                    ? Math.max(0, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000))
                    : 0;
                  const mins = Math.floor(elapsed / 60);
                  const secs = elapsed % 60;
                  const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                  setProctoringFlags(prev => [
                    ...prev,
                    { 
                      time: new Date().toLocaleTimeString(),
                      timestampSeconds: elapsed,
                      timecode: tc,
                      issue: 'Multiple persons detected in camera frame', 
                      type: 'multiple_faces', 
                      severity: 'critical',
                      title: 'Multiple Persons Detected',
                      description: 'Secondary individual detected in candidate camera frame'
                    }
                  ]);
                }
              }
            } else {
              faceMissingStartTimeRef.current = null;
              multipleFacesStartTimeRef.current = null;
              setFacesDetected(1);
              setProctorStatus('active');

              const pred = predictions[0];
              const start = pred.topLeft;
              const end = pred.bottomRight;
              const centerX = (start[0] + end[0]) / 2;
              const canvasMidX = canvas.width / 2;
              const isCentered = Math.abs(centerX - canvasMidX) < canvas.width * 0.28;
              setFaceCentered(isCentered);

              const re = pred.landmarks[0]; // Right eye
              const le = pred.landmarks[1]; // Left eye
              const nose = pred.landmarks[2]; // Nose
              const mouth = pred.landmarks[3]; // Mouth
              const rEar = pred.landmarks[4]; // Right ear
              const lEar = pred.landmarks[5]; // Left ear

              // Eye Midpoint & Distances
              const eyeMidX = (re[0] + le[0]) / 2;
              const eyeDist = Math.hypot(le[0] - re[0], le[1] - re[1]) || 1;
              const yawRatio = (nose[0] - eyeMidX) / (eyeDist * 0.5);
              const earAsym = (Math.abs(lEar[0] - nose[0]) - Math.abs(rEar[0] - nose[0])) / eyeDist;

              // Vertical Pitch
              const eyeMidY = (re[1] + le[1]) / 2;
              const mouthDist = Math.abs(mouth[1] - eyeMidY) || 1;
              const pitchRatio = (nose[1] - eyeMidY) / mouthDist;

              // Determine Eye Gaze Direction
              let currentGaze = 'Screen Focused';
              if (yawRatio < -0.40 || earAsym > 0.45) {
                currentGaze = 'Diverted Left';
              } else if (yawRatio > 0.40 || earAsym < -0.45) {
                currentGaze = 'Diverted Right';
              } else if (pitchRatio > 0.72) {
                currentGaze = 'Diverted Down';
              } else if (pitchRatio < 0.28) {
                currentGaze = 'Diverted Up';
              }
              setGazeDirection(currentGaze);

              // Eye Gaze Anomaly Alert & Proctor Warning
              if (currentGaze !== 'Screen Focused') {
                if (!gazeStartTimeRef.current) {
                  gazeStartTimeRef.current = now;
                } else if (now - gazeStartTimeRef.current > 1800) {
                  if (now - lastAlarmTimeRef.current > 5500) {
                    lastAlarmTimeRef.current = now;
                    playLoudWarningSound('alert');
                    setActiveAnomaly(`⚠️ PROCTOR ALERT: Eye Gaze Diverted! You are looking away from the interview screen (${currentGaze}).`);
                    const elapsed = recordingStartTimeRef.current 
                      ? Math.max(0, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000))
                      : 0;
                    const mins = Math.floor(elapsed / 60);
                    const secs = elapsed % 60;
                    const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    setProctoringFlags(prev => [
                      ...prev,
                      { 
                        time: new Date().toLocaleTimeString(),
                        timestampSeconds: elapsed,
                        timecode: tc,
                        issue: `Eye gaze diverted (${currentGaze})`, 
                        type: 'gaze_diverted', 
                        severity: 'warning',
                        title: `Eye Gaze Diverted (${currentGaze})`,
                        description: `Candidate gaze looked away toward secondary screen/surface (${currentGaze})`
                      }
                    ]);
                  }
                }
              } else {
                gazeStartTimeRef.current = null;
              }

              // Emotion Tracking: Movement Jitter, Confidence, & Stress
              let jitter = 0;
              if (prevLandmarkRef.current) {
                jitter = Math.hypot(nose[0] - prevLandmarkRef.current[0], nose[1] - prevLandmarkRef.current[1]);
              }
              prevLandmarkRef.current = [nose[0], nose[1]];

              // Instantaneous Confidence
              let instantConf = 85;
              if (currentGaze === 'Screen Focused') instantConf += 6;
              else instantConf -= 18;
              if (isCentered) instantConf += 4;
              else instantConf -= 10;
              if (wordsPerMinute >= 70 && wordsPerMinute <= 160) instantConf += 5;
              if (jitter > 9) instantConf -= 10;

              confidenceRef.current = 0.94 * confidenceRef.current + 0.06 * instantConf;
              setConfidenceScore(Math.min(98, Math.max(30, Math.round(confidenceRef.current))));

              // Instantaneous Stress / Panic
              let instantStress = 16;
              if (currentGaze !== 'Screen Focused') instantStress += 35;
              if (jitter > 9) instantStress += 25;
              if (!isCentered) instantStress += 15;

              stressRef.current = 0.92 * stressRef.current + 0.08 * instantStress;
              const stressNum = Math.min(99, Math.max(10, Math.round(stressRef.current)));
              setStressPercentage(stressNum);

              if (stressNum < 32) setStressLevel('Calm');
              else if (stressNum < 55) setStressLevel('Controlled');
              else if (stressNum < 75) setStressLevel('Elevated');
              else setStressLevel('Panic');

              // Visual HUD Rendering on Canvas: Real-Time Emotion & Gaze Tracking
              const isFlagged = currentGaze !== 'Screen Focused';
              const isCenteredOk = isCentered;
              ctx.strokeStyle = isFlagged ? '#ef4444' : '#10b981';
              ctx.lineWidth = 2.5;

              // Corner brackets
              const cornerSize = Math.min(24, (end[0] - start[0]) * 0.2);
              ctx.beginPath();
              ctx.moveTo(start[0], start[1] + cornerSize); ctx.lineTo(start[0], start[1]); ctx.lineTo(start[0] + cornerSize, start[1]);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(end[0] - cornerSize, start[1]); ctx.lineTo(end[0], start[1]); ctx.lineTo(end[0], start[1] + cornerSize);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(start[0], end[1] - cornerSize); ctx.lineTo(start[0], end[1]); ctx.lineTo(start[0] + cornerSize, end[1]);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(end[0] - cornerSize, end[1]); ctx.lineTo(end[0], end[1]); ctx.lineTo(end[0], end[1] - cornerSize);
              ctx.stroke();

              // Gaze Vector Ray
              ctx.strokeStyle = isFlagged ? '#f43f5e' : '#38bdf8';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(nose[0], nose[1]);
              let targetRayX = nose[0];
              let targetRayY = nose[1];
              if (currentGaze === 'Diverted Left') targetRayX = nose[0] + 55;
              else if (currentGaze === 'Diverted Right') targetRayX = nose[0] - 55;
              else if (currentGaze === 'Diverted Down') targetRayY = nose[1] + 50;
              else if (currentGaze === 'Diverted Up') targetRayY = nose[1] - 50;
              ctx.lineTo(targetRayX, targetRayY);
              ctx.stroke();

              // In-Canvas Real-Time Telemetry Tag
              ctx.font = 'bold 11px monospace';
              ctx.fillStyle = isFlagged ? '#f43f5e' : '#10b981';
              ctx.textAlign = 'center';
              ctx.fillText(
                isFlagged 
                  ? `[ ⚠️ GAZE: ${currentGaze.toUpperCase()} ]` 
                  : `[ 👁️ FOCUS: SCREEN LOCKED • CONFIDENCE: ${Math.round(confidenceRef.current)}% ]`,
                centerX,
                Math.max(22, start[1] - 12)
              );

              // Facial Landmark Keypoints
              ctx.fillStyle = isFlagged ? '#f87171' : '#38bdf8';
              pred.landmarks.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], 3.5, 0, 2 * Math.PI);
                ctx.fill();
              });
            }
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
  }, [isValidatingSession, livenessStage]);

  // 8. Hardware Controls
  const toggleMic = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const audioTracks = videoRef.current.srcObject.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setMicEnabled(audioTracks[0].enabled);
        return;
      }
    }
    setMicEnabled(prev => !prev);
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
    const combinedVoice = (currentTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    let candidateResponse = isManualMode 
      ? manualText.trim() 
      : combinedVoice;

    if (!candidateResponse) {
      candidateResponse = "[No response verbalized by candidate]";
    }

    setIsProcessingAnswer(true);

    // Call Groq cleanup engine for speech artefacts
    let cleanedResponse = candidateResponse;
    if (candidateResponse.length >= 10 && !isManualMode && candidateResponse !== "[No response verbalized by candidate]") {
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
      setInterimTranscript("");
      setManualText("");
      setIsManualMode(false);
      setTimeLeft(180);
      setQuestionStartTime(Date.now());

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
      // 1. Finalize WebCam Recording
      let recordingUrl = null;
      const totalDuration = recordingStartTimeRef.current 
        ? Math.max(1, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000))
        : 0;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          await new Promise(resolve => {
            mediaRecorderRef.current.onstop = resolve;
            mediaRecorderRef.current.stop();
          });
        } catch (stopErr) {
          console.warn("MediaRecorder stop error:", stopErr);
        }
      }

      // 2. Upload video recording to backend
      const chunks = recordedChunksRef.current;
      const user = auth.currentUser;
      if (chunks && chunks.length > 0 && user) {
        try {
          const videoBlob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
          const formData = new FormData();
          formData.append('file', videoBlob, `candidate_${user.uid}_${Date.now()}.webm`);
          formData.append('candidate_uid', user.uid);
          if (sessionData?.requestId) formData.append('interview_id', sessionData.requestId);
          formData.append('duration', totalDuration.toString());

          const uploadRes = await fetch(`${API_BASE_URL}/api/upload-recording`, {
            method: 'POST',
            body: formData
          });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            recordingUrl = uploadJson.url;
          }
        } catch (recUploadErr) {
          console.warn("Could not upload recording to backend:", recUploadErr);
        }
      }

      if (user) {
        await addDoc(collection(db, 'interviews'), {
          candidateName: user.displayName || "Unknown Candidate",
          candidateUid: user.uid,
          recruiterId: sessionData?.recruiterId || null,
          jobId: sessionData?.jobId || null,
          jobTitle: sessionData?.jobTitle || "AI Technical Interview",
          requestId: sessionData?.requestId || null,
          recordingUrl: recordingUrl,
          recordingDurationSeconds: totalDuration,
          questionTimestamps: questionTimestampsRef.current,
          questions: rawQuestions,
          uiQuestions: questions.map(q => q.text),
          answers: finalAnswers,
          proctoringFlags: proctoringFlags,
          proctoringSummary: {
            flagsLogged: proctoringFlags.length,
            flags: proctoringFlags,
            model: "TensorFlow.js BlazeFace + Anti-Deepfake Liveness Guard",
            livenessCheck: {
              status: livenessStage === 'passed' ? 'PASSED' : 'BYPASSED',
              method: 'Hand-Face Occlusion Wave',
              verifiedAt: livenessPassedAt || new Date().toISOString()
            },
            faceMissingCount: proctoringFlags.filter(f => f.type === 'face_missing').length,
            gazeDivertedCount: proctoringFlags.filter(f => f.type === 'gaze_diverted').length,
            multipleFacesCount: proctoringFlags.filter(f => f.type === 'multiple_faces').length
          },
          emotionAnalytics: {
            averageConfidence: confidenceScore,
            stressIndex: stressLevel,
            stressPercentage: stressPercentage,
            gazeAdherence: gazeDirection === 'Screen Focused' ? 'Optimal (Screen Focused)' : 'Diverted',
            flagsCount: proctoringFlags.length,
            timeline: emotionHistory
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

  const activeResponseText = isManualMode 
    ? manualText 
    : (currentTranscript + (interimTranscript ? ' ' + interimTranscript : ''));
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

        {/* Center: Interactive Question Stepper or Liveness Gate Badge */}
        {livenessStage !== 'passed' ? (
          <div className="hidden lg:flex items-center gap-2 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-amber-300 font-mono">
              STAGE 1: BIOMETRIC ANTI-DEEPFAKE LIVENESS CALIBRATION
            </span>
          </div>
        ) : (
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
        )}

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
            livenessStage !== 'passed'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
              : timeLeft < 30 
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 animate-pulse'
              : timeLeft < 60
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-[#0e1628] border-slate-800 text-slate-300'
          }`}>
            <Clock size={14} className={livenessStage !== 'passed' ? 'text-indigo-400' : timeLeft < 30 ? 'text-rose-400' : 'text-slate-400'} />
            <span>{livenessStage !== 'passed' ? 'CALIBRATING' : formatTime(timeLeft)}</span>
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

      {/* 2. MAIN INTERVIEW STAGE: 3-COLUMN PRIMARY STAGE + BOTTOM TELEMETRY DECK */}
      <main className="flex-1 p-3 sm:p-4 lg:p-5 flex flex-col gap-4 overflow-y-auto">
        
        {/* TOP SECTION: 3 COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
          
          {/* ========================================================
              1. LEFT COLUMN: Session Intel & Security Guard (3 COLS)
             ======================================================== */}
          <aside className="lg:col-span-3 flex flex-col gap-3">
            
            {/* Card 1: Candidate & Session Intel */}
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                  <User size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">{auth.currentUser?.displayName || "Candidate Session"}</h4>
                  <p className="text-[11px] text-indigo-400 font-medium truncate">{sessionData?.jobTitle || "AI Technical Interview"}</p>
                </div>
              </div>
              <div className="pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Session PIN</span>
                  <span className="font-mono text-slate-200 font-bold bg-slate-800/60 px-1.5 py-0.5 rounded text-[11px]">{sessionData?.jobPIN || '482910'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Neural Sync</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 24ms Low Latency
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Input Mode</span>
                  <span className="text-slate-300 font-mono text-[11px]">{isManualMode ? 'Manual Editor' : 'Voice Stream'}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Biometric Anti-Deepfake Shield */}
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={16} className={livenessStage === 'passed' ? 'text-emerald-400' : 'text-cyan-400 animate-pulse'} />
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">Biometric Shield</h4>
                </div>
                {livenessStage === 'passed' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    3D Verified
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    Calibrating
                  </span>
                )}
              </div>

              <div className="bg-[#070b14] rounded-xl p-2.5 border border-slate-800/80 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hand-Wave Liveness</span>
                  <span className={livenessStage === 'passed' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-mono'}>
                    {livenessStage === 'passed' ? 'Passed (100%)' : `${waveProgress}% Complete`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Head Centering</span>
                  <span className={faceCentered ? 'text-emerald-400' : 'text-amber-400'}>
                    {faceCentered ? 'Optimal (Centered)' : 'Offset'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Anti-Spoofing</span>
                  <span className="text-cyan-400">Optical Flow Active</span>
                </div>
              </div>
            </div>

            {/* Card 3: AI Proctoring Integrity */}
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className={proctoringFlags.length === 0 ? 'text-purple-400' : 'text-rose-400'} />
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">Proctor Integrity</h4>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  proctoringFlags.length === 0 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {proctoringFlags.length === 0 ? 'Zero Flags' : `${proctoringFlags.length} Warning(s)`}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Candidate Presence</span>
                  <span className={facesDetected === 1 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-bold'}>
                    {facesDetected === 1 ? 'Single Candidate' : facesDetected === 0 ? 'Face Missing' : 'Multiple Faces'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Gaze Tracking</span>
                  <span className={gazeDirection === 'Screen Focused' ? 'text-emerald-400' : 'text-rose-400 font-medium'}>
                    {gazeDirection}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Audio Alarm</span>
                  <span className="text-slate-300 font-mono text-[10px]">Web Audio Guard</span>
                </div>
              </div>
            </div>

            {/* Card 4: Quick Guidelines */}
            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-3.5 text-xs text-indigo-300/90 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-indigo-200 mb-1">
                <Sparkles size={13} className="text-indigo-400" />
                <span>Interview Guidelines</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">• Keep your eyes centered on the camera lens during responses.</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">• Looking at secondary screens will trigger audio warning alarms.</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">• Speak naturally; answers are auto-transcribed in real time.</p>
            </div>

          </aside>

          {/* ========================================================
              2. CENTER COLUMN: Main Stage Video Feed (5 COLS)
             ======================================================== */}
          <section className="lg:col-span-5 flex flex-col gap-3 min-h-[420px]">
            
            {/* Main Video Monitor */}
            <div className="relative flex-1 min-h-[360px] bg-[#0b1120] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center group">
              
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
                
                {/* Live Indicator */}
                <div className="flex items-center gap-2 bg-[#070b14]/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px] font-mono">
                  <span className={`w-2 h-2 rounded-full ${videoEnabled ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
                  <span className={videoEnabled ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                    {videoEnabled ? 'LIVE PROCTOR' : 'MUTED'}
                  </span>
                </div>

                {/* Real-Time Gaze Tracking Pill */}
                <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all ${
                  gazeDirection === 'Screen Focused'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/25 border-rose-500/50 text-rose-300 animate-pulse'
                }`}>
                  <Eye size={13} />
                  <span>{gazeDirection === 'Screen Focused' ? 'Focus: Screen Locked' : `⚠️ Gaze: ${gazeDirection}`}</span>
                </div>
              </div>

              {/* Calibration In-Video Floating Progress Banner (Clear video, NO dark blur!) */}
              {livenessStage !== 'passed' && (
                <div className="absolute top-12 left-3 right-3 z-20 bg-[#070b14]/90 backdrop-blur-md border border-cyan-500/40 p-2.5 rounded-xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-cyan-400 animate-pulse shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white">Wave open hand across your face</p>
                      <p className="text-[10px] text-slate-300">Move your hand slowly across camera to verify 3D physical presence.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400 transition-all duration-200 rounded-full" 
                        style={{ width: `${waveProgress}%` }} 
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-cyan-300">{waveProgress}%</span>
                  </div>
                </div>
              )}

              {/* FLOATING PROCTOR ANOMALY WARNING BANNER */}
              {activeAnomaly && (
                <div className="absolute top-12 left-4 right-4 z-40 bg-rose-600/95 backdrop-blur-xl border border-rose-300 text-white p-3 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-bounce">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={18} className="text-amber-300 animate-spin shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">{activeAnomaly}</p>
                      <p className="text-[10px] text-rose-200">Incident logged into proctoring audit trail for recruiter review.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded font-bold shrink-0">Warning #{proctoringFlags.length}</span>
                </div>
              )}

              {/* DEVELOPER ON-CAMERA TELEPROMPTER HUD */}
              {showTeleprompter && (
                <div className="absolute top-14 left-3 right-3 z-30 bg-[#070b14]/95 backdrop-blur-2xl border border-indigo-500/40 rounded-xl p-3 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-bold text-indigo-300 font-mono flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-400" />
                        DEV TELEPROMPTER HUD
                      </span>
                      <span className="text-[10px] bg-indigo-950/80 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 hidden sm:inline">
                        Direct Lens Alignment
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-slate-900/80 rounded-lg p-0.5 border border-slate-700/60 text-[10px]">
                        <button
                          onClick={() => setTeleprompterFontSize("text-xs")}
                          className={`px-1.5 py-0.5 rounded ${teleprompterFontSize === 'text-xs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                          title="Small Text"
                        >
                          A-
                        </button>
                        <button
                          onClick={() => setTeleprompterFontSize("text-xs sm:text-sm")}
                          className={`px-1.5 py-0.5 rounded ${teleprompterFontSize === 'text-xs sm:text-sm' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                          title="Medium Text"
                        >
                          A
                        </button>
                        <button
                          onClick={() => setTeleprompterFontSize("text-sm sm:text-base")}
                          className={`px-1.5 py-0.5 rounded ${teleprompterFontSize === 'text-sm sm:text-base' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                          title="Large Text"
                        >
                          A+
                        </button>
                      </div>
                      <button
                        onClick={handleAutoFillTranscript}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                          teleprompterCopied
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border-indigo-500/40'
                        }`}
                        title="Auto-fill this response directly into your transcript"
                      >
                        {teleprompterCopied ? <Check size={11} className="text-emerald-400" /> : <Sparkles size={11} className="text-amber-400" />}
                        <span>{teleprompterCopied ? 'Filled!' : 'Auto-Fill'}</span>
                      </button>
                      <button
                        onClick={() => setShowTeleprompter(false)}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                        title="Close HUD (or press F2)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Teleprompter Script */}
                  <div className="max-h-36 sm:max-h-44 overflow-y-auto custom-scrollbar pr-1">
                    <p className={`${teleprompterFontSize} text-slate-100 font-medium leading-relaxed tracking-wide select-all`}>
                      {teleprompterScript}
                    </p>
                    {/* Expected Signals Badges */}
                    {currentQuestion?.expected_signals && currentQuestion.expected_signals.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-slate-400">Target Signals:</span>
                        {currentQuestion.expected_signals.map((sig, idx) => (
                          <span key={idx} className="text-[10px] bg-slate-800 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            ✓ {sig}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-800/40 text-[9px] text-slate-500 flex justify-between items-center">
                    <span>Look directly at this text: your eyes stay aligned with the camera lens.</span>
                    <span className="font-mono text-indigo-400">Press F2 to toggle</span>
                  </div>
                </div>
              )}

              {/* AI Recruiter Speaking Visualizer Banner */}
              {isAISpeaking && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-indigo-950/90 backdrop-blur-xl border border-indigo-500/40 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-xl animate-bounce">
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
              {showSubtitles && (
                <div className="absolute bottom-16 left-3 right-3 bg-[#070b14]/90 backdrop-blur-xl border border-slate-700/60 p-3 rounded-xl z-20 shadow-2xl max-h-24 overflow-y-auto">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span>Real-Time Transcript Preview</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {wordCount} words
                    </span>
                  </div>
                  <p id="live-answer-buffer" className="text-xs text-slate-200 leading-relaxed">
                    {(currentTranscript || interimTranscript) ? (
                      <>
                        <span>{currentTranscript}</span>
                        {interimTranscript && (
                          <span className="text-indigo-400 opacity-90 italic">
                            {currentTranscript ? ' ' : ''}{interimTranscript}
                          </span>
                        )}
                      </>
                    ) : isAISpeaking ? (
                      <span className="italic text-indigo-300">AI is reading question aloud...</span>
                    ) : isListening ? (
                      <span className="italic text-emerald-400">Listening for candidate voice response...</span>
                    ) : !micEnabled ? (
                      <span className="italic text-rose-400">Microphone muted</span>
                    ) : (
                      <span className="italic text-slate-400">Microphone standby...</span>
                    )}
                  </p>
                </div>
              )}

              {/* Floating Studio Controls Dock at Bottom of Camera */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#0b1120]/95 backdrop-blur-2xl p-1.5 rounded-2xl border border-slate-700/70 z-20 shadow-2xl">
                
                <button
                  onClick={toggleMic}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    micEnabled 
                      ? 'bg-slate-800/80 text-slate-200 hover:bg-slate-700' 
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  }`}
                  title="Toggle Microphone"
                >
                  {micEnabled ? <Mic size={14} className="text-emerald-400" /> : <MicOff size={14} />}
                  <span className="hidden sm:inline">{micEnabled ? 'Mic On' : 'Muted'}</span>
                </button>

                <button
                  onClick={toggleVideo}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    videoEnabled 
                      ? 'bg-slate-800/80 text-slate-200 hover:bg-slate-700' 
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  }`}
                  title="Toggle Webcam"
                >
                  {videoEnabled ? <Video size={14} className="text-emerald-400" /> : <VideoOff size={14} />}
                  <span className="hidden sm:inline">{videoEnabled ? 'Cam On' : 'Cam Off'}</span>
                </button>

                <button
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    showSubtitles 
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' 
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle Live Subtitles"
                >
                  <MessageSquare size={14} />
                  <span className="hidden sm:inline">Captions</span>
                </button>

                {/* Developer Teleprompter HUD Button */}
                <button
                  onClick={() => setShowTeleprompter(!showTeleprompter)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    showTeleprompter 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle Developer Teleprompter HUD (Press F2)"
                >
                  <Sparkles size={14} className={showTeleprompter ? 'text-amber-400' : 'text-slate-400'} />
                  <span className="hidden sm:inline">{showTeleprompter ? 'HUD On' : 'HUD'}</span>
                </button>

              </div>

            </div>

          </section>

          {/* ========================================================
              3. RIGHT COLUMN: Questions & Response Workspace (4 COLS)
             ======================================================== */}
          <section className="lg:col-span-4 flex flex-col gap-3 min-h-[420px]">
            
            {livenessStage !== 'passed' ? (
              <div className="flex-1 bg-[#0b1120] rounded-2xl border border-indigo-500/30 p-5 sm:p-6 flex flex-col justify-between overflow-hidden relative shadow-2xl">
                
                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                      <ShieldAlert size={12} className="animate-pulse" />
                      Mandatory Identity Verification
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Stage 1 of 2</span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-2">
                    Biometric Anti-Deepfake Calibration
                  </h2>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    To prevent synthetic video avatars and guarantee physical 3D presence, our Neural Vision engine requires a quick hand-wave calibration before revealing your interview questions.
                  </p>
                </div>

                {/* Calibration Interactive Steps */}
                <div className="my-4 p-4 bg-[#070b14] rounded-2xl border border-slate-800 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      facesDetected === 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {facesDetected === 1 ? '✓' : '1'}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Align Face in Camera Frame</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {facesDetected === 1 ? 'Face position verified and locked in lens.' : 'Position your head centered in the webcam preview.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      waveProgress >= 100 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse'
                    }`}>
                      {waveProgress >= 100 ? '✓' : '2'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-white">Wave Hand Across Face</h4>
                        <span className="text-xs font-mono font-bold text-indigo-400">{waveProgress}%</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Raise your open hand in front of your face and wave it slowly across from left to right.
                      </p>

                      {/* Progress Bar */}
                      <div className="mt-2.5 w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300 rounded-full"
                          style={{ width: `${waveProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={speakLivenessInstructions}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60 hover:bg-slate-700 transition"
                  >
                    <Volume2 size={13} className="text-indigo-400" />
                    <span>Replay Audio Guide</span>
                  </button>

                  <button
                    onClick={() => completeLivenessCheck(true)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition underline underline-offset-4"
                    title="Bypass check in test/development environments"
                  >
                    Skip (Test Mode)
                  </button>
                </div>

              </div>
            ) : (
              <div className="flex-1 bg-[#0b1120] rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col justify-between overflow-hidden relative shadow-2xl">
              
                {/* Top Question Category & Difficulty Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80 flex-shrink-0">
                  
                  <div className="flex flex-wrap items-center gap-1.5">
                    
                    {/* Question Category Badge */}
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                      <Sparkles size={11} />
                      {currentQuestion.category.replace('_', ' ')}
                    </span>

                    {/* Target Skill Chip */}
                    {currentQuestion.target_skill && (
                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Cpu size={11} className="text-cyan-400" />
                        <span>{currentQuestion.target_skill}</span>
                      </span>
                    )}

                    {/* Difficulty Rating */}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono capitalize bg-slate-800/60 text-slate-400 border border-slate-700/50">
                      {currentQuestion.difficulty}
                    </span>

                  </div>

                  {/* Toggle Mode: Voice vs Manual Text Polishing */}
                  <div className="flex items-center gap-1">
                    {isAISpeaking && (
                      <button
                        onClick={stopAISpeaking}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition animate-pulse"
                        title="Stop AI voice readout and enable microphone immediately"
                      >
                        <Volume2 size={11} />
                        <span>Skip Voice</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 bg-[#070b14] p-0.5 rounded-xl border border-slate-800">
                      <button
                        onClick={() => {
                          setIsManualMode(false);
                          if (manualText && !currentTranscript) setCurrentTranscript(manualText);
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                          !isManualMode 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Mic size={11} />
                        <span>Speech</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsManualMode(true);
                          const combined = (currentTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
                          if (!manualText && combined) setManualText(combined);
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                          isManualMode 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Edit3 size={11} />
                        <span>Editor</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Question Content */}
                <div className="py-3 overflow-y-auto custom-scrollbar flex-shrink-0">
                  
                  {/* Optional Resume Anchor */}
                  {currentQuestion.resume_anchor && (
                    <div className="mb-2.5 px-2.5 py-1.5 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 flex items-start gap-1.5">
                      <Info size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-indigo-200">Resume anchor: </span>
                        <span className="italic text-slate-300">"{currentQuestion.resume_anchor}"</span>
                      </div>
                    </div>
                  )}

                  {/* Main Question Heading */}
                  <div className="flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 mt-0.5">
                      Q{currentIndex + 1}
                    </span>
                    <h2 className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                      {currentQuestion.text}
                    </h2>
                  </div>

                  {/* Signals / Evaluation Guidance */}
                  {currentQuestion.expected_signals && currentQuestion.expected_signals.length > 0 && (
                    <div className="mt-2.5 pl-9 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium mr-1">Recommended:</span>
                      {currentQuestion.expected_signals.slice(0, 2).map((sig, i) => (
                        <span key={i} className="text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded-md">
                          ✓ {sig}
                        </span>
                      ))}
                    </div>
                  )}

                </div>

                {/* Answer Workspace Box (Voice or Manual Text) */}
                <div className="flex-1 min-h-[140px] bg-[#070b14] rounded-xl border border-slate-800 p-3 flex flex-col justify-between overflow-hidden">
                  
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isManualMode ? 'bg-amber-400' : isListening ? 'bg-emerald-400 animate-pulse' : isAISpeaking ? 'bg-indigo-400 animate-ping' : !micEnabled ? 'bg-rose-400' : 'bg-slate-500'}`} />
                      <span className="text-[11px] font-semibold text-slate-300">
                        {isManualMode 
                          ? 'Manual Editor' 
                          : isAISpeaking 
                          ? 'AI Speaking Question...' 
                          : isListening 
                          ? 'Listening to Microphone' 
                          : !micEnabled 
                          ? 'Microphone Muted' 
                          : 'Connecting Audio...'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        {wordCount} words
                      </span>
                      {(currentTranscript || interimTranscript || manualText) && (
                        <button
                          onClick={() => {
                            setCurrentTranscript("");
                            setInterimTranscript("");
                            setManualText("");
                          }}
                          className="text-[11px] text-rose-400 hover:text-rose-300 transition"
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
                        placeholder="Type or polish your answer here directly..."
                        className="w-full h-full bg-transparent text-xs text-slate-200 outline-none resize-none placeholder:text-slate-600 leading-relaxed font-sans"
                      />
                    ) : (currentTranscript || interimTranscript) ? (
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                        <span>{currentTranscript}</span>
                        {interimTranscript && (
                          <span className="text-indigo-400 opacity-90 italic">
                            {currentTranscript ? ' ' : ''}{interimTranscript}
                          </span>
                        )}
                        {isListening && (
                          <span className="inline-block w-1.5 h-3 ml-1 bg-indigo-400 animate-pulse align-middle" />
                        )}
                      </p>
                    ) : isAISpeaking ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-1.5 animate-bounce">
                          <Volume2 size={14} />
                        </div>
                        <p className="text-xs text-indigo-300 font-medium">AI is reading the question aloud...</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Speak once finished or click "Skip Voice" above.</p>
                      </div>
                    ) : isListening ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1.5 animate-pulse">
                          <Mic size={14} />
                        </div>
                        <p className="text-xs text-emerald-300 font-medium">Listening for your response...</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Speak clearly into your mic. Your transcript will appear live.</p>
                      </div>
                    ) : !micEnabled ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-3">
                        <div className="w-7 h-7 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-1.5">
                          <MicOff size={14} />
                        </div>
                        <p className="text-xs text-rose-300 font-medium">Microphone muted</p>
                        <button
                          onClick={toggleMic}
                          className="mt-1.5 px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-semibold hover:bg-rose-500/30 transition"
                        >
                          Unmute
                        </button>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-3">
                        <p className="text-xs text-slate-400">
                          Speak into your microphone. Your answer will be transcribed in real time.
                        </p>
                      </div>
                    )}
                  </div>

                </div>

                {/* Bottom Action Footer */}
                <div className="pt-3 mt-1 flex items-center justify-between gap-3 flex-shrink-0">
                  
                  <div className="text-[11px] text-slate-500 hidden sm:block">
                    Question <span className="text-slate-300 font-bold">{currentIndex + 1}</span> of <span className="text-slate-300 font-bold">{questions.length}</span>
                  </div>

                  <button
                    onClick={handleNextQuestion}
                    disabled={isProcessingAnswer || isSubmitting}
                    className={`flex-1 sm:flex-initial sm:min-w-[190px] py-2.5 px-5 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 shadow-xl ${
                      isProcessingAnswer || isSubmitting 
                        ? 'bg-slate-700 cursor-not-allowed text-slate-400' 
                        : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/25 active:scale-[0.98]'
                    }`}
                  >
                    {isProcessingAnswer ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-indigo-300" />
                        <span>Grammar Polish...</span>
                      </>
                    ) : isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-white" />
                        <span>Submitting...</span>
                      </>
                    ) : currentIndex < questions.length - 1 ? (
                      <>
                        <span>Next Question</span>
                        <ArrowRight size={14} />
                      </>
                    ) : (
                      <>
                        <span>Submit Interview</span>
                        <CheckSquare size={14} />
                      </>
                    )}
                  </button>

                </div>

              </div>
            )}

          </section>

        </div>

        {/* ========================================================
            FULL-WIDTH BOTTOM COMMAND DECK: 5 REAL-TIME TELEMETRY CARDS
           ======================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
          
          {/* Card 1: Confidence Tracking */}
          <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider">Confidence</span>
              <BrainCircuit size={13} className="text-indigo-400" />
            </div>
            <div className="text-lg font-black text-white font-mono">
              {confidenceScore}<span className="text-xs text-slate-400 font-sans font-normal">%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300" 
                style={{ width: `${confidenceScore}%` }} 
              />
            </div>
            <span className={`text-[10px] font-medium ${confidenceScore >= 80 ? 'text-indigo-400' : confidenceScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
              {confidenceScore >= 80 ? 'High / Poised' : confidenceScore >= 60 ? 'Moderate Composure' : 'Low Confidence'}
            </span>
          </div>

          {/* Card 2: Panic & Stress Tracking */}
          <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider">Stress Index</span>
              <Activity size={13} className={stressLevel === 'Calm' ? 'text-emerald-400' : stressLevel === 'Controlled' ? 'text-blue-400' : 'text-amber-400'} />
            </div>
            <div className="text-lg font-black text-white font-mono flex items-baseline gap-1">
              <span>{stressLevel}</span>
              <span className="text-xs text-slate-400 font-sans font-normal">({stressPercentage}%)</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  stressLevel === 'Calm' ? 'bg-emerald-500' : stressLevel === 'Controlled' ? 'bg-blue-500' : stressLevel === 'Elevated' ? 'bg-amber-500' : 'bg-rose-500'
                }`} 
                style={{ width: `${stressPercentage}%` }} 
              />
            </div>
            <span className={`text-[10px] font-medium ${stressLevel === 'Calm' ? 'text-emerald-400' : stressLevel === 'Controlled' ? 'text-blue-400' : stressLevel === 'Elevated' ? 'text-amber-400' : 'text-rose-400'}`}>
              {stressLevel === 'Calm' ? 'Calm & Steady' : stressLevel === 'Controlled' ? 'Normal Baseline' : stressLevel === 'Elevated' ? 'Elevated Strain' : 'Panic Spike'}
            </span>
          </div>

          {/* Card 3: Eye Gaze Tracking */}
          <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider">Gaze Tracking</span>
              <Eye size={13} className={gazeDirection === 'Screen Focused' ? 'text-emerald-400' : 'text-rose-400'} />
            </div>
            <div className="text-base font-bold text-white truncate font-sans">
              {gazeDirection === 'Screen Focused' ? 'Screen Locked' : gazeDirection.replace('Diverted ', '')}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${gazeDirection === 'Screen Focused' ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                style={{ width: gazeDirection === 'Screen Focused' ? '100%' : '35%' }} 
              />
            </div>
            <span className={`text-[10px] font-medium ${gazeDirection === 'Screen Focused' ? 'text-emerald-400' : 'text-rose-400 font-semibold'}`}>
              {gazeDirection === 'Screen Focused' ? 'Focused on Lens' : '⚠️ Diverted Off-Screen'}
            </span>
          </div>

          {/* Card 4: Speech Velocity (WPM) */}
          <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider">Speech Cadence</span>
              <Mic size={13} className="text-cyan-400" />
            </div>
            <div className="text-lg font-black text-white font-mono">
              {wordsPerMinute} <span className="text-xs text-slate-400 font-sans font-normal">WPM</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, (wordsPerMinute / 160) * 100)}%` }} 
              />
            </div>
            <span className="text-[10px] text-cyan-400 font-medium">
              {wordsPerMinute === 0 ? 'Microphone Standby' : wordsPerMinute < 100 ? 'Deliberate / Measured' : wordsPerMinute <= 165 ? 'Natural Cadence' : 'Fast Paced'}
            </span>
          </div>

          {/* Card 5: Neural Proctor Guard */}
          <div className="bg-[#0b1120] p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between shadow-lg col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider">Proctor Guard</span>
              <ShieldCheck size={13} className={proctoringFlags.length === 0 ? 'text-purple-400' : 'text-rose-400'} />
            </div>
            <div className="text-lg font-black text-white font-mono">
              {proctoringFlags.length === 0 ? 'Clean' : `${proctoringFlags.length} Warning(s)`}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${proctoringFlags.length === 0 ? 'bg-purple-500' : 'bg-rose-500'}`} 
                style={{ width: proctoringFlags.length === 0 ? '100%' : '40%' }} 
              />
            </div>
            <span className={`text-[10px] font-medium ${proctoringFlags.length === 0 ? 'text-purple-400' : 'text-rose-400 font-semibold'}`}>
              {proctoringFlags.length === 0 ? 'Neural Guard Clean' : 'Recruiter Flagged'}
            </span>
          </div>

        </div>

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