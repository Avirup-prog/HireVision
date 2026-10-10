import React, { useState, useRef, useEffect } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { 

  Video, Mic, MicOff, VideoOff, Settings, PhoneOff, LayoutDashboard, 

  Users, Briefcase, LineChart, Settings as SettingsIcon,

  Clock, Edit2, Trash2, Flag, CheckCircle2, ChevronDown, 

  Bell, Activity, ArrowUpRight, Play, CheckSquare

} from 'lucide-react';

import { auth, db } from '../firebase';

import { doc, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore';

export default function CandidateInterview() {

  const location = useLocation();

  const navigate = useNavigate();
  
  // Store the raw question objects (with expected_signals, etc) for the backend evaluation later
  const [rawQuestions] = useState(() => location.state?.generatedQuestions || []);

  const [questions, setQuestions] = useState(() => {
    const generated = location.state?.generatedQuestions || [];
    
    // Extract just the text for the UI, handling both string fallbacks and the new object format
    const parsedTextQuestions = generated.length > 0 
      ? generated.map(q => typeof q === 'string' ? q : q.text)
      : [
          "Tell me about a time you had to learn a new technology quickly.",
          "Can you explain your experience with React and Node.js?",
          "How do you handle disagreements with team members?"
        ];

    return [
      "Hello! I am the HireVision AI recruiter. To start us off, could you briefly introduce yourself and tell me a bit about your background?",
      ...parsedTextQuestions
    ];
  });
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Proctoring States
  const [proctoringFlags, setProctoringFlags] = useState([]);
  const [proctorStatus, setProctorStatus] = useState('initializing'); // initializing, active, warning
  const animationFrameId = useRef(null);

  const [micEnabled, setMicEnabled] = useState(true);

  const [videoEnabled, setVideoEnabled] = useState(true);

  const [showEndWarning, setShowEndWarning] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState(Array(questions.length).fill(""));

  const [currentTranscript, setCurrentTranscript] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);

  const [timeLeft, setTimeLeft] = useState(180);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(""); 

  const recognitionRef = useRef(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0) {
        const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha')));
        setSelectedVoiceURI(prev => prev || (preferred ? preferred.voiceURI : voices[0].voiceURI));
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {

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

           const newTranscript = final ? prev + " " + final : prev;

           if (interim) {

             const subtitleEl = document.getElementById('subtitle-text');

             if (subtitleEl) subtitleEl.innerText = (newTranscript + " " + interim).trim();

           }

           return newTranscript;

        });

      };

      recognition.onerror = (event) => {

        console.error("Speech recognition error", event.error);

        if (event.error === 'not-allowed') {

          console.warn("Microphone access denied for Speech Recognition.");

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

    useEffect(() => {
    if (micEnabled && !isAISpeaking && recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch(e) {}
    } else if ((!micEnabled || isAISpeaking) && recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch(e) {}
    }
  }, [micEnabled, isListening, isAISpeaking]);

  
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const textToSpeak = questions[currentIndex];
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
      
      utterance.rate = 0.95;
      
      utterance.onstart = () => setIsAISpeaking(true);
      utterance.onend = () => setIsAISpeaking(false);
      utterance.onerror = () => setIsAISpeaking(false);
      
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      
      const speakTimer = setTimeout(() => {
         window.speechSynthesis.speak(utterance);
      }, 500);
      
      return () => {
         clearTimeout(speakTimer);
         window.speechSynthesis.cancel();
      };
    }
  }, [currentIndex, questions, selectedVoiceURI]);
  
  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);

      return () => clearTimeout(timerId);

    }

  }, [timeLeft]);

  useEffect(() => {

    let stream;

    const startCamera = async () => {

      try {

        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        if (videoRef.current) {

          videoRef.current.srcObject = stream;

        }

      } catch (err) {

        console.error("Camera access denied", err);

      }

    };

    startCamera();

    return () => {

      if (stream) {

        stream.getTracks().forEach(track => track.stop());

      }

      if (recognitionRef.current) {

        try {

          recognitionRef.current.stop();

        } catch(e) {}

      }

    };

  }, []);

  
  useEffect(() => {
    initProctoringAI();
  }, []);

  const initProctoringAI = async () => {
    setProctorStatus('initializing');
    
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = "anonymous";
        script.onload = () => { console.log(`Loaded: ${src}`); resolve(); };
        script.onerror = () => { console.error(`Failed: ${src}`); reject(new Error(`Failed to load ${src}`)); };
        document.head.appendChild(script);
      });
    };

    try {
      console.log("1. Injecting TFJS...");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
      console.log("2. Injecting BlazeFace...");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface");
      
      console.log("3. Starting model download...");
      // Timeout wrapper for blazeface.load()
      const loadModel = () => Promise.race([
        window.blazeface.load(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Model download timeout (10s)")), 10000))
      ]);
      const model = await loadModel();
      console.log("4. Model loaded successfully!");
      setProctorStatus('active');
      detectFaces(model);
    } catch (e) {
      console.error("Failed to load CV model:", e);
      setProctorStatus('error');
    }
  };

  const detectFaces = async (model) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Ensure canvas matches video dimensions
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    try {
      const predictions = await model.estimateFaces(video, false);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (predictions.length === 0) {
        setProctorStatus('warning');
        if (Math.random() < 0.05) { // Throttle logs
          setProctoringFlags(prev => [...prev, { time: new Date().toLocaleTimeString(), issue: 'No face detected in frame' }]);
        }
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ef4444';
        ctx.font = '24px sans-serif';
        ctx.fillText('NO FACE DETECTED', canvas.width/2 - 100, canvas.height/2);
      } else if (predictions.length > 1) {
        setProctorStatus('warning');
        if (Math.random() < 0.05) {
          setProctoringFlags(prev => [...prev, { time: new Date().toLocaleTimeString(), issue: 'Multiple faces detected' }]);
        }
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        setProctorStatus('active');
      }
      
      // Draw Bounding Boxes and Landmarks
      predictions.forEach(prediction => {
        const start = prediction.topLeft;
        const end = prediction.bottomRight;
        const size = [end[0] - start[0], end[1] - start[1]];
        
        // Draw Box
        ctx.strokeStyle = predictions.length > 1 ? '#ef4444' : '#10b981'; // Red if > 1, Green if 1
        ctx.lineWidth = 4;
        ctx.strokeRect(start[0], start[1], size[0], size[1]);
        
        // Draw Landmarks
        ctx.fillStyle = '#3b82f6';
        prediction.landmarks.forEach(landmark => {
          ctx.beginPath();
          ctx.arc(landmark[0], landmark[1], 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      });
      
    } catch (e) {
      console.error(e);
    }
    
    animationFrameId.current = requestAnimationFrame(() => detectFaces(model));
  };

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

  const handleEndInterview = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    setShowEndWarning(true);

  };

  const confirmEnd = async () => {

    if (videoRef.current && videoRef.current.srcObject) {

      videoRef.current.srcObject.getTracks().forEach(track => track.stop());

    }

    if (location.state?.requestId) {
      try {
        await updateDoc(doc(db, 'interview_requests', location.state.requestId), {
          status: 'aborted'
        });
      } catch (err) {
        console.error("Error updating status to aborted:", err);
      }
    }

    navigate('/candidate/profile');

  };

  const handleNextQuestion = async () => {

    const subtitleEl = document.getElementById('subtitle-text');

    let finalAnswer = subtitleEl ? subtitleEl.innerText : currentTranscript;
    
    setIsProcessingAnswer(true);
    try {
        const response = await fetch('http://127.0.0.1:8000/api/clean-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: finalAnswer })
        });
        if (response.ok) {
            const data = await response.json();
            finalAnswer = data.cleaned;
        }
    } catch(e) {
        console.error("Autocorrect failed, using raw transcript");
    }
    setIsProcessingAnswer(false);

    const newAnswers = [...answers];

    newAnswers[currentIndex] = finalAnswer;

    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {

      setCurrentIndex(currentIndex + 1);

      setCurrentTranscript("");

      if (subtitleEl) subtitleEl.innerText = "";

      setTimeLeft(180); 

      if (recognitionRef.current) {

        try {

          recognitionRef.current.stop();

        } catch(e) {}

      }

    } else {

      try {

        const user = auth.currentUser;

        if (user) {

                    await addDoc(collection(db, 'interviews'), {
            candidateName: user.displayName || "Unknown Candidate",
            candidateUid: user.uid,
            recruiterId: location.state?.recruiterId || null,
            jobId: location.state?.jobId || null,
            jobTitle: location.state?.jobTitle || null,
            requestId: location.state?.requestId || null,
            questions: rawQuestions,
            uiQuestions: questions,
            answers: newAnswers,
            completedAt: new Date().toISOString()
          });

        }

        if (location.state?.requestId) {
          await updateDoc(doc(db, 'interview_requests', location.state.requestId), {
            status: 'completed'
          });
        }

        if (videoRef.current && videoRef.current.srcObject) {

          videoRef.current.srcObject.getTracks().forEach(track => track.stop());

        }

        alert("Interview Complete! Your answers have been securely submitted to the recruiter.");

        navigate('/candidate/profile');

      } catch (err) {

        console.error(err);

        alert("Error saving interview: " + err.message);

      }

    }

  };

  const formatTime = (seconds) => {

    const m = Math.floor(seconds / 60);

    const s = seconds % 60;

    return `${m}:${s < 10 ? '0' : ''}${s}`;

  };

  return (

    <div className="h-screen w-full bg-[#0b1121] text-slate-300 flex font-sans overflow-hidden">

      <aside className="w-64 border-r border-slate-800/60 bg-[#0b1121] p-4 flex flex-col">

        <div className="flex items-center gap-3 mb-12 px-2 mt-2">

          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">

            <Video size={16} strokeWidth={2.5} />

          </div>

          <h1 className="text-xl font-bold tracking-wide text-white">HireVision AI</h1>

        </div>

        <nav className="flex-1 space-y-2">

          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />

          <NavItem icon={<Users size={20} />} label="Candidates" />

          <NavItem icon={<Briefcase size={20} />} label="Interviews" />

          <NavItem icon={<LineChart size={20} />} label="Insights" />

        </nav>

        <div className="mt-auto">

          <NavItem icon={<SettingsIcon size={20} />} label="Settings" />

        </div>

      </aside>

      <main className="flex-1 flex flex-col h-full bg-[#0f1524]">

        <header className="h-[88px] border-b border-slate-800/60 flex items-center justify-between px-8 bg-[#0b1121]">

          <div className="flex items-center gap-16">

            <div>

              <p className="text-[11px] text-slate-500 mb-1">Interview Title</p>

              <h2 className="text-[17px] font-semibold text-slate-200">AI Recruiter Evaluation</h2>

            </div>

            <div>

              <p className="text-[11px] text-slate-500 mb-1">Overall Progress</p>

              <p className="text-[15px] font-mono"><span className="text-indigo-400 font-bold">Q{currentIndex + 1}</span> <span className="text-slate-500">of {questions.length}</span></p>

            </div>

          </div>

          <div className="flex items-center gap-4">
            
            <div className="flex items-center bg-slate-800/40 rounded-lg px-3 py-1.5 border border-slate-700/50">
               <span className="text-xs text-slate-400 mr-2 font-medium">Voice:</span>
               <select 
                 className="bg-transparent text-sm text-slate-200 outline-none w-32 xl:w-48 truncate cursor-pointer appearance-none"
                 value={selectedVoiceURI}
                 onChange={(e) => setSelectedVoiceURI(e.target.value)}
               >
                 {availableVoices.filter(v => v.lang.startsWith('en')).map(v => (
                    <option key={v.voiceURI} value={v.voiceURI} className="bg-[#0b1121] text-white">
                       {v.name.replace('Microsoft ', '').replace(' Desktop', '').replace('English ', '')}
                    </option>
                 ))}
               </select>
            </div>

            <div className="flex items-center gap-2 bg-transparent hover:bg-slate-800/50 transition py-1.5 px-3 rounded-full cursor-pointer">

              <img src={`https://ui-avatars.com/api/?name=${auth.currentUser?.displayName || 'User'}&background=1e293b&color=fff`} alt="User" className="w-7 h-7 rounded-full" />

              <span className="text-sm text-slate-300">{auth.currentUser?.displayName || 'Candidate'}</span>

            </div>

          </div>

        </header>

        <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-3 gap-6 overflow-y-auto">

          <div className="xl:col-span-2 flex flex-col gap-6">

            <div className="relative bg-[#0b1121] rounded-2xl border border-slate-800/80 flex items-center justify-center overflow-hidden h-[460px]">

              <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${!videoEnabled && 'opacity-0'}`}></video>
<canvas ref={canvasRef} className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] pointer-events-none z-10 ${!videoEnabled && 'opacity-0'}`} />

{/* Proctoring UI Overlay */}
<div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
  <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold backdrop-blur-md flex items-center gap-2 ${
    proctorStatus === 'initializing' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
    proctorStatus === 'active' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
    'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
  }`}>
    {proctorStatus === 'initializing' ? 'Loading AI Brain...' : proctorStatus === 'active' ? 'AI Proctor Active' : proctorStatus === 'error' ? 'AI Loading Failed' : 'WARNING: Violation'}
  </div>
</div>


              <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#151e32]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs font-medium z-10">

                <span className="text-slate-300">Live Feed</span>

                <div className="w-[1px] h-3 bg-slate-600 mx-1"></div>

                <span className="text-red-400 flex items-center gap-1.5">

                  <span className={`w-1.5 h-1.5 rounded-full ${videoEnabled ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></span>

                  {videoEnabled ? 'Rec' : 'Paused'}

                </span>

              </div>

              {!videoEnabled && (

                <div className="text-slate-600 flex flex-col items-center z-10">

                  <VideoOff className="w-12 h-12 mb-3 opacity-20" />

                  <p className="text-sm">Webcam Disabled</p>

                </div>

              )}

              {micEnabled && (

                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-4/5 bg-black/60 backdrop-blur-md px-6 py-4 rounded-xl border border-slate-700/50 z-10 shadow-2xl">

                  <p className="text-xs text-indigo-400 font-semibold mb-1 flex items-center gap-2">

                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>

                    Live Transcript

                  </p>

                  <p id="subtitle-text" className="text-sm text-slate-100 italic leading-relaxed min-h-[40px] max-h-[80px] overflow-y-auto custom-scrollbar">

                    {currentTranscript || "Listening..."}

                  </p>

                </div>

              )}

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0b1121]/90 backdrop-blur-xl px-2 py-2 rounded-2xl border border-slate-700/50 z-20">

                <ControlButton onClick={toggleMic} icon={micEnabled ? <Mic size={18} /> : <MicOff size={18} />} label="Mic" isActive={micEnabled} />

                <ControlButton onClick={toggleVideo} icon={videoEnabled ? <Video size={18} /> : <VideoOff size={18} />} label="Video" isActive={videoEnabled} />

                <ControlButton icon={<Settings size={18} />} label="Settings" />

                <div className="w-[1px] h-8 bg-slate-800 mx-1"></div>

                <button onClick={handleEndInterview} className="flex flex-col items-center gap-1 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-xl transition">

                  <PhoneOff size={18} />

                  <span className="text-[10px]">End</span>

                </button>

              </div>

            </div>

            <div>

              <h3 className="text-[13px] font-semibold text-slate-200 mb-3">Real-Time Analysis Metrics (Preview)</h3>

              <div className="grid grid-cols-4 gap-4">

                <MetricCard title="1. Sentiment" value="88%" status="Positive" color="text-emerald-400" bg="bg-emerald-500" icon={<Activity size={14}/>} />

                <MetricCard title="2. Engagement" value="79%" status="High" color="text-blue-400" bg="bg-blue-500" icon={<ArrowUpRight size={14}/>} />

                <div className="bg-[#151e32] p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between h-28">

                  <div className="flex justify-between items-start">

                    <p className="text-[11px] text-slate-400">3. Clarity & Tone</p>

                    <Activity size={14} className="text-purple-400 opacity-50" />

                  </div>

                  <p className="text-xs font-semibold text-slate-200 mb-1">Focused</p>

                  <div className="flex justify-between items-end mt-auto">

                    <p className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Articulate</p>

                    <p className="text-lg font-bold text-white">75%</p>

                  </div>

                </div>

                <div className="bg-[#151e32] p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between h-28">

                  <div className="flex justify-between items-start">

                    <p className="text-[11px] text-slate-400">4. Non-Verbal Cues</p>

                    <Users size={14} className="text-teal-400 opacity-50" />

                  </div>

                  <p className="text-xs font-semibold text-slate-200 mb-1">Attentive</p>

                  <div className="flex justify-between items-end mt-auto">

                    <p className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">Attentive</p>

                    <p className="text-lg font-bold text-white">82%</p>

                  </div>

                </div>

              </div>

            </div>

          </div>

          <div className="flex flex-col h-[630px]">

            <div className="flex justify-between items-end mb-3 px-1">

              <h2 className="text-[14px] font-semibold text-slate-200">Current Question</h2>

              <span className={`text-xs font-bold px-2 py-1 rounded ${timeLeft < 30 ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'}`}>

                {formatTime(timeLeft)} left

              </span>

            </div>

            <div className="bg-[#111827] rounded-2xl border border-indigo-500/30 p-6 flex flex-col flex-1 relative shadow-[0_0_30px_rgba(79,70,229,0.05)]">

              <div className="absolute top-0 left-0 w-full h-1 bg-slate-800 rounded-t-2xl overflow-hidden">

                 <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${((180 - timeLeft) / 180) * 100}%` }}></div>

              </div>

              <div className="flex items-center gap-3 mb-6">

                 <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">

                    <span className="text-indigo-400 font-bold">Q{currentIndex + 1}</span>

                 </div>

                 <p className="text-sm text-slate-400">Focus on providing a clear, structured answer.</p>

              </div>

              <div className="flex-1">

                <h3 className="text-lg text-white font-medium leading-relaxed mb-6">

                  {questions[currentIndex]}

                </h3>

                <div className="bg-[#0b1121] border border-slate-800 p-4 rounded-xl">

                   <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Your Answer Preview</p>

                   <p className="text-sm text-slate-300 italic">

                     {currentTranscript || "Speak to begin answering..."}

                   </p>

                </div>

              </div>

              <button 
                onClick={handleNextQuestion}
                disabled={isProcessingAnswer}
                className={`w-full py-4 mt-6 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg ${isProcessingAnswer ? 'bg-slate-600 cursor-not-allowed opacity-70' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}>
                {isProcessingAnswer ? (
                  <>Auto-correcting transcript...</>
                ) : currentIndex < questions.length - 1 ? (
                  <>Next Question <Play size={18} fill="white" /></>
                ) : (
                  <>Submit Interview <CheckSquare size={18} /></>
                )}
              </button>

            </div>

          </div>

        </div>

      </main>

      {showEndWarning && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">

          <div className="bg-[#151e32] border border-slate-700 p-6 rounded-2xl max-w-md w-full shadow-2xl">

            <h3 className="text-xl font-bold text-white mb-2">End Interview?</h3>

            <p className="text-slate-400 text-sm mb-6">Are you sure you want to end this interview? Your progress will be lost and your interview will be marked incomplete.</p>

            <div className="flex justify-end gap-3">

              <button onClick={() => setShowEndWarning(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 font-medium text-sm transition">Cancel</button>

              <button onClick={confirmEnd} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition shadow-lg shadow-red-500/20">Yes, End</button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

function NavItem({ icon, label, active = false }) {

  return (

    <a href="#" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>

      {icon}

      <span className="text-[13px]">{label}</span>

    </a>

  );

}

function ControlButton({ icon, label, onClick, isActive = true }) {

  return (

    <button onClick={onClick} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${isActive ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'}`}>

      {icon}

      <span className="text-[10px]">{label}</span>

    </button>

  );

}

function MetricCard({ title, value, status, color, bg, icon }) {

  return (

    <div className="bg-[#151e32] p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between h-28">

      <div className="flex justify-between items-start">

        <p className="text-[11px] text-slate-400">{title}</p>

        <span className={`${color} opacity-50`}>{icon}</span>

      </div>

      <p className="text-[22px] font-bold text-white mb-1 leading-none">{value}</p>

      <div className="flex justify-between items-end mt-auto">

        <p className={`text-[10px] ${color} bg-slate-800/80 px-2 py-0.5 rounded`}>{status}</p>

        <div className="flex gap-0.5 items-end h-4">

           {[40, 70, 45, 90, 60, 100].map((h, i) => (

             <div key={i} className={`w-1 rounded-t-sm ${bg}`} style={{ height: `${h}%` }}></div>

           ))}

        </div>

      </div>

    </div>

  );

}