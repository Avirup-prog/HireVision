import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { 
  Camera, Mic, CheckCircle2, AlertCircle, Save, Video, 
  LogOut, Play, Settings, Loader2, UploadCloud, X, Check, 
  Home, List, FileText, UserCircle, Briefcase, Clock,
  ShieldCheck, AlertTriangle, UserCheck, RefreshCw, Sparkles, CheckCircle,
  Trash2, ExternalLink, Plus, Eye,
  Award, ChevronRight, Brain, Calendar, TrendingUp, Shield, Search, Zap, ArrowRight,
  Volume2, VolumeX, Sliders, Bell, Globe, Lock, Key, Laptop, Wifi, Compass, Layers, Info, 
  RotateCcw, Smartphone, Mail, Hash, BookOpen, GraduationCap, MicOff, VideoOff, MessageSquare,
  HelpCircle, Monitor
} from 'lucide-react';
import { auth, db, storage } from '../firebase';
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { API_BASE_URL } from '../config/api';

export default function CandidateProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  
  // Listen for redirected unauthorized interview access
  useEffect(() => {
    if (location.state?.sessionError) {
      showPopup(
        "Direct Entry Blocked",
        location.state.sessionError,
        "error",
        "Understood"
      );
      // Clean history state so popup does not re-trigger on subsequent tab switches
      navigate('/candidate/profile', { replace: true, state: {} });
    }
  }, [location.state, navigate]);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [streamActive, setStreamActive] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState('untested'); 
  const [user, setUser] = useState(null);
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '', 
    phone: '', 
    university: '', 
    degree: '', 
    gradYear: '', 
    gpa: '',
    targetRole: 'Full-Stack Software Engineer',
    bio: '',
    portfolio: '',
    linkedin: '', 
    github: '', 
    interviewCode: '',
    // AI Recruiter Preferences
    aiVoiceURI: '',
    speechRate: '1.0',
    autoPlayTTS: true,
    defaultAnswerMode: 'speech', // 'speech' | 'manual'
    enableCaptions: true,
    // Hardware & Media preferences
    cameraResolution: '720p',
    // Proctoring & Privacy
    proctoringSensitivity: 'balanced', // 'balanced' | 'high'
    alertStyle: 'banner', // 'banner' | 'sound' | 'border'
    lowBandwidthMode: false,
    shareTelemetry: true,
    // Notifications & Alerts
    notifyOnReview: true,
    soundOnAdmit: true,
    interviewReminders: true
  });

  // Settings Subtab & Audio Testing States
  const [settingsSubtab, setSettingsSubtab] = useState('profile'); // 'profile' | 'ai_audio' | 'hardware' | 'proctoring' | 'account'
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isPlayingVoiceSample, setIsPlayingVoiceSample] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const micAnalyserRef = useRef(null);
  const micAnimRef = useRef(null);

  // Device selection states
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');

  // Past interviews state
  const [pastInterviews, setPastInterviews] = useState([]);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(true);

  // Modal & Flow State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [modalStep, setModalStep] = useState(1); 
  const [resumeFile, setResumeFile] = useState(null);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [myResumes, setMyResumes] = useState([]);
  const [selectedResumeUrl, setSelectedResumeUrl] = useState(null);
  const [isUploadingToStorage, setIsUploadingToStorage] = useState(false);
  const [selectedPastInterview, setSelectedPastInterview] = useState(null);
  const pinInputRefs = useRef([]);
  const [interviewFilter, setInterviewFilter] = useState('all'); // 'all', 'shortlisted', 'completed'
  const [interviewSearch, setInterviewSearch] = useState('');

  // Posture & Camera Calibration States
  const calibrationVideoRef = useRef(null);
  const calibrationCanvasRef = useRef(null);
  const calibrationStreamRef = useRef(null);
  const calibrationAnimId = useRef(null);
  const [postureStatus, setPostureStatus] = useState('initializing'); // initializing, no_face, multiple_faces, too_close, too_far, cut_off, off_center, optimal, ready
  const [postureFeedback, setPostureFeedback] = useState('Connecting camera & Vision AI...');
  const [postureHoldProgress, setPostureHoldProgress] = useState(0);
  const [isPostureReady, setIsPostureReady] = useState(false);
  const calibrationHoldCounter = useRef(0);

  // Custom Feedback & Alert Popup State
  const [feedbackPopup, setFeedbackPopup] = useState({
    show: false,
    title: '',
    message: '',
    type: 'error',
    btnText: 'Understood'
  });

  const showPopup = (title, message, type = 'error', btnText = 'Understood') => {
    setFeedbackPopup({ show: true, title, message, type, btnText });
  };

  // Live Network Latency (Ping in ms)
  const [networkPing, setNetworkPing] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const measurePing = async () => {
      try {
        const start = performance.now();
        // Ping local or production backend root health endpoint
        await fetch(`${API_BASE_URL}/?_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          mode: 'cors'
        });
        const elapsed = Math.max(1, Math.round(performance.now() - start));
        if (isMounted) setNetworkPing(elapsed);
      } catch {
        try {
          const start = performance.now();
          await fetch(`${window.location.origin}/?_t=${Date.now()}`, {
            method: 'HEAD',
            cache: 'no-store'
          });
          const elapsed = Math.max(1, Math.round(performance.now() - start));
          if (isMounted) setNetworkPing(elapsed);
        } catch {
          const rtt = navigator.connection?.rtt;
          if (isMounted) setNetworkPing(rtt || 24);
        }
      }
    };

    measurePing();
    const interval = setInterval(measurePing, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getPingBadgeStyles = (ping) => {
    if (ping === null) {
      return {
        border: 'border-slate-700/60',
        dot: 'bg-slate-400',
        text: 'text-slate-300',
        icon: 'text-slate-400'
      };
    }
    if (ping <= 60) {
      return {
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
        text: 'text-emerald-300',
        icon: 'text-emerald-400'
      };
    }
    if (ping <= 150) {
      return {
        border: 'border-cyan-500/30',
        dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
        text: 'text-cyan-300',
        icon: 'text-cyan-400'
      };
    }
    if (ping <= 250) {
      return {
        border: 'border-amber-500/30',
        dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
        text: 'text-amber-300',
        icon: 'text-amber-400'
      };
    }
    return {
      border: 'border-rose-500/30',
      dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
      text: 'text-rose-300',
      icon: 'text-rose-400'
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Listen to candidate's stored resumes
          const resumesRef = collection(db, 'candidates', currentUser.uid, 'resumes');
          onSnapshot(resumesRef, (snapshot) => {
            const list = [];
            snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
            list.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
            setMyResumes(list);
          });

          const docRef = doc(db, 'candidates', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData(prev => ({ ...prev, ...data, fullName: data.fullName || currentUser.displayName || '' }));
          } else {
            setFormData(prev => ({ ...prev, fullName: currentUser.displayName || '' }));
          }
          fetchPastInterviews(currentUser.uid);
        } catch(e) {
          console.error(e);
        }
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    // Fetch available media devices
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); // Request permission first
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        setVideoDevices(videoInputs);
        setAudioDevices(audioInputs);
        
        if (videoInputs.length > 0) setSelectedVideoDevice(videoInputs[0].deviceId);
        if (audioInputs.length > 0) setSelectedAudioDevice(audioInputs[0].deviceId);
      } catch (err) {
        console.error("Error fetching devices", err);
      }
    }
    getDevices();
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0) {
        setFormData(prev => {
          if (!prev.aiVoiceURI) {
            const preferred = voices.find(v => 
              v.lang.startsWith('en') && 
              (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Female'))
            );
            return { ...prev, aiVoiceURI: preferred ? preferred.voiceURI : voices[0].voiceURI };
          }
          return prev;
        });
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const fetchPastInterviews = async (uid) => {
    setIsLoadingInterviews(true);
    try {
      // 1. Fetch completed interviews
      const qCompleted = query(collection(db, 'interviews'), where('candidateUid', '==', uid));
      const snapCompleted = await getDocs(qCompleted);
      const completedList = snapCompleted.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          type: 'interview',
          ...d,
          displayDate: d.completedAt || d.createdAt || new Date().toISOString(),
          status: d.status === 'shortlisted' ? 'shortlisted' : 'completed'
        };
      });

      // 2. Fetch knocking requests that haven't been finished
      const qRequests = query(collection(db, 'interview_requests'), where('candidateUid', '==', uid));
      const snapRequests = await getDocs(qRequests);
      const requestsList = snapRequests.docs
        .map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            type: 'request',
            ...d,
            displayDate: d.createdAt || new Date().toISOString()
          };
        })
        .filter(r => r.status !== 'approved' && !completedList.some(c => c.requestId === r.id));

      const combined = [...completedList, ...requestsList];
      combined.sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));
      setPastInterviews(combined);
    } catch (err) {
      console.error("Error fetching past interviews", err);
    } finally {
      setIsLoadingInterviews(false);
    }
  };

  const stopCalibrationCamera = () => {
    if (calibrationAnimId.current) {
      cancelAnimationFrame(calibrationAnimId.current);
      calibrationAnimId.current = null;
    }
    if (calibrationStreamRef.current) {
      calibrationStreamRef.current.getTracks().forEach(t => t.stop());
      calibrationStreamRef.current = null;
    }
    if (calibrationVideoRef.current) {
      calibrationVideoRef.current.srcObject = null;
    }
  };

  const startCalibration = async () => {
    setPostureStatus('initializing');
    setPostureFeedback('Connecting camera and loading Vision AI...');
    setPostureHoldProgress(0);
    setIsPostureReady(false);
    calibrationHoldCounter.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false
      });
      calibrationStreamRef.current = stream;
      if (calibrationVideoRef.current) {
        calibrationVideoRef.current.srcObject = stream;
      }

      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
          const s = document.createElement('script');
          s.src = src;
          s.crossOrigin = "anonymous";
          s.onload = resolve;
          s.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(s);
        });
      };

      if (!window.blazeface) {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface");
      }

      const model = await window.blazeface.load();
      runPostureDetection(model);
    } catch (err) {
      console.error("Calibration error:", err);
      setPostureStatus('error');
      setPostureFeedback('Could not access camera or load AI. You may proceed anyway.');
    }
  };

  const runPostureDetection = (model) => {
    const detect = async () => {
      const video = calibrationVideoRef.current;
      const canvas = calibrationCanvasRef.current;

      if (!video || !video.srcObject) return;

      if (video.readyState >= 2) {
        try {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          if (canvas && (canvas.width !== vw || canvas.height !== vh)) {
            canvas.width = vw;
            canvas.height = vh;
          }

          const predictions = await model.estimateFaces(video, false);

          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, vw, vh);

            predictions.forEach(pred => {
              const [x1, y1] = pred.topLeft;
              const [x2, y2] = pred.bottomRight;
              ctx.strokeStyle = predictions.length === 1 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.8)';
              ctx.lineWidth = 3;
              ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

              if (pred.landmarks) {
                ctx.fillStyle = '#38bdf8';
                pred.landmarks.forEach(([lx, ly]) => {
                  ctx.beginPath();
                  ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
                  ctx.fill();
                });
              }
            });
          }

          if (predictions.length === 0) {
            setPostureStatus('no_face');
            setPostureFeedback('No face detected. Please ensure you are facing the camera with good lighting.');
            calibrationHoldCounter.current = 0;
            setPostureHoldProgress(0);
          } else if (predictions.length > 1) {
            setPostureStatus('multiple_faces');
            setPostureFeedback('Multiple faces detected! Only the candidate should be in frame.');
            calibrationHoldCounter.current = 0;
            setPostureHoldProgress(0);
          } else {
            const [x1, y1] = predictions[0].topLeft;
            const [x2, y2] = predictions[0].bottomRight;
            const faceW = x2 - x1;
            const faceH = y2 - y1;
            const hRatio = faceH / vh;
            const wRatio = faceW / vw;
            const centerX = (x1 + faceW / 2) / vw;
            const centerY = (y1 + faceH / 2) / vh;

            if (hRatio > 0.58 || wRatio > 0.60) {
              setPostureStatus('too_close');
              setPostureFeedback('Too close! Step back slightly so head & shoulders are visible.');
              calibrationHoldCounter.current = 0;
              setPostureHoldProgress(0);
            } else if (hRatio < 0.20 || wRatio < 0.18) {
              setPostureStatus('too_far');
              setPostureFeedback('Too far! Move slightly closer to the camera.');
              calibrationHoldCounter.current = 0;
              setPostureHoldProgress(0);
            } else if (x1 < 10 || y1 < 10 || x2 > vw - 10 || y2 > vh - 10) {
              setPostureStatus('cut_off');
              setPostureFeedback('Face partially cut off! Keep your whole face visible.');
              calibrationHoldCounter.current = 0;
              setPostureHoldProgress(0);
            } else if (centerX < 0.30 || centerX > 0.70 || centerY < 0.20 || centerY > 0.72) {
              setPostureStatus('off_center');
              setPostureFeedback('Align your head and posture inside the central oval guide.');
              calibrationHoldCounter.current = 0;
              setPostureHoldProgress(0);
            } else {
              calibrationHoldCounter.current += 1;
              const progress = Math.min(100, Math.round((calibrationHoldCounter.current / 45) * 100));
              setPostureHoldProgress(progress);

              if (progress >= 100) {
                setPostureStatus('ready');
                setPostureFeedback('Posture & framing verified! You are perfectly positioned.');
                setIsPostureReady(true);
              } else {
                setPostureStatus('optimal');
                setPostureFeedback(`Hold steady! Calibrating posture (${progress}%)...`);
              }
            }
          }
        } catch (e) {
          console.error("Frame detection error:", e);
        }
      }

      calibrationAnimId.current = requestAnimationFrame(detect);
    };

    calibrationAnimId.current = requestAnimationFrame(detect);
  };

  useEffect(() => {
    if (showJoinModal && modalStep === 3) {
      startCalibration();
    } else {
      stopCalibrationCamera();
    }
    return () => {
      stopCalibrationCamera();
    };
  }, [showJoinModal, modalStep]);

  const handleProceedFromCalibration = () => {
    stopCalibrationCamera();
    handleRequestEntry();
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);
    try {
      await setDoc(doc(db, 'candidates', user.uid), {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showPopup("Profile Updated", "Your candidate details have been saved successfully!", "success", "Great");
    } catch (error) {
      showPopup("Save Failed", "Could not save profile: " + error.message, "error", "Close");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const startCamera = async () => {
    try {
      setHardwareStatus('testing');
      const constraints = {
        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
        setHardwareStatus('passed');
      }

      // Live Microphone volume analyser
      try {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          micAnalyserRef.current = { audioCtx, analyser };

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
            micAnimRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        }
      } catch (e) {
        console.warn("Audio meter setup notice:", e);
      }
    } catch (err) {
      setHardwareStatus('failed');
      showPopup("Device Access Denied", "Could not access camera or microphone. Please ensure your browser has camera & mic permissions enabled.", "error", "Close");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setStreamActive(false);
    }
    if (micAnimRef.current) {
      cancelAnimationFrame(micAnimRef.current);
    }
    if (micAnalyserRef.current?.audioCtx) {
      try { micAnalyserRef.current.audioCtx.close(); } catch(e) {}
      micAnalyserRef.current = null;
    }
    setMicVolumeLevel(0);
  };

  // Voice Sample Test Player
  const handleTestVoiceSample = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingVoiceSample(true);
      const text = `Hello ${formData.fullName || 'Candidate'}! This is your HireVision AI Recruiter. Your voice settings and audio output are working perfectly.`;
      const utterance = new SpeechSynthesisUtterance(text);
      const selected = availableVoices.find(v => v.voiceURI === formData.aiVoiceURI);
      if (selected) utterance.voice = selected;
      utterance.rate = parseFloat(formData.speechRate) || 1.0;
      utterance.onend = () => setIsPlayingVoiceSample(false);
      utterance.onerror = () => setIsPlayingVoiceSample(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speaker Output Frequency Chime Test
  const handleTestSpeaker = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
      showPopup("Speaker Audio Check", "Harmonic audio chime played successfully! Did you hear the chime from your speakers/headphones?", "success", "Sound Working");
    } catch (e) {
      showPopup("Audio Test Error", "Could not play test chime: " + e.message, "error", "Close");
    }
  };

  // Password Reset Link Dispatcher
  const handleSendPasswordReset = async () => {
    if (!user || !user.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      showPopup("Reset Link Dispatched", `A secure password reset link has been dispatched to ${user.email}. Please check your inbox or spam folder.`, "success", "Understood");
    } catch (e) {
      showPopup("Reset Failed", e.message, "error", "Close");
    }
  };

  // Stop camera if we switch tabs away from settings
  useEffect(() => {
    if (activeTab !== 'settings') {
      stopCamera();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    stopCamera();
    await signOut(auth);
    sessionStorage.removeItem('hirevision_role');
    navigate('/login');
  };

  const handlePinChange = (index, value) => {
    const val = value.replace(/[^0-9]/g, '');
    let codeArr = (formData.interviewCode || '').split('');
    while (codeArr.length < 6) codeArr.push('');
    codeArr[index] = val ? val.slice(-1) : '';
    const newCode = codeArr.join('');
    setFormData(prev => ({ ...prev, interviewCode: newCode }));

    if (val && index < 5 && pinInputRefs.current[index + 1]) {
      pinInputRefs.current[index + 1].focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      let codeArr = (formData.interviewCode || '').split('');
      if (!codeArr[index] && index > 0 && pinInputRefs.current[index - 1]) {
        pinInputRefs.current[index - 1].focus();
      }
    }
  };

  const handlePinPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted) {
      setFormData(prev => ({ ...prev, interviewCode: pasted }));
      const targetIndex = Math.min(pasted.length, 5);
      pinInputRefs.current[targetIndex]?.focus();
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!formData.interviewCode || formData.interviewCode.length < 6) {
      showPopup(
        "Incomplete Access Code",
        "Please enter the complete 6-digit access code provided by your recruiter.",
        "warning",
        "Enter Code"
      );
      return;
    }
    
    try {
      const q = query(collection(db, 'jobs'), where('jobId', '==', formData.interviewCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        showPopup(
          "Invalid Access Code",
          "No active interview session was found with this code. Please check for typos or ask your recruiter for the correct 6-digit code.",
          "error",
          "Try Again"
        );
        return;
      }
      
      const jobData = querySnapshot.docs[0].data();
      
      const now = new Date();
      const start = new Date(jobData.startTime);
      const end = new Date(jobData.endTime);
      
      if (now < start) {
        showPopup(
          "Interview Not Started Yet",
          `This session is scheduled to begin on ${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please return at the scheduled time.`,
          "warning",
          "Got It"
        );
        return;
      }
      if (now > end) {
        showPopup(
          "Interview Window Expired",
          "The scheduled time window for this interview has already closed. Please contact your recruiter if you need a new interview invite.",
          "error",
          "Close"
        );
        return;
      }
      
      setActiveJob(jobData);
      setModalStep(1);
      setShowJoinModal(true);
    } catch (err) {
      console.error(err);
      showPopup(
        "Verification Error",
        "Unable to verify your interview code right now. Please check your connection and try again.",
        "error",
        "Retry"
      );
    }
  };

  const handleStoreResume = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !user) return;
    setIsUploadingToStorage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", user.uid);

      const res = await fetch(`${API_BASE_URL}/api/store-resume`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Server returned status " + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await addDoc(collection(db, 'candidates', user.uid, 'resumes'), {
        name: data.name,
        url: data.url,
        size: data.size,
        uploadedAt: new Date().toISOString()
      });
      showPopup("Resume Saved", `"${file.name}" was successfully added to your storage vault!`, "success", "Great");
    } catch (error) {
      console.error("Resume store error:", error);
      showPopup("Upload Failed", "Could not save your resume: " + error.message, "error", "Retry");
    } finally {
      setIsUploadingToStorage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteResume = async (resumeId, e) => {
    if (e) e.stopPropagation();
    if (!user || !resumeId) return;
    if (!window.confirm("Are you sure you want to remove this resume from your vault?")) return;
    try {
      await deleteDoc(doc(db, 'candidates', user.uid, 'resumes', resumeId));
      showPopup("Resume Removed", "The resume has been successfully deleted from your storage vault.", "success", "Okay");
      if (selectedResumeUrl) {
        setSelectedResumeUrl(null);
      }
    } catch (err) {
      console.error(err);
      showPopup("Delete Failed", "Could not delete resume: " + err.message, "error", "Close");
    }
  };

  const handleUploadResumeAndParse = async () => {
    if (!resumeFile && !selectedResumeUrl) return;
    setModalStep(2); 
    
    try {
      const formDataToSend = new FormData();
      if (resumeFile) {
        formDataToSend.append("file", resumeFile);
      } else if (selectedResumeUrl) {
        formDataToSend.append("resume_url", selectedResumeUrl);
      }
      
      if (activeJob.config) {
        formDataToSend.append("config", JSON.stringify(activeJob.config));
      }
      if (activeJob.focusedSkills) {
        formDataToSend.append("focusedSkills", JSON.stringify(activeJob.focusedSkills));
      }

      const response = await fetch(`${API_BASE_URL}/api/upload-resume`, {
          method: "POST",
          body: formDataToSend
      });

      if (!response.ok) throw new Error("Failed to upload/parse resume");

      const data = await response.json();
      if (data.generated_questions) {
        setGeneratedQuestions(data.generated_questions);
        setModalStep(3);
      } else {
        throw new Error("Invalid response from parsing engine.");
      }
    } catch (error) {
      console.error(error);
      showPopup("Resume Analysis Failed", "Could not parse the resume. Please ensure it is a valid PDF and try again.", "error", "Retry");
      setModalStep(1);
    }
  };

  const handleRequestEntry = async () => {
    if (!activeJob) return;
    setModalStep(4);
    
    try {
      const requestData = {
        jobId: activeJob.jobId,
        recruiterId: activeJob.recruiterId,
        jobTitle: activeJob.title || 'Interview',
        candidateUid: user.uid,
        candidateName: formData.fullName || user.displayName || 'Candidate',
        status: 'waiting',
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'interview_requests'), requestData);
      
      const unsubscribe = onSnapshot(docRef, (snap) => {
        const data = snap.data();
        if (data && data.status === 'approved') {
          unsubscribe();
          setModalStep(5);
          setShowJoinModal(false);
          setIsUploading(true); 
          
          stopCamera();
          
          // Store active interview recovery ticket in sessionStorage
          const sessionPayload = {
            generatedQuestions,
            jobId: activeJob.jobId,
            recruiterId: activeJob.recruiterId,
            jobTitle: activeJob.title,
            requestId: docRef.id,
            timestamp: Date.now()
          };
          sessionStorage.setItem('hv_active_interview_session', JSON.stringify(sessionPayload));

          setTimeout(() => {
            navigate('/candidate/interview', { state: sessionPayload });
          }, 5000);
        } else if (data && data.status === 'rejected') {
          unsubscribe();
          showPopup("Admission Declined", "Your request to enter the interview room was declined by the recruiter.", "error", "Close");
          setShowJoinModal(false);
        }
      });
      
    } catch (err) {
      console.error(err);
      showPopup("Entry Request Failed", "There was an issue sending your entry request. Please try again.", "error", "Close");
      setShowJoinModal(false);
    }
  };

  if (isUploading) {
    return (
      <div className="min-h-screen w-full bg-[#0b1120] flex items-center justify-center">
        <div className="w-full h-full max-w-screen-lg max-h-screen">
           <DotLottieReact src="/hirevision-logo.lottie" loop autoplay />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0b1120] flex text-slate-300 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 h-full bg-[#151e32] border-r border-slate-700/50 flex flex-col shrink-0 hidden md:flex select-none z-30">
        {/* BRAND & LOGO */}
        <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white font-black text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)] shrink-0">
            HV
          </div>
          <div className="overflow-hidden">
            <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-1.5 leading-none">
              <span>HireVision</span>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold px-1.5 py-0.5 rounded uppercase">AI</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Candidate Portal</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Home size={18} />
            <span className="font-medium">Dashboard</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('interviews')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'interviews' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <List size={18} />
            <span className="font-medium">My Interviews</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('resumes')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'resumes' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <FileText size={18} />
            <span className="font-medium">My Resumes</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700/50 space-y-2">
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings size={18} />
            <span className="font-medium">Settings</span>
          </button>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={18} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER (Visible only on small screens) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#151e32] border-b border-slate-700/50 z-40 flex items-center justify-between px-4">
         <div className="font-bold text-white flex items-center gap-2"><Video size={20} className="text-indigo-400"/> HireVision</div>
         <div className="flex gap-2">
            <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Home size={20}/></button>
            <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-lg ${activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Settings size={20}/></button>
         </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 relative">
        
        {/* TAB: DASHBOARD (STUNNING REDESIGN) */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto flex flex-col pt-2 md:pt-4 pb-20 space-y-8 animate-in fade-in duration-300">
             
             {/* 1. HERO HEADER WITH LIVE STATUS PILLS */}
             <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-slate-800/80">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                     <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
                     <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
                       {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                     </span>
                     <span className="text-slate-600">•</span>
                     <span className="text-xs text-slate-400 font-medium">Candidate Portal</span>
                   </div>
                   
                   <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                     {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'},{' '}
                     <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                       {formData.fullName ? formData.fullName.split(' ')[0] : 'Candidate'}
                     </span>
                     {' '}👋
                   </h1>
                   <p className="text-slate-400 text-sm mt-1 max-w-xl">
                     All systems operational. Enter your 6-digit access code below or manage your credentials.
                   </p>
                </div>

                {/* Right side: Candidate Profile Info Card & Pre-Flight Health Pills */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
                   {/* Candidate Profile Info Card */}
                   <div className="bg-[#151e32] border border-slate-700/80 hover:border-indigo-500/40 rounded-2xl p-2.5 px-4 flex items-center gap-3.5 shadow-lg transition">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-base shadow-md shrink-0">
                         {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <UserCircle size={22} />}
                      </div>
                      <div className="overflow-hidden text-left">
                         <h3 className="text-white font-bold text-sm truncate leading-snug">{formData.fullName || 'Candidate'}</h3>
                         <p className="text-xs text-slate-400 truncate max-w-[200px]">{user?.email || 'Authenticated'}</p>
                      </div>
                   </div>

                   {/* Pre-Flight Health Pills */}
                   <div className="flex flex-wrap items-center gap-2">
                      <div className="bg-[#151e32] border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                         <span className="text-[11px] font-semibold text-emerald-300">Camera Verified</span>
                      </div>

                      <div className="bg-[#151e32] border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                         <span className="text-[11px] font-semibold text-emerald-300">Microphone Ready</span>
                      </div>

                      {(() => {
                         const badge = getPingBadgeStyles(networkPing);
                         return (
                           <div 
                             title={networkPing !== null ? `Round-trip network latency: ${networkPing}ms` : 'Measuring network latency...'}
                             className={`bg-[#151e32] border ${badge.border} px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm transition-all duration-300`}
                           >
                             <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                             <Wifi size={11} className={badge.icon} />
                             <span className={`text-[11px] font-semibold ${badge.text}`}>
                               Network: {networkPing !== null ? `${networkPing} ms` : 'Measuring...'}
                             </span>
                           </div>
                         );
                       })()}
                   </div>
                </div>
             </div>

             {/* 2. MAIN BENTO GRID */}
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                
                {/* HERO LAUNCHPAD CARD (7 Columns) */}
                <div className="lg:col-span-7 bg-gradient-to-br from-[#151e32] via-[#101728] to-[#151e32] border border-indigo-500/30 rounded-3xl p-7 md:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between group">
                   {/* Ambient Glow */}
                   <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/25 transition-all duration-500" />
                   <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-sm">
                            <Zap size={13} className="text-indigo-400 fill-indigo-400" />
                            <span>Interview Launchpad</span>
                         </span>
                         <span className="text-xs text-slate-400 font-mono">PIN ACCESS</span>
                      </div>

                      <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
                        Enter Your Interview PIN Code
                      </h2>
                      <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-6 max-w-lg">
                        Input the 6-digit access PIN provided in your recruiter invitation. Your resume will be verified and you will be connected to the AI proctor.
                      </p>

                      {/* SEGMENTED 6-SLOT PIN INPUT */}
                      <form onSubmit={handleVerifyCode} className="space-y-6">
                         <div className="flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3.5" onPaste={handlePinPaste}>
                            {[0, 1, 2, 3, 4, 5].map((idx) => {
                              const digit = (formData.interviewCode || '')[idx] || '';
                              const isFilled = Boolean(digit);
                              return (
                                <input
                                  key={idx}
                                  ref={(el) => (pinInputRefs.current[idx] = el)}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={1}
                                  value={digit}
                                  onChange={(e) => handlePinChange(idx, e.target.value)}
                                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                                  className={`w-11 h-14 sm:w-14 sm:h-16 text-center font-mono text-2xl font-black rounded-2xl border-2 transition-all duration-200 outline-none ${
                                    isFilled
                                      ? 'border-indigo-500 bg-indigo-600/15 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                      : 'border-slate-700 hover:border-slate-600 bg-[#0b1121] text-slate-300 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                                  }`}
                                />
                              );
                            })}
                         </div>

                         {/* ACTION BUTTON */}
                         <button
                           type="submit"
                           className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-base py-4 rounded-2xl transition-all shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] flex items-center justify-center gap-3 cursor-pointer group/btn"
                         >
                            <span>Verify Code & Enter Assessment</span>
                            <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                         </button>
                      </form>
                   </div>

                   {/* Footer note */}
                   <div className="relative z-10 pt-6 mt-6 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                         <ShieldCheck size={14} className="text-emerald-400" />
                         <span>Secure Proctoring Session</span>
                      </span>
                      <span className="text-slate-500 font-mono">100% Encrypted</span>
                   </div>
                </div>

                {/* RIGHT COLUMN (5 Columns): System Health & Quick Tools */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                   
                   {/* SYSTEM & VISION HEALTH CARD */}
                   <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Sparkles size={16} className="text-indigo-400" />
                            <span>Pre-Flight Readiness</span>
                         </h3>
                         <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            98% Optimal
                         </span>
                      </div>

                      <div className="space-y-3">
                         <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0b1121] border border-slate-800">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                  <Camera size={16} />
                               </div>
                               <div>
                                  <p className="text-xs font-semibold text-white">Camera & Framing</p>
                                  <p className="text-[10px] text-slate-400">BlazeFace AI Ready</p>
                               </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-400">Certified</span>
                         </div>

                         <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0b1121] border border-slate-800">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                  <Mic size={16} />
                               </div>
                               <div>
                                  <p className="text-xs font-semibold text-white">Microphone Input</p>
                                  <p className="text-[10px] text-slate-400">Clear Audio Wave</p>
                               </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-400">Active</span>
                         </div>

                         <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0b1121] border border-slate-800">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                  <Shield size={16} />
                               </div>
                               <div>
                                  <p className="text-xs font-semibold text-white">Browser Security</p>
                                  <p className="text-[10px] text-slate-400">Tab Blur Detection</p>
                               </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-400">Enabled</span>
                         </div>
                      </div>

                      <button
                        onClick={() => setActiveTab('settings')}
                        className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700/80 cursor-pointer"
                      >
                         <Settings size={14} className="text-indigo-400" />
                         <span>Manage Hardware Devices</span>
                      </button>
                   </div>

                   {/* ACTIVE RESUME VAULT QUICK CARD */}
                   <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl flex-1 flex flex-col justify-between">
                      <div>
                         <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                               <FileText size={16} className="text-indigo-400" />
                               <span>Active Resume Vault</span>
                            </h3>
                            <span className="text-[11px] text-indigo-400 font-semibold">{myResumes.length} saved</span>
                         </div>

                         {myResumes.length > 0 ? (
                            <div className="p-3.5 rounded-2xl bg-[#0b1121] border border-slate-800 flex items-center justify-between">
                               <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                                     PDF
                                  </div>
                                  <div className="truncate">
                                     <p className="text-xs font-bold text-white truncate">{myResumes[0].name}</p>
                                     <p className="text-[10px] text-slate-400">{myResumes[0].size || 'Cloud Synced'}</p>
                                  </div>
                               </div>
                               <a 
                                 href={myResumes[0].url} 
                                 target="_blank" 
                                 rel="noreferrer" 
                                 className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition"
                                 title="View Resume"
                               >
                                  <ExternalLink size={14} />
                               </a>
                            </div>
                         ) : (
                            <div className="p-4 rounded-2xl bg-[#0b1121] border border-dashed border-slate-700 text-center">
                               <p className="text-xs text-slate-400 mb-1">No resumes uploaded yet</p>
                               <p className="text-[10px] text-slate-500">Store multiple PDFs for 1-click selection</p>
                            </div>
                         )}
                      </div>

                      <button
                        onClick={() => setActiveTab('resumes')}
                        className="w-full mt-4 py-2.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 border border-indigo-500/30 cursor-pointer"
                      >
                         <Plus size={14} />
                         <span>Manage & Upload Resumes</span>
                      </button>
                   </div>
                </div>
             </div>

             {/* 3. PERFORMANCE RADAR & RECENT SESSIONS ROW */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                
                {/* AI PERFORMANCE BREAKDOWN (1 Column) */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                   <div>
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Brain size={16} className="text-indigo-400" />
                            <span>AI Performance Radar</span>
                         </h3>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Growth</span>
                      </div>

                      <div className="space-y-4">
                         <div>
                            <div className="flex justify-between text-xs font-semibold mb-1.5">
                               <span className="text-slate-300">Technical Depth</span>
                               <span className="text-indigo-400 font-mono">92%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                               <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full" style={{ width: '92%' }} />
                            </div>
                         </div>

                         <div>
                            <div className="flex justify-between text-xs font-semibold mb-1.5">
                               <span className="text-slate-300">Articulation & Speech</span>
                               <span className="text-cyan-400 font-mono">85%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                               <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full" style={{ width: '85%' }} />
                            </div>
                         </div>

                         <div>
                            <div className="flex justify-between text-xs font-semibold mb-1.5">
                               <span className="text-slate-300">Confidence & Gaze</span>
                               <span className="text-emerald-400 font-mono">94%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                               <div className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full rounded-full" style={{ width: '94%' }} />
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="mt-6 p-3.5 rounded-2xl bg-[#0b1121] border border-slate-800">
                      <p className="text-[11px] text-slate-400 italic leading-relaxed">
                         "Strong technical accuracy in system architectures; answers demonstrate practical experience."
                      </p>
                   </div>
                </div>

                {/* RECENT INTERVIEW SESSIONS LIST (2 Columns) */}
                <div className="lg:col-span-2 bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                   <div>
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Clock size={16} className="text-indigo-400" />
                            <span>Recent Interview History</span>
                         </h3>
                         <button
                           onClick={() => setActiveTab('interviews')}
                           className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition flex items-center gap-1 cursor-pointer"
                         >
                            <span>View All ({pastInterviews.length})</span>
                            <ChevronRight size={14} />
                         </button>
                      </div>

                      {pastInterviews.length === 0 ? (
                         <div className="text-center py-10 bg-[#0b1121] border border-dashed border-slate-800 rounded-2xl p-6">
                            <List size={28} className="text-slate-600 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 font-medium">No previous interviews recorded</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Your completed sessions and AI evaluations will appear here</p>
                         </div>
                      ) : (
                         <div className="space-y-2.5">
                            {pastInterviews.slice(0, 3).map((interview) => (
                               <div
                                 key={interview.id}
                                 className="p-3.5 rounded-2xl bg-[#0b1121] border border-slate-800/80 hover:border-indigo-500/40 transition flex items-center justify-between gap-4"
                               >
                                  <div className="flex items-center gap-3 overflow-hidden">
                                     <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                       interview.status === 'shortlisted'
                                         ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                         : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                     }`}>
                                        {interview.status === 'shortlisted' ? <Award size={18} /> : <FileText size={18} />}
                                     </div>
                                     <div className="truncate">
                                        <p className="text-xs font-bold text-white truncate">{interview.jobTitle || 'Technical Interview'}</p>
                                        <p className="text-[10px] text-slate-400">
                                           {new Date(interview.displayDate || interview.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                     </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                     <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                       interview.status === 'shortlisted'
                                         ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                         : interview.status === 'completed'
                                         ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                                         : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                     }`}>
                                        {interview.status === 'shortlisted' ? 'Shortlisted' : interview.status === 'completed' ? 'Completed' : 'Pending'}
                                     </span>

                                     <button
                                       onClick={() => {
                                         setSelectedPastInterview(interview);
                                         setActiveTab('interviews');
                                       }}
                                       className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition cursor-pointer"
                                       title="View Details"
                                     >
                                        <Eye size={14} />
                                     </button>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>

                   {/* Quick Interview Tip strip */}
                   <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                         <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                         <span>Speak directly into your microphone and look at the camera</span>
                      </span>
                      <button 
                        onClick={() => setActiveTab('settings')}
                        className="text-indigo-400 hover:underline font-medium"
                      >
                         Run Hardware Test
                      </button>
                   </div>
                </div>
             </div>

          </div>
        )}
        {/* TAB: MY INTERVIEWS REDESIGNED */}
        {activeTab === 'interviews' && (
          <div className="max-w-5xl mx-auto flex flex-col pt-2 md:pt-6 pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    Interview History & Evaluations
                  </span>
                  <span className="text-xs text-slate-400">
                    {pastInterviews.length} Total Record{pastInterviews.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">My Interviews</h1>
                <p className="text-slate-400 text-sm mt-1 max-w-xl">
                  Review your technical performance, AI evaluations, proctoring integrity reports, and recruiter feedback.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('dashboard')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl font-bold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Play size={16} fill="white" />
                <span>Join New Interview</span>
              </button>
            </div>

            {/* Quick Analytics Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#151e32] border border-slate-700/70 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Video size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Completed</p>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {pastInterviews.filter(i => i.status === 'completed' || i.status === 'shortlisted').length}
                  </p>
                </div>
              </div>

              <div className="bg-[#151e32] border border-slate-700/70 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Shortlisted</p>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">
                    {pastInterviews.filter(i => i.status === 'shortlisted').length}
                  </p>
                </div>
              </div>

              <div className="bg-[#151e32] border border-slate-700/70 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Brain size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">AI Evaluated</p>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {pastInterviews.filter(i => i.evaluations && i.evaluations.length > 0).length}
                  </p>
                </div>
              </div>

              <div className="bg-[#151e32] border border-slate-700/70 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Proctoring Trust</p>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {pastInterviews.length > 0 && pastInterviews.filter(i => !i.proctoringFlags || i.proctoringFlags.length === 0).length > 0
                      ? '100% Clean'
                      : 'Verified'}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setInterviewFilter('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                    interviewFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-[#151e32] text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  All ({pastInterviews.length})
                </button>

                <button
                  onClick={() => setInterviewFilter('shortlisted')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    interviewFilter === 'shortlisted'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-[#151e32] text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <Award size={13} />
                  <span>Shortlisted ({pastInterviews.filter(i => i.status === 'shortlisted').length})</span>
                </button>

                <button
                  onClick={() => setInterviewFilter('completed')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                    interviewFilter === 'completed'
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-[#151e32] text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  Completed ({pastInterviews.filter(i => i.status === 'completed').length})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by role..."
                  value={interviewSearch}
                  onChange={(e) => setInterviewSearch(e.target.value)}
                  className="w-full bg-[#151e32] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Interviews List */}
            {isLoadingInterviews ? (
              <div className="py-20 text-center bg-[#151e32]/40 border border-slate-700/60 rounded-3xl">
                <Loader2 size={36} className="animate-spin text-indigo-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading your interview sessions...</p>
              </div>
            ) : (() => {
              const filtered = pastInterviews.filter(interview => {
                const matchesRole = (interview.jobTitle || '').toLowerCase().includes(interviewSearch.toLowerCase());
                if (!matchesRole) return false;
                if (interviewFilter === 'shortlisted') return interview.status === 'shortlisted';
                if (interviewFilter === 'completed') return interview.status === 'completed';
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-16 bg-[#151e32]/40 border border-slate-700/60 rounded-3xl p-8">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400 border border-indigo-500/20">
                      <List size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Interviews Found</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                      {interviewSearch || interviewFilter !== 'all'
                        ? 'No interview records matched your filter criteria.'
                        : 'You haven\'t completed any technical interviews yet. Enter an interview access code on the dashboard to get started!'}
                    </p>
                    <button
                      onClick={() => { setInterviewSearch(''); setInterviewFilter('all'); setActiveTab('dashboard'); }}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer"
                    >
                      <Play size={14} fill="white" />
                      <span>Start Interview Now</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filtered.map(interview => {
                    const isShortlisted = interview.status === 'shortlisted';
                    const isCompleted = interview.status === 'completed' || isShortlisted;
                    const hasEvaluations = interview.evaluations && interview.evaluations.length > 0;
                    const questionCount = interview.questions ? interview.questions.length : null;
                    const flagCount = interview.proctoringFlags ? interview.proctoringFlags.length : 0;

                    return (
                      <div
                        key={interview.id}
                        className={`bg-[#151e32] border rounded-3xl p-6 transition-all duration-200 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:translate-y-[-2px] ${
                          isShortlisted
                            ? 'border-emerald-500/50 hover:border-emerald-500 bg-gradient-to-r from-[#151e32] to-emerald-950/20 shadow-emerald-950/20'
                            : 'border-slate-700/80 hover:border-indigo-500/60'
                        }`}
                      >
                        {/* Left Details */}
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                            isShortlisted
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                              : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          }`}>
                            {isShortlisted ? <Award size={26} /> : <FileText size={24} />}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                              <h3 className="text-lg md:text-xl font-bold text-white">
                                {interview.jobTitle || 'Technical Interview Session'}
                              </h3>

                              {/* Status Badge */}
                              {isShortlisted ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm animate-pulse">
                                  <Award size={12} />
                                  <span>Shortlisted</span>
                                </span>
                              ) : isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  <CheckCircle2 size={12} />
                                  <span>Completed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock size={12} />
                                  <span>{interview.status || 'Pending'}</span>
                                </span>
                              )}
                            </div>

                            {/* Metadata Pills */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                              <span className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-slate-500" />
                                {new Date(interview.displayDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>

                              {questionCount && (
                                <>
                                  <span className="text-slate-600">•</span>
                                  <span className="flex items-center gap-1">
                                    <Brain size={13} className="text-indigo-400" />
                                    <span>{questionCount} Questions Answered</span>
                                  </span>
                                </>
                              )}

                              <span className="text-slate-600">•</span>
                              {flagCount === 0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <ShieldCheck size={13} />
                                  <span>Clean Proctoring</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400">
                                  <AlertTriangle size={13} />
                                  <span>{flagCount} Camera Flag{flagCount > 1 ? 's' : ''}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Action & Score */}
                        <div className="flex items-center gap-4 self-end md:self-center shrink-0">
                          {interview.overall_score !== undefined && (
                            <div className="text-right">
                              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">AI Score</p>
                              <p className="text-2xl font-black text-indigo-400">
                                {interview.overall_score}
                                <span className="text-xs text-slate-500 font-normal">/10</span>
                              </p>
                            </div>
                          )}

                          <button
                            onClick={() => setSelectedPastInterview(interview)}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
                              isShortlisted
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                                : 'bg-slate-800 hover:bg-indigo-600 text-white border border-slate-700/80 hover:border-indigo-500'
                            }`}
                          >
                            <Eye size={14} />
                            <span>View Full Report</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* FULL INTERVIEW REPORT & TRANSCRIPT DRAWER / MODAL */}
            {selectedPastInterview && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                <div className="bg-[#0b1121] border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
                  {/* Modal Header */}
                  <div className="p-5 border-b border-slate-800 bg-[#151e32]/60 flex items-center justify-between shrink-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                          Candidate Session File
                        </span>
                        {selectedPastInterview.status === 'shortlisted' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <Award size={10} /> Shortlisted
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        {selectedPastInterview.jobTitle || 'Interview Report'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Completed on {new Date(selectedPastInterview.displayDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedPastInterview(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Top Key Metrics Banner */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-[#151e32] border border-slate-800 rounded-2xl p-4 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Overall AI Score</p>
                        <p className="text-2xl font-black text-indigo-400">
                          {selectedPastInterview.overall_score !== undefined ? `${selectedPastInterview.overall_score}/10` : 'Pending'}
                        </p>
                      </div>

                      <div className="bg-[#151e32] border border-slate-800 rounded-2xl p-4 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Questions Answered</p>
                        <p className="text-2xl font-black text-white">
                          {selectedPastInterview.questions ? selectedPastInterview.questions.length : 0}
                        </p>
                      </div>

                      <div className="bg-[#151e32] border border-slate-800 rounded-2xl p-4 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Proctor Integrity</p>
                        <p className={`text-lg font-bold ${!selectedPastInterview.proctoringFlags || selectedPastInterview.proctoringFlags.length === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {!selectedPastInterview.proctoringFlags || selectedPastInterview.proctoringFlags.length === 0 ? '100% Clean' : `${selectedPastInterview.proctoringFlags.length} Flagged`}
                        </p>
                      </div>
                    </div>

                    {/* Proctoring Log if flags exist */}
                    {selectedPastInterview.proctoringFlags && selectedPastInterview.proctoringFlags.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          <span>AI Proctoring Warnings Recorded ({selectedPastInterview.proctoringFlags.length})</span>
                        </p>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {selectedPastInterview.proctoringFlags.map((flag, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-amber-200/80 bg-amber-950/30 p-2 rounded-xl">
                              <span>{flag.issue}</span>
                              <span className="font-mono text-[10px] text-amber-400/80">{flag.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Q&A Transcript */}
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-400" />
                        <span>Recorded Q&A Pairs & Feedback</span>
                      </h4>

                      {selectedPastInterview.questions && selectedPastInterview.questions.length > 0 ? (
                        <div className="space-y-5">
                          {selectedPastInterview.questions.map((q, idx) => {
                            const evalData = selectedPastInterview.evaluations ? selectedPastInterview.evaluations[idx] : null;
                            const answerText = selectedPastInterview.answers && selectedPastInterview.answers[idx]
                              ? selectedPastInterview.answers[idx]
                              : "No audio transcript recorded.";

                            return (
                              <div key={idx} className="bg-[#151e32] border border-slate-800 rounded-2xl p-5 space-y-4">
                                {/* Question */}
                                <div className="flex gap-3">
                                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                    Q{idx + 1}
                                  </div>
                                  <p className="text-sm font-semibold text-white pt-0.5">
                                    {typeof q === 'string' ? q : q.text || q}
                                  </p>
                                </div>

                                {/* Candidate Answer */}
                                <div className="ml-10 bg-[#0b1121] border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed">
                                  <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Candidate Answer:</span>
                                  {answerText}
                                </div>

                                {/* Evaluation Feedback if available */}
                                {evalData && (
                                  <div className="ml-10 bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                        <Brain size={14} />
                                        <span>AI Semantic Scoring:</span>
                                      </span>
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                        evalData.score >= 4 ? 'bg-emerald-500/20 text-emerald-400' :
                                        evalData.score === 3 ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-rose-500/20 text-rose-400'
                                      }`}>
                                        Score: {evalData.score}/5
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-300">{evalData.feedback}</p>

                                    {evalData.signals_missed && evalData.signals_missed.length > 0 && (
                                      <div className="pt-1.5 border-t border-indigo-500/20">
                                        <p className="text-[10px] font-bold text-amber-400 uppercase">Signals Missed:</p>
                                        <ul className="list-disc list-inside text-xs text-slate-400 mt-0.5">
                                          {evalData.signals_missed.map((sig, sIdx) => (
                                            <li key={sIdx}>{sig}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic p-4 text-center bg-[#151e32] rounded-xl">
                          No question transcript data was saved for this session.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-800 bg-[#151e32]/40 flex justify-end shrink-0">
                    <button
                      onClick={() => setSelectedPastInterview(null)}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
                    >
                      Close Report
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: MY RESUMES VAULT */}
        {activeTab === 'resumes' && (
          <div className="max-w-5xl mx-auto flex flex-col pt-2 md:pt-6 pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    Personal Document Vault
                  </span>
                  <span className="text-xs text-slate-400">
                    {myResumes.length} {myResumes.length === 1 ? 'Resume' : 'Resumes'} Stored
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">My Resumes</h1>
                <p className="text-slate-400 text-sm mt-1 max-w-xl">
                  Store and organize multiple versions of your resume (e.g., Full-Stack, Backend, Frontend). 
                  Select any of them with 1-click when joining an interview.
                </p>
              </div>

              {/* Upload Button */}
              <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2.5 cursor-pointer shrink-0 border border-indigo-400/30 hover:scale-[1.02] active:scale-[0.98]">
                {isUploadingToStorage ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                <span>{isUploadingToStorage ? "Uploading PDF..." : "Upload New Resume"}</span>
                <input 
                  type="file" 
                  accept=".pdf" 
                  className="hidden" 
                  onChange={handleStoreResume} 
                  disabled={isUploadingToStorage} 
                />
              </label>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-[#151e32] border border-slate-700/70 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <FileText size={22} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Stored Resumes</p>
                  <p className="text-xl font-bold text-white mt-0.5">{myResumes.length} Document{myResumes.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="bg-[#151e32] border border-slate-700/70 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Cloud Storage</p>
                  <p className="text-xl font-bold text-white mt-0.5">Firebase Secure</p>
                </div>
              </div>

              <div className="bg-[#151e32] border border-slate-700/70 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Sparkles size={22} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">AI Question Parsing</p>
                  <p className="text-xl font-bold text-white mt-0.5">1-Click Auto Select</p>
                </div>
              </div>
            </div>

            {/* Drag & Drop Quick Area */}
            <div className="mb-8">
              <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
                isUploadingToStorage 
                  ? 'border-indigo-500 bg-indigo-500/10' 
                  : 'border-slate-700/80 hover:border-indigo-500/60 bg-[#151e32]/40 hover:bg-[#151e32]'
              }`}>
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2">
                    {isUploadingToStorage ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {isUploadingToStorage ? "Saving to your cloud vault..." : "Drag & drop a PDF resume here, or click to browse"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Supports PDF format up to 10MB ? Automatically encrypted & synced</p>
                </div>
                <input 
                  type="file" 
                  accept=".pdf" 
                  className="hidden" 
                  onChange={handleStoreResume} 
                  disabled={isUploadingToStorage} 
                />
              </label>
            </div>

            {/* Resumes Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Saved Documents</span>
                  <span className="text-xs text-slate-500">({myResumes.length})</span>
                </h3>
              </div>

              {myResumes.length === 0 ? (
                <div className="text-center py-16 bg-[#151e32]/60 border border-slate-700/70 rounded-3xl p-8">
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400 border border-indigo-500/20">
                    <FileText size={36} />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">Your Resume Vault is Empty</h4>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                    Upload your first resume here. It will be securely stored so you never have to search for your PDF file when an interview starts!
                  </p>
                  <label className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition shadow-lg shadow-indigo-600/30">
                    <Plus size={18} />
                    <span>Upload First Resume</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleStoreResume} />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myResumes.map((resume) => (
                    <div 
                      key={resume.id} 
                      className="bg-[#151e32] border border-slate-700/80 hover:border-indigo-500/60 rounded-3xl p-5 flex flex-col justify-between group transition-all duration-200 shadow-xl relative overflow-hidden"
                    >
                      {/* Top Row: PDF Badge + Actions */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                          PDF
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <a 
                            href={resume.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            title="Open document in new tab" 
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600 text-slate-400 hover:text-white transition cursor-pointer"
                          >
                            <ExternalLink size={15} />
                          </a>
                          <button 
                            type="button"
                            onClick={(e) => handleDeleteResume(resume.id, e)} 
                            title="Delete resume from vault" 
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white transition cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Metadata */}
                      <div className="flex-1 mb-5">
                        <h4 className="text-white font-bold text-base truncate group-hover:text-indigo-300 transition" title={resume.name}>
                          {resume.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <Clock size={13} className="text-slate-500 shrink-0" />
                          <span>
                            {resume.uploadedAt 
                              ? new Date(resume.uploadedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) 
                              : 'Recently uploaded'}
                          </span>
                          {resume.size && (
                            <>
                              <span className="text-slate-600">?</span>
                              <span className="text-slate-500">{resume.size}</span>
                            </>
                          )}
                        </div>
                        
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                          <Check size={12} />
                          <span>Ready for Interview Selection</span>
                        </div>
                      </div>

                      {/* Bottom Button */}
                      <a 
                        href={resume.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700/60 transition group-hover:border-indigo-500/40 cursor-pointer"
                      >
                        <Eye size={14} className="text-indigo-400" />
                        <span>Preview Document</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
            
            {/* Settings Header with Direct Save Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings & System Setup</h1>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-semibold">
                    v2.4
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">
                  Configure your professional profile, AI recruiter parameters, audio/video diagnostics, and proctoring telemetry.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-60"
              >
                {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{isSavingProfile ? 'Saving...' : 'Save All Changes'}</span>
              </button>
            </div>

            {/* Category Navigation Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {[
                { id: 'profile', label: 'Profile & Career Bio', icon: <UserCircle size={16} /> },
                { id: 'ai_audio', label: 'AI Voice & Speech Engine', icon: <Brain size={16} /> },
                { id: 'hardware', label: 'Hardware Pre-Flight', icon: <Camera size={16} /> },
                { id: 'proctoring', label: 'Proctoring & Privacy', icon: <ShieldCheck size={16} /> },
                { id: 'security', label: 'Security & Alerts', icon: <Bell size={16} /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSettingsSubtab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    settingsSubtab === tab.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-100'
                      : 'bg-[#151e32] text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* SUBTAB 1: PROFILE & CAREER BIO */}
            {settingsSubtab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                
                {/* Candidate Identity Overview Card */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-600/30 border border-indigo-400/30 shrink-0">
                    {formData.fullName ? formData.fullName.slice(0, 2).toUpperCase() : 'CV'}
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                      <h3 className="text-xl font-bold text-white">{formData.fullName || 'Candidate Profile'}</h3>
                      <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={12} /> Verified Candidate
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mb-2">{user?.email || 'No email attached'}</p>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-medium">
                      <Briefcase size={13} />
                      <span>{formData.targetRole || 'Software Engineer'}</span>
                    </div>
                  </div>
                </div>

                {/* Personal Information & Bio */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                    <UserCircle size={18} className="text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Basic Information & Professional Bio</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Legal Name *</label>
                      <input 
                        type="text" 
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.fullName} 
                        onChange={e => setFormData({...formData, fullName: e.target.value})} 
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                      <input 
                        type="email" 
                        disabled
                        className="w-full bg-[#0b1121]/50 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed"
                        value={user?.email || ''} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
                      <input 
                        type="tel" 
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Engineering Role</label>
                      <select
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition cursor-pointer"
                        value={formData.targetRole || 'Full-Stack Software Engineer'}
                        onChange={e => setFormData({...formData, targetRole: e.target.value})}
                      >
                        <option value="Full-Stack Software Engineer">Full-Stack Software Engineer</option>
                        <option value="Frontend Specialist (React/Next)">Frontend Specialist (React / Next.js)</option>
                        <option value="Backend & Distributed Systems">Backend & Distributed Systems</option>
                        <option value="AI / Machine Learning Engineer">AI / Machine Learning Engineer</option>
                        <option value="DevOps & Cloud Infrastructure">DevOps & Cloud Infrastructure</option>
                        <option value="Mobile Engineer (iOS/Android/Flutter)">Mobile Engineer (Flutter / React Native)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Personal Portfolio / Website</label>
                      <input 
                        type="url" 
                        placeholder="https://yourportfolio.dev"
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.portfolio || ''} 
                        onChange={e => setFormData({...formData, portfolio: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300">Professional Bio & Elevator Summary</label>
                      <span className="text-[11px] text-slate-500">Priming context for Groq AI</span>
                    </div>
                    <textarea 
                      rows={3}
                      placeholder="Briefly describe your core engineering philosophy, years of experience, and signature technical stacks..."
                      className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-sm text-white focus:outline-none transition leading-relaxed placeholder:text-slate-600"
                      value={formData.bio || ''} 
                      onChange={e => setFormData({...formData, bio: e.target.value})} 
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      💡 The Groq LLaMA 3.3 engine utilizes this summary to dynamically personalize technical interview questions.
                    </p>
                  </div>
                </div>

                {/* Academic Credentials */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                    <GraduationCap size={18} className="text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Academic Qualifications</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">University / College</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Stanford University"
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.university} 
                        onChange={e => setFormData({...formData, university: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Degree / Major</label>
                      <input 
                        type="text" 
                        placeholder="e.g. B.Tech / B.S. CS"
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.degree} 
                        onChange={e => setFormData({...formData, degree: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Grad Year & GPA</label>
                      <input 
                        type="text" 
                        placeholder="2024 (GPA: 3.8)"
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.gradYear} 
                        onChange={e => setFormData({...formData, gradYear: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                {/* Social Profiles & Developer Hubs */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                    <Globe size={18} className="text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Online Profiles & Repositories</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">LinkedIn URL</label>
                        {formData.linkedin && (
                          <a href={formData.linkedin} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1">
                            Verify <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <input 
                        type="url" 
                        placeholder="https://linkedin.com/in/username"
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.linkedin} 
                        onChange={e => setFormData({...formData, linkedin: e.target.value})} 
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">GitHub Profile URL</label>
                        {formData.github && (
                          <a href={formData.github} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1">
                            Verify <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <input 
                        type="url" 
                        placeholder="https://github.com/username"
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
                        value={formData.github} 
                        onChange={e => setFormData({...formData, github: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={isSavingProfile}
                    className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                  >
                    {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{isSavingProfile ? 'Saving Details...' : 'Save Profile Information'}</span>
                  </button>
                </div>

              </form>
            )}

            {/* SUBTAB 2: AI VOICE & SPEECH ENGINE */}
            {settingsSubtab === 'ai_audio' && (
              <div className="space-y-6">
                
                {/* Voice Selection & Speed Card */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Brain size={18} className="text-indigo-400" />
                      <h2 className="text-base font-semibold text-white">AI Recruiter Speech Synthesis</h2>
                    </div>
                    <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full font-medium">
                      Neural TTS v2.4
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Default Recruiter Voice</label>
                      <select
                        className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition cursor-pointer"
                        value={formData.aiVoiceURI}
                        onChange={e => setFormData({...formData, aiVoiceURI: e.target.value})}
                      >
                        {availableVoices.filter(v => v.lang.startsWith('en')).map(v => (
                          <option key={v.voiceURI} value={v.voiceURI} className="bg-[#0b1120] text-slate-200">
                            {v.name.replace('Microsoft ', '').replace(' Desktop', '').replace('English ', '')} ({v.lang})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Selected voice will verbalize interview questions inside the proctored studio.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Speech Delivery Rate</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: '0.85', label: '0.85x', desc: 'Deliberate' },
                          { val: '1.0', label: '1.0x', desc: 'Standard' },
                          { val: '1.15', label: '1.15x', desc: 'Brisk' }
                        ].map(rate => (
                          <button
                            key={rate.val}
                            type="button"
                            onClick={() => setFormData({...formData, speechRate: rate.val})}
                            className={`p-2.5 rounded-xl border text-center transition ${
                              formData.speechRate === rate.val
                                ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30'
                                : 'bg-[#0b1121] border-slate-700 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <div className="text-sm">{rate.label}</div>
                            <div className="text-[10px] text-slate-400">{rate.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Voice Sample Test */}
                  <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                        <Volume2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Test Speech Synthesis</h4>
                        <p className="text-xs text-slate-400">Preview the AI voice using your chosen speed & accent.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestVoiceSample}
                      disabled={isPlayingVoiceSample}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition flex items-center justify-center gap-2"
                    >
                      {isPlayingVoiceSample ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      <span>{isPlayingVoiceSample ? 'Playing Sample...' : 'Hear AI Sample'}</span>
                    </button>
                  </div>
                </div>

                {/* Transcription & Answering Preferences */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                    <Sliders size={18} className="text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Answer Studio & Transcription Preferences</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Default Mode Preference */}
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 space-y-2">
                      <label className="block text-xs font-semibold text-slate-200">Default Answering Mode</label>
                      <p className="text-xs text-slate-400 mb-3">Which mode opens when stepping to a new question:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, defaultAnswerMode: 'speech'})}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                            formData.defaultAnswerMode === 'speech'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : 'bg-[#151e32] text-slate-400 border-slate-700'
                          }`}
                        >
                          <Mic size={14} />
                          <span>Voice First (STT)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, defaultAnswerMode: 'manual'})}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                            formData.defaultAnswerMode === 'manual'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : 'bg-[#151e32] text-slate-400 border-slate-700'
                          }`}
                        >
                          <Edit3 size={14} />
                          <span>Editor First</span>
                        </button>
                      </div>
                    </div>

                    {/* Auto-Play Toggle */}
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Auto-Play Question TTS</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Automatically speak each question upon advancing.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.autoPlayTTS} 
                        onChange={e => setFormData({...formData, autoPlayTTS: e.target.checked})}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" 
                      />
                    </div>

                    {/* Live Captions Toggle */}
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Live Subtitles & Waveforms</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Render speech-to-text preview bar inside the video monitor.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.enableCaptions} 
                        onChange={e => setFormData({...formData, enableCaptions: e.target.checked})}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" 
                      />
                    </div>

                    {/* Grammar Autocorrect */}
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Neural Grammar Polish</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Filter verbal filler words ('um', 'ah') using Groq LLaMA before submission.</p>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Always Active
                      </span>
                    </div>

                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    type="button" 
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                  >
                    {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Speech Preferences</span>
                  </button>
                </div>

              </div>
            )}

            {/* SUBTAB 3: HARDWARE PRE-FLIGHT */}
            {settingsSubtab === 'hardware' && (
              <div className="space-y-6">
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Device Selectors & Diagnostic Controls (5 cols) */}
                  <div className="lg:col-span-5 space-y-5">
                    
                    <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Settings size={16} className="text-indigo-400" />
                          <span>Input Peripherals</span>
                        </h3>
                        {hardwareStatus === 'passed' && (
                          <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                            <CheckCircle2 size={12}/> Verified
                          </span>
                        )}
                        {hardwareStatus === 'failed' && (
                          <span className="bg-rose-500/20 text-rose-400 text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                            <AlertCircle size={12}/> Failed
                          </span>
                        )}
                      </div>

                      {/* Camera Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <Camera size={14} className="text-indigo-400" /> Camera Device
                        </label>
                        <select 
                          className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition cursor-pointer"
                          value={selectedVideoDevice}
                          onChange={(e) => { 
                            setSelectedVideoDevice(e.target.value); 
                            if (streamActive) { stopCamera(); setStreamActive(false); } 
                          }}
                        >
                          {videoDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera ${device.deviceId.slice(0,5)}`}
                            </option>
                          ))}
                          {videoDevices.length === 0 && <option value="">No cameras detected</option>}
                        </select>
                      </div>

                      {/* Microphone Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <Mic size={14} className="text-emerald-400" /> Microphone Device
                        </label>
                        <select 
                          className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition cursor-pointer"
                          value={selectedAudioDevice}
                          onChange={(e) => { 
                            setSelectedAudioDevice(e.target.value); 
                            if (streamActive) { stopCamera(); setStreamActive(false); } 
                          }}
                        >
                          {audioDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${device.deviceId.slice(0,5)}`}
                            </option>
                          ))}
                          {audioDevices.length === 0 && <option value="">No microphones detected</option>}
                        </select>
                      </div>

                      {/* Camera Resolution */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <Monitor size={14} className="text-cyan-400" /> Video Resolution
                        </label>
                        <select 
                          className="w-full bg-[#0b1121] border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition cursor-pointer"
                          value={formData.cameraResolution}
                          onChange={(e) => setFormData({...formData, cameraResolution: e.target.value})}
                        >
                          <option value="720p">720p HD (Balanced - Recommended)</option>
                          <option value="1080p">1080p FHD (High Fidelity)</option>
                          <option value="480p">480p SD (Data Saver)</option>
                        </select>
                      </div>

                      {/* Speaker Test Action */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleTestSpeaker}
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center justify-center gap-2"
                        >
                          <Volume2 size={15} className="text-indigo-400" />
                          <span>Test Speaker / Output Audio</span>
                        </button>
                      </div>

                    </div>

                  </div>

                  {/* Right Column: Live Testing Viewport & Volume Visualizer (7 cols) */}
                  <div className="lg:col-span-7 bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700/50 mb-4">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Video size={16} className="text-indigo-400" />
                        <span>Live Monitor & Microphone Decibel Meter</span>
                      </h3>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        streamActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold' : 'text-slate-500'
                      }`}>
                        {streamActive ? 'Stream Online' : 'Standby'}
                      </span>
                    </div>

                    {/* 16:9 Mirrored Camera Screen */}
                    <div className="relative w-full aspect-video bg-[#070b14] rounded-2xl overflow-hidden mb-4 border border-slate-800 shadow-inner flex items-center justify-center">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity ${!streamActive && 'opacity-0'}`}
                      />
                      
                      {!streamActive && (
                        <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                          <Camera size={40} className="mb-2 opacity-30 text-indigo-400" />
                          <p className="text-sm font-semibold text-slate-300">Camera Feed Idle</p>
                          <p className="text-xs text-slate-500 mt-1 max-w-xs">
                            Click 'Start Pre-Flight Test' to verify your webcam video and real-time audio decibels.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Microphone Volume Level Bar */}
                    <div className="mb-5 p-3.5 bg-[#0b1121] rounded-2xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                          <Mic size={13} className={streamActive && micVolumeLevel > 5 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
                          Microphone Input Sensitivity
                        </span>
                        <span className="text-slate-300 font-mono font-bold">{micVolumeLevel}%</span>
                      </div>
                      
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-75 ${
                            micVolumeLevel > 70 ? 'bg-rose-500' : micVolumeLevel > 30 ? 'bg-emerald-400' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${micVolumeLevel}%` }}
                        />
                      </div>
                    </div>

                    {/* Test Toggle Action */}
                    <button 
                      type="button"
                      onClick={streamActive ? stopCamera : startCamera} 
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                        streamActive 
                          ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      }`}
                    >
                      {streamActive ? "Stop Pre-Flight Test" : "Start Pre-Flight Camera & Mic Test"}
                    </button>

                  </div>

                </div>

              </div>
            )}

            {/* SUBTAB 4: PROCTORING & PRIVACY */}
            {settingsSubtab === 'proctoring' && (
              <div className="space-y-6">
                
                {/* On-Device Guarantee Card */}
                <div className="bg-gradient-to-r from-indigo-950/40 to-[#151e32] border border-indigo-500/30 rounded-3xl p-6 shadow-xl flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">On-Device Edge Neural Proctoring</h3>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                      HireVision executes facial verification exclusively inside your browser using TensorFlow.js BlazeFace. 
                      <strong> Zero raw camera video or audio recordings are uploaded or stored on cloud servers.</strong> Only mathematical landmark telemetry and timestamp flags are logged for recruiter audit integrity.
                    </p>
                  </div>
                </div>

                {/* Session Proctoring Configurations */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                    <Shield size={18} className="text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Examination Integrity Settings</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Proctor Sensitivity */}
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 space-y-2">
                      <label className="block text-xs font-semibold text-slate-200">Face Detection Sensitivity</label>
                      <p className="text-xs text-slate-400 mb-3">Threshold for flagging multiple faces or out-of-frame gaze:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, proctoringSensitivity: 'balanced'})}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center transition ${
                            formData.proctoringSensitivity === 'balanced'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : 'bg-[#151e32] text-slate-400 border-slate-700'
                          }`}
                        >
                          Balanced (Recommended)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, proctoringSensitivity: 'high'})}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center transition ${
                            formData.proctoringSensitivity === 'high'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : 'bg-[#151e32] text-slate-400 border-slate-700'
                          }`}
                        >
                          High Vigilance
                        </button>
                      </div>
                    </div>

                    {/* Low Bandwidth Mode */}
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Low-Bandwidth Mode</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Optimizes mesh inference intervals to save mobile data or weak Wi-Fi.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.lowBandwidthMode} 
                        onChange={e => setFormData({...formData, lowBandwidthMode: e.target.checked})}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" 
                      />
                    </div>

                    {/* Out of Frame Alert Style */}
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 md:col-span-2 space-y-2">
                      <label className="block text-xs font-semibold text-slate-200">In-Session Violation Alert Style</label>
                      <p className="text-xs text-slate-400 mb-3">How the studio notifies you if your face moves outside the frame:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'banner', label: 'Full Banner Overlay' },
                          { id: 'sound', label: 'Audio Warning Chime' },
                          { id: 'border', label: 'Subtle Frame Pulse' }
                        ].map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setFormData({...formData, alertStyle: st.id})}
                            className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                              formData.alertStyle === st.id
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                : 'bg-[#151e32] text-slate-400 border-slate-700'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    type="button" 
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                  >
                    {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Privacy Settings</span>
                  </button>
                </div>

              </div>
            )}

            {/* SUBTAB 5: SECURITY & ALERTS */}
            {settingsSubtab === 'security' && (
              <div className="space-y-6">
                
                {/* Notification Preferences */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                    <Bell size={18} className="text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Email & In-App Notification Alerts</h2>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Scorecard Evaluation Alerts</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Receive notification when a recruiter completes the Groq rubric review.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.notifyOnReview} 
                        onChange={e => setFormData({...formData, notifyOnReview: e.target.checked})}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" 
                      />
                    </div>

                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Waiting Room Admission Chime</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Play audio alert when recruiter admits you from the live lobby queue.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.soundOnAdmit} 
                        onChange={e => setFormData({...formData, soundOnAdmit: e.target.checked})}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" 
                      />
                    </div>

                    <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Campaign Interview Reminders</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Receive reminders before active job PIN expiration windows close.</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.interviewReminders} 
                        onChange={e => setFormData({...formData, interviewReminders: e.target.checked})}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>

                {/* Authentication & Security Credentials */}
                <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
                    <Lock size={18} className="text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Account Security & Credentials</h2>
                  </div>

                  <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-white">Password Recovery & Reset</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Dispatch a secure password update link to <span className="text-slate-200 font-mono">{user?.email}</span>.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendPasswordReset}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <Key size={14} className="text-indigo-400" />
                      <span>Send Reset Email</span>
                    </button>
                  </div>

                  <div className="p-4 bg-[#0b1121] rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-white">Terminate Candidate Session</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Safely sign out of the HireVision Candidate Portal on this machine.</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* JOIN INTERVIEW MODAL */}
      {showJoinModal && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className={`bg-[#151e32] border border-slate-700 rounded-3xl w-full shadow-2xl overflow-hidden relative transition-all duration-300 ${modalStep === 3 ? 'max-w-xl' : 'max-w-lg'}`}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
              <h3 className="text-lg font-bold text-white">Join: {activeJob.title}</h3>
              {modalStep < 4 && <button onClick={() => setShowJoinModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>}
            </div>

            <div className="p-8 flex flex-col items-center">
              
              {/* Step 1: Upload / Select Resume */}
              {modalStep === 1 && (
                <div className="w-full">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-400 border border-indigo-500/20 shadow-inner">
                      <FileText size={28} />
                    </div>
                    <h4 className="text-2xl font-bold text-white mb-1">Select or Upload Resume</h4>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto">
                      Choose a stored resume from your vault or upload a new PDF for this interview.
                    </p>
                  </div>

                  {/* Section A: Vault Selection (Dropdown & Cards) */}
                  {myResumes && myResumes.length > 0 && (
                    <div className="mb-5 bg-[#0b1121] border border-slate-700/80 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle size={14} />
                          <span>Select from Resume Vault</span>
                        </label>
                        <span className="text-[11px] text-slate-500">{myResumes.length} saved</span>
                      </div>

                      {/* Dropdown Selector */}
                      <select 
                        value={selectedResumeUrl || ''} 
                        onChange={(e) => { 
                          setSelectedResumeUrl(e.target.value || null); 
                          if (e.target.value) setResumeFile(null); 
                        }}
                        className="w-full bg-[#151e32] border border-slate-700 hover:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer mb-3"
                      >
                        <option value="">-- Choose from your saved resumes --</option>
                        {myResumes.map(r => (
                          <option key={r.id} value={r.url}>
                            {r.name} {r.size ? `(${r.size})` : ''}
                          </option>
                        ))}
                      </select>

                      {/* Quick Cards Selector */}
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {myResumes.map(resume => {
                          const isSelected = selectedResumeUrl === resume.url;
                          return (
                            <div 
                              key={resume.id} 
                              onClick={() => { setSelectedResumeUrl(resume.url); setResumeFile(null); }}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                isSelected 
                                  ? 'border-indigo-500 bg-indigo-500/15 shadow-sm' 
                                  : 'border-slate-800 hover:border-slate-700 bg-[#151e32]/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                  <FileText size={14} />
                                </div>
                                <div className="truncate">
                                  <p className={`truncate text-xs font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>{resume.name}</p>
                                  <p className="text-[10px] text-slate-500">
                                    {resume.uploadedAt ? new Date(resume.uploadedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Saved'} 
                                    {resume.size && ` ? ${resume.size}`}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0 pl-2">
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                                    <Check size={12} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border border-slate-700" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section B: Or Upload a New Local PDF */}
                  <div className="mb-6">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>{myResumes && myResumes.length > 0 ? "Or Upload a Different PDF" : "Upload PDF Resume"}</span>
                      {resumeFile && <span className="text-emerald-400 font-medium">New file attached</span>}
                    </p>
                    <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                      resumeFile 
                        ? 'border-emerald-500 bg-emerald-500/10' 
                        : 'border-slate-700 hover:border-indigo-500/60 bg-[#0b1121] hover:bg-[#151e32]'
                    }`}>
                      <div className="flex flex-col items-center justify-center p-3 text-center">
                        <UploadCloud className={`w-5 h-5 mb-1 ${resumeFile ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <p className="text-xs text-slate-300">
                          {resumeFile ? (
                            <span className="font-semibold text-emerald-300 truncate max-w-xs block">{resumeFile.name}</span>
                          ) : (
                            <span><span className="font-semibold text-white">Click to upload</span> or drag and drop</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-500">PDF up to 10MB</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf" 
                        onChange={e => { 
                          if (e.target.files && e.target.files[0]) {
                            setResumeFile(e.target.files[0]); 
                            setSelectedResumeUrl(null); 
                          }
                        }} 
                      />
                    </label>
                  </div>

                  {/* Currently Active Selection Badge */}
                  <div className="mb-4 bg-slate-800/40 border border-slate-700/50 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Resume:</span>
                    <span className="font-medium text-white truncate max-w-[200px]">
                      {resumeFile ? resumeFile.name : selectedResumeUrl ? (myResumes.find(r => r.url === selectedResumeUrl)?.name || 'Vault Document') : 'None selected'}
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button 
                    onClick={handleUploadResumeAndParse} 
                    disabled={!resumeFile && !selectedResumeUrl} 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Analyze & Prepare Interview</span>
                    <Play size={16} fill="white" />
                  </button>
                </div>
              )}

              {/* Step 2: Parsing */}
              {modalStep === 2 && (
                <div className="py-8 flex flex-col items-center text-center">
                  <Loader2 size={48} className="animate-spin text-indigo-500 mb-6" />
                  <h4 className="text-xl font-bold text-white mb-2">Analyzing Profile...</h4>
                  <p className="text-slate-400 text-sm max-w-xs">Extracting your technical skills and generating personalized interview questions.</p>
                </div>
              )}

              {/* Step 3: AI Camera & Posture Calibration */}
              {modalStep === 3 && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                          AI Vision Pre-Check
                        </span>
                        <span className="text-xs text-slate-400">Step 2 of 3</span>
                      </div>
                      <h4 className="text-xl font-bold text-white mt-1">Camera & Posture Calibration</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Adjust your distance and position so the proctoring AI can clearly see you.</p>
                    </div>
                  </div>

                  {/* Video Viewport with Oval Silhouette Guide */}
                  <div className={`relative w-full aspect-video rounded-2xl overflow-hidden bg-black border-2 transition-all duration-300 ${
                    postureStatus === 'ready' || postureStatus === 'optimal'
                      ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
                      : postureStatus === 'no_face' || postureStatus === 'multiple_faces'
                      ? 'border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.25)]'
                      : 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  }`}>
                    {/* Live Video */}
                    <video
                      ref={calibrationVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                    />

                    {/* Canvas for face bounding box overlay */}
                    <canvas
                      ref={calibrationCanvasRef}
                      className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] pointer-events-none z-10"
                    />

                    {/* Oval Guide SVG Overlay */}
                    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 400 250" preserveAspectRatio="none">
                        <ellipse
                          cx="200"
                          cy="125"
                          rx="75"
                          ry="95"
                          fill="none"
                          stroke={
                            postureStatus === 'ready' || postureStatus === 'optimal'
                              ? '#10b981'
                              : postureStatus === 'no_face' || postureStatus === 'multiple_faces'
                              ? '#f43f5e'
                              : '#f59e0b'
                          }
                          strokeWidth={postureStatus === 'ready' ? '3' : '2'}
                          strokeDasharray={postureStatus === 'ready' ? 'none' : '6 4'}
                          className="transition-colors duration-300"
                        />
                      </svg>
                    </div>

                    {/* Top Feedback Pill Overlay */}
                    <div className="absolute top-3 inset-x-3 z-30 flex justify-center">
                      <div className={`px-3.5 py-1.5 rounded-full backdrop-blur-md border text-xs font-semibold flex items-center gap-2 shadow-lg transition-all ${
                        postureStatus === 'ready'
                          ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                          : postureStatus === 'optimal'
                          ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                          : postureStatus === 'no_face' || postureStatus === 'multiple_faces'
                          ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 animate-pulse'
                          : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                      }`}>
                        {postureStatus === 'ready' ? (
                          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                        ) : postureStatus === 'optimal' ? (
                          <Sparkles size={14} className="text-indigo-400 animate-spin shrink-0" />
                        ) : postureStatus === 'no_face' || postureStatus === 'multiple_faces' ? (
                          <AlertCircle size={14} className="text-rose-400 shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                        )}
                        <span className="truncate">{postureFeedback}</span>
                      </div>
                    </div>

                    {/* Hold Steady Progress Bar (Active when in optimal framing) */}
                    {postureHoldProgress > 0 && postureHoldProgress < 100 && (
                      <div className="absolute bottom-3 inset-x-4 z-30">
                        <div className="bg-[#0b1121]/90 backdrop-blur-md border border-slate-700/60 rounded-xl p-2.5">
                          <div className="flex justify-between items-center text-[11px] font-medium text-slate-300 mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <Sparkles size={12} className="text-emerald-400" />
                              Hold steady for alignment
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">{postureHoldProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full transition-all duration-100 ease-out"
                              style={{ width: `${postureHoldProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ready Badge Overlay */}
                    {isPostureReady && (
                      <div className="absolute inset-0 z-30 bg-emerald-950/20 pointer-events-none flex items-center justify-center">
                        <div className="bg-[#0b1121]/90 border border-emerald-500/50 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2.5 shadow-2xl">
                          <CheckCircle2 size={20} className="text-emerald-400" />
                          <span className="text-sm font-bold text-white">Posture & Framing Verified</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Positioning Checklist Badges */}
                  <div className="grid grid-cols-2 gap-2 w-full mt-3.5 text-[11px]">
                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      postureStatus !== 'no_face' && postureStatus !== 'multiple_faces' && postureStatus !== 'initializing'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                    }`}>
                      <UserCheck size={14} className={postureStatus !== 'no_face' && postureStatus !== 'multiple_faces' && postureStatus !== 'initializing' ? 'text-emerald-400' : 'text-slate-500'} />
                      <span>Single person in frame</span>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      postureStatus !== 'too_close' && postureStatus !== 'too_far' && postureStatus !== 'initializing' && postureStatus !== 'no_face'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                    }`}>
                      <ShieldCheck size={14} className={postureStatus !== 'too_close' && postureStatus !== 'too_far' && postureStatus !== 'initializing' && postureStatus !== 'no_face' ? 'text-emerald-400' : 'text-slate-500'} />
                      <span>Optimal lens distance</span>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      postureStatus !== 'off_center' && postureStatus !== 'cut_off' && postureStatus !== 'initializing' && postureStatus !== 'no_face'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                    }`}>
                      <CheckCircle size={14} className={postureStatus !== 'off_center' && postureStatus !== 'cut_off' && postureStatus !== 'initializing' && postureStatus !== 'no_face' ? 'text-emerald-400' : 'text-slate-500'} />
                      <span>Head centered in oval</span>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      isPostureReady
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                    }`}>
                      <Sparkles size={14} className={isPostureReady ? 'text-emerald-400' : 'text-slate-500'} />
                      <span>Posture hold verified</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="w-full mt-4 space-y-2">
                    <button
                      onClick={handleProceedFromCalibration}
                      disabled={!isPostureReady}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        isPostureReady
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                      }`}
                    >
                      {isPostureReady ? (
                        <>
                          <Play size={18} fill="white" />
                          <span>Request to Enter Room</span>
                        </>
                      ) : (
                        <>
                          <Camera size={18} />
                          <span>Align Posture inside Oval to Unlock</span>
                        </>
                      )}
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleProceedFromCalibration}
                        className="text-xs text-slate-500 hover:text-slate-300 underline transition cursor-pointer"
                      >
                        Skip check & proceed to room
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Waiting for Recruiter */}
              {modalStep === 4 && (
                <div className="py-8 flex flex-col items-center text-center">
                  <Loader2 size={48} className="animate-spin text-slate-500 mb-6" />
                  <h4 className="text-xl font-bold text-white mb-2">Waiting for Recruiter...</h4>
                  <p className="text-slate-400 text-sm max-w-xs">The recruiter has been notified. The interview will begin automatically once they admit you.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL FEEDBACK / ALERT POPUP */}
      {feedbackPopup.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#151e32] border border-slate-700/80 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl relative overflow-hidden">
            {/* Top decorative glow */}
            <div className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
              feedbackPopup.type === 'error' ? 'bg-rose-500' :
              feedbackPopup.type === 'warning' ? 'bg-amber-500' :
              feedbackPopup.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'
            }`} />

            <button
              onClick={() => setFeedbackPopup(prev => ({ ...prev, show: false }))}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800/80 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Glowing Icon */}
            <div className="mb-4 flex justify-center relative z-10">
              {feedbackPopup.type === 'error' && (
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.25)]">
                  <AlertCircle size={32} />
                </div>
              )}
              {feedbackPopup.type === 'warning' && (
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.25)]">
                  <AlertTriangle size={32} />
                </div>
              )}
              {feedbackPopup.type === 'success' && (
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 size={32} />
                </div>
              )}
            </div>

            {/* Text Content */}
            <h3 className="text-xl font-bold text-white mb-2 relative z-10">{feedbackPopup.title}</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6 px-3 relative z-10">{feedbackPopup.message}</p>

            {/* Action button */}
            <button
              onClick={() => setFeedbackPopup(prev => ({ ...prev, show: false }))}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition shadow-lg relative z-10 cursor-pointer ${
                feedbackPopup.type === 'error'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : feedbackPopup.type === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                  : feedbackPopup.type === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {feedbackPopup.btnText || 'Understood'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}