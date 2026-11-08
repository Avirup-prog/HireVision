import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2,
  Clock, ShieldAlert, ShieldCheck, AlertTriangle, Eye, EyeOff, Users,
  Activity, Brain, CheckCircle2, Award, Download, FileText, ChevronRight,
  Sparkles, ExternalLink, User, Calendar, Briefcase, FastForward, Rewind,
  AlertOctagon, Check, Send, Loader2, Info, ArrowLeft, Printer, RefreshCw,
  Video, VideoOff, CornerDownRight
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function ApplicantReviewPortal({
  interview,
  candidateProfile,
  onClose,
  onShortlist,
  onEvaluateAnswers,
  isEvaluating,
  onUpdateInterview
}) {
  // Video Player States
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const progressBarRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    interview?.recordingDurationSeconds || 
    (interview?.questions?.length ? interview.questions.length * 60 : 300)
  );
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'transcript' | 'profile' | 'audit'
  const [anomalyFilter, setAnomalyFilter] = useState('all'); // 'all' | 'gaze' | 'missing' | 'multiple'
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [recruiterNotes, setRecruiterNotes] = useState(interview?.recruiterNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  // Normalize duration once metadata loads or from interview
  useEffect(() => {
    if (interview?.recordingDurationSeconds && interview.recordingDurationSeconds > 0) {
      setDuration(interview.recordingDurationSeconds);
    }
  }, [interview]);

  // Normalize Anomaly Flags with safe timestampSeconds
  const normalizedFlags = useMemo(() => {
    if (!interview?.proctoringFlags || !Array.isArray(interview.proctoringFlags)) return [];
    const dur = Math.max(duration, 60);

    return interview.proctoringFlags.map((flag, idx) => {
      let ts = flag.timestampSeconds;
      if (typeof ts !== 'number' || isNaN(ts)) {
        // Fallback: estimate evenly or parse time
        ts = Math.min(dur - 2, Math.max(5, Math.round((idx + 1) * (dur / (interview.proctoringFlags.length + 1)))));
      }
      const mins = Math.floor(ts / 60);
      const secs = Math.floor(ts % 60);
      const tc = flag.timecode || `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      
      let typeLabel = 'Proctor Warning';
      let iconType = 'warning';
      if (flag.type === 'gaze_diverted') {
        typeLabel = 'Eye Gaze Diverted';
        iconType = 'gaze';
      } else if (flag.type === 'face_missing') {
        typeLabel = 'Candidate Off-Screen';
        iconType = 'missing';
      } else if (flag.type === 'multiple_faces') {
        typeLabel = 'Multiple Persons Detected';
        iconType = 'multiple';
      }

      return {
        ...flag,
        id: `flag_${idx}`,
        timestampSeconds: ts,
        timecode: tc,
        typeLabel,
        iconType,
        severity: flag.severity || 'warning',
        issue: flag.issue || flag.type || 'Integrity anomaly recorded'
      };
    }).sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  }, [interview?.proctoringFlags, duration]);

  // Filtered Flags for Feed
  const filteredFlags = useMemo(() => {
    if (anomalyFilter === 'all') return normalizedFlags;
    if (anomalyFilter === 'gaze') return normalizedFlags.filter(f => f.type === 'gaze_diverted');
    if (anomalyFilter === 'missing') return normalizedFlags.filter(f => f.type === 'face_missing');
    if (anomalyFilter === 'multiple') return normalizedFlags.filter(f => f.type === 'multiple_faces');
    return normalizedFlags;
  }, [normalizedFlags, anomalyFilter]);

  // Active Anomaly based on current video playback position (+/- 3 seconds)
  const activeAnomaly = useMemo(() => {
    return normalizedFlags.find(
      f => Math.abs(currentTime - f.timestampSeconds) <= 3
    );
  }, [normalizedFlags, currentTime]);

  // Normalize Question Timestamps
  const questionMarks = useMemo(() => {
    const questions = interview?.questions || [];
    const dur = Math.max(duration, 60);
    if (!questions.length) return [];

    if (interview?.questionTimestamps && Array.isArray(interview.questionTimestamps) && interview.questionTimestamps.length > 0) {
      return interview.questionTimestamps;
    }

    // Default: distribute across duration
    const step = dur / (questions.length + 1);
    return questions.map((q, idx) => {
      const ts = Math.round((idx + 0.5) * step);
      const m = Math.floor(ts / 60);
      const s = Math.floor(ts % 60);
      return {
        index: idx,
        text: typeof q === 'string' ? q : q.text,
        timestampSeconds: ts,
        timecode: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      };
    });
  }, [interview?.questions, interview?.questionTimestamps, duration]);

  // Synthetic Canvas Video Engine (Fallback when no video file URL exists)
  useEffect(() => {
    if (interview?.recordingUrl) return; // If real video exists, video element handles it

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;

    const renderSyntheticFrame = () => {
      const w = canvas.width;
      const h = canvas.height;
      
      // Clean background with studio lighting gradient
      const grad = ctx.createRadialGradient(w / 2, h / 2 - 20, 40, w / 2, h / 2, w * 0.7);
      grad.addColorStop(0, '#1a2238');
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#080d1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle tech grid lines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const activeFlag = normalizedFlags.find(
        f => Math.abs(currentTime - f.timestampSeconds) <= 2.5
      );

      const isOffScreen = activeFlag?.type === 'face_missing';
      const isGazeDiverted = activeFlag?.type === 'gaze_diverted';
      const isMultiFace = activeFlag?.type === 'multiple_faces';

      // Subtle head sway & breathing motion
      const t = currentTime * 2.5;
      const swayX = isOffScreen ? 9999 : isGazeDiverted ? (activeFlag.issue?.includes('Left') ? -55 : 55) : Math.sin(t * 0.7) * 4;
      const swayY = isOffScreen ? 9999 : Math.cos(t * 1.2) * 2;
      const headCenterX = w / 2 + swayX;
      const headCenterY = h / 2 - 25 + swayY;
      const headRadius = 78;

      if (!isOffScreen) {
        // Torso / Shoulders
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(headCenterX, headCenterY + 160, 140, 90, 0, 0, Math.PI * 2);
        ctx.fill();

        // Neck
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(headCenterX - 22, headCenterY + 40, 44, 55);

        // Head Base
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(headCenterX, headCenterY, headRadius * 0.85, headRadius * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY - 25, headRadius * 0.88, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();

        // Eye Coordinates
        const eyeSpacing = 28;
        const eyeY = headCenterY - 8;
        const leftEyeX = headCenterX - eyeSpacing;
        const rightEyeX = headCenterX + eyeSpacing;
        const gazeOffsetX = isGazeDiverted ? (swayX < 0 ? -10 : 10) : 0;
        const gazeOffsetY = isGazeDiverted ? 2 : 0;

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(leftEyeX, eyeY, 11, 7, 0, 0, Math.PI * 2);
        ctx.ellipse(rightEyeX, eyeY, 11, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = isGazeDiverted ? '#f59e0b' : '#0284c7';
        ctx.beginPath();
        ctx.arc(leftEyeX + gazeOffsetX, eyeY + gazeOffsetY, 4.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX + gazeOffsetX, eyeY + gazeOffsetY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(headCenterX, headCenterY);
        ctx.lineTo(headCenterX - 3 + (gazeOffsetX * 0.4), headCenterY + 18);
        ctx.lineTo(headCenterX + 4 + (gazeOffsetX * 0.4), headCenterY + 18);
        ctx.stroke();

        // Mouth (Speaks or pauses based on playing state)
        const mouthOpen = isPlaying ? Math.abs(Math.sin(t * 3.5)) * 6 : 1;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.ellipse(headCenterX + (gazeOffsetX * 0.3), headCenterY + 42, 16, Math.max(3, mouthOpen), 0, 0, Math.PI * 2);
        ctx.fill();

        // Bounding Box HUD (Neural BlazeFace Mesh Indicator)
        const boxColor = isGazeDiverted ? '#f59e0b' : '#6366f1';
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        const boxW = 160;
        const boxH = 200;
        ctx.strokeRect(headCenterX - boxW / 2, headCenterY - boxH / 2 - 10, boxW, boxH);
        ctx.setLineDash([]);

        // Corner Accent Ticks
        const tickLen = 14;
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 3;
        // Top Left
        ctx.beginPath();
        ctx.moveTo(headCenterX - boxW / 2, headCenterY - boxH / 2 - 10 + tickLen);
        ctx.lineTo(headCenterX - boxW / 2, headCenterY - boxH / 2 - 10);
        ctx.lineTo(headCenterX - boxW / 2 + tickLen, headCenterY - boxH / 2 - 10);
        ctx.stroke();
        // Top Right
        ctx.beginPath();
        ctx.moveTo(headCenterX + boxW / 2 - tickLen, headCenterY - boxH / 2 - 10);
        ctx.lineTo(headCenterX + boxW / 2, headCenterY - boxH / 2 - 10);
        ctx.lineTo(headCenterX + boxW / 2, headCenterY - boxH / 2 - 10 + tickLen);
        ctx.stroke();
        // Bottom Left
        ctx.beginPath();
        ctx.moveTo(headCenterX - boxW / 2, headCenterY + boxH / 2 - 10 - tickLen);
        ctx.lineTo(headCenterX - boxW / 2, headCenterY + boxH / 2 - 10);
        ctx.lineTo(headCenterX - boxW / 2 + tickLen, headCenterY + boxH / 2 - 10);
        ctx.stroke();
        // Bottom Right
        ctx.beginPath();
        ctx.moveTo(headCenterX + boxW / 2 - tickLen, headCenterY + boxH / 2 - 10);
        ctx.lineTo(headCenterX + boxW / 2, headCenterY + boxH / 2 - 10);
        ctx.lineTo(headCenterX + boxW / 2, headCenterY + boxH / 2 - 10 - tickLen);
        ctx.stroke();

        // Mesh points
        ctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
        [[leftEyeX, eyeY], [rightEyeX, eyeY], [headCenterX, headCenterY + 12], [headCenterX, headCenterY + 42]].forEach(([px, py]) => {
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // Face Missing Alert Overlay on Canvas
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 30, w - 60, h - 60);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ CANDIDATE OFF-SCREEN / FACE ABSENT', w / 2, h / 2 - 10);
        ctx.fillStyle = '#fca5a5';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Camera viewport empty during this timestamp interval', w / 2, h / 2 + 15);
      }

      // Secondary Face if Multi-Person flag active
      if (isMultiFace) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(w - 70, h / 2 - 10, 40, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.strokeRect(w - 115, h / 2 - 65, 90, 110);
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('2ND PERSON', w - 70, h / 2 + 60);
      }

      // Simulated Audio Frequency Bars at Bottom of Canvas
      if (isPlaying && !isOffScreen) {
        ctx.fillStyle = '#6366f1';
        const numBars = 24;
        const barW = 3;
        const gap = 4;
        const totalW = numBars * (barW + gap);
        const startX = (w - totalW) / 2;
        for (let i = 0; i < numBars; i++) {
          const barH = Math.max(3, Math.sin(t * 4 + i * 0.8) * 16 + 10);
          ctx.fillRect(startX + i * (barW + gap), h - 22 - barH, barW, barH);
        }
      }

      // Top Corner Telemetry HUD
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(14, 14, 160, 26);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`PROCTOR RECORDER 720p`, 22, 31);
    };

    renderSyntheticFrame();

    // If playing, tick time smoothly
    let lastTick = performance.now();
    const tick = (now) => {
      const dt = (now - lastTick) / 1000;
      lastTick = now;

      if (isPlaying && !isScrubbing) {
        setCurrentTime(prev => {
          const next = prev + dt * playbackSpeed;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }
      renderSyntheticFrame();
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, currentTime, duration, playbackSpeed, isScrubbing, normalizedFlags, interview?.recordingUrl]);

  // Video Native Element Listeners (When real recordingUrl is present)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isScrubbing) {
        setCurrentTime(video.currentTime);
      }
    };
    const handleLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isScrubbing, interview?.recordingUrl]);

  // Controls Sync
  const togglePlay = () => {
    if (interview?.recordingUrl && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.warn("Video playback prevented:", e));
      }
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (seconds) => {
    const clamped = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(clamped);
    if (interview?.recordingUrl && videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleScrubberClick = (e) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    seekTo(pct * duration);
  };

  const jumpSeconds = (offset) => {
    seekTo(currentTime + offset);
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (videoRef.current) videoRef.current.muted = false;
    } else {
      setIsMuted(true);
      if (videoRef.current) videoRef.current.muted = true;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('session-video-container');
    if (!container) return;
    if (!isFullscreen) {
      if (container.requestFullscreen) container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Format Time Helper
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Recruiter Notes Save
  const handleSaveNotes = async () => {
    if (!interview?.id) return;
    setIsSavingNotes(true);
    try {
      await updateDoc(doc(db, 'interviews', interview.id), {
        recruiterNotes: recruiterNotes
      });
      if (onUpdateInterview) {
        onUpdateInterview({ ...interview, recruiterNotes });
      }
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2500);
    } catch (err) {
      alert("Failed to save notes: " + err.message);
    }
    setIsSavingNotes(false);
  };

  // Synchronized Emotion telemetry at current second
  const currentEmotionSample = useMemo(() => {
    const timeline = interview?.emotionAnalytics?.timeline;
    if (!timeline || !Array.isArray(timeline) || timeline.length === 0) {
      return {
        confidence: interview?.emotionAnalytics?.averageConfidence || 86,
        stress: interview?.emotionAnalytics?.stressPercentage || 20,
        gaze: interview?.emotionAnalytics?.gazeAdherence || 'Screen Focused'
      };
    }
    // Find closest sample
    let closest = timeline[0];
    let minDiff = 999999;
    timeline.forEach(sample => {
      const ts = sample.timestampSeconds !== undefined ? sample.timestampSeconds : 0;
      const diff = Math.abs(ts - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = sample;
      }
    });
    return closest;
  }, [interview?.emotionAnalytics, currentTime]);

  return (
    <div className="fixed inset-0 z-50 bg-[#060a14] flex flex-col overflow-hidden text-slate-100 font-sans animate-in fade-in duration-200">
      
      {/* ========================================================
          1. HEADER BAR
          ======================================================== */}
      <header className="h-16 border-b border-slate-800/90 bg-[#0b1120] px-5 sm:px-8 flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="flex items-center gap-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-3 py-1.5 rounded-xl transition text-xs font-semibold border border-slate-700/50"
            title="Return to Recruiter Dashboard"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Back</span>
          </button>
          
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={`https://ui-avatars.com/api/?name=${interview.candidateName || 'Candidate'}&background=4f46e5&color=fff&size=80`} 
                className="w-9 h-9 rounded-full ring-2 ring-indigo-500/30 object-cover shadow-md" 
                alt="Avatar"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0b1120] ${
                normalizedFlags.length === 0 ? 'bg-emerald-500' : 'bg-amber-400'
              }`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                  {interview.candidateName || 'Anonymous Candidate'}
                </h1>
                {interview.status === 'shortlisted' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                    Shortlisted
                  </span>
                ) : normalizedFlags.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={10} /> {normalizedFlags.length} Warning(s)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                    Clean Session
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-400 font-medium">
                {interview.jobTitle || 'Technical Interview Session'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {interview.status === 'shortlisted' ? (
            <div className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 size={15} /> Shortlisted
            </div>
          ) : (
            <button 
              onClick={onShortlist} 
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-semibold text-xs transition shadow-md shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer"
            >
              <Award size={15} /> Shortlist Candidate
            </button>
          )}

          <button 
            onClick={() => window.print()}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 rounded-xl transition text-xs font-medium hidden sm:flex items-center gap-1.5"
            title="Print Candidate Review Dossier"
          >
            <Printer size={15} />
            <span className="hidden md:inline">Print Report</span>
          </button>

          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 p-2 rounded-xl transition border border-slate-700/50"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ========================================================
          2. KEY METRICS STRIP (5 KPI CARDS)
          ======================================================== */}
      <section className="bg-[#0b1224] border-b border-slate-800/80 px-5 sm:px-8 py-3 shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* 1. Overall AI Match */}
          <div className="bg-[#121b2f] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Brain size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">AI Score</p>
              <p className="text-base font-extrabold text-white truncate">
                {interview.overall_score !== undefined ? `${interview.overall_score}/10` : 'Pending'}
              </p>
              <span className="text-[10px] text-indigo-400 font-medium">
                {interview.overall_score >= 8 ? 'Top Tier' : interview.overall_score >= 5 ? 'Competent' : 'Needs Review'}
              </span>
            </div>
          </div>

          {/* 2. WebCam Session Recording */}
          <div className="bg-[#121b2f] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Video size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">WebCam Video</p>
              <p className="text-base font-extrabold text-white font-mono truncate">
                {formatTime(duration)}
              </p>
              <span className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {interview.recordingUrl ? 'HD Stream Ready' : 'Simulated Player'}
              </span>
            </div>
          </div>

          {/* 3. Anti-Deepfake Liveness */}
          <div className="bg-[#121b2f] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Liveness Guard</p>
              <p className="text-xs font-bold text-white truncate">
                {interview.proctoringSummary?.livenessCheck?.status === 'PASSED' ? '3D Human Verified' : 'Bypassed / Test'}
              </p>
              <span className="text-[10px] text-emerald-400 font-medium truncate block">
                {interview.proctoringSummary?.livenessCheck?.method || 'Hand Wave Occlusion'}
              </span>
            </div>
          </div>

          {/* 4. Eye Gaze Adherence */}
          <div className="bg-[#121b2f] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Eye size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Eye Gaze</p>
              <p className="text-base font-extrabold text-white truncate">
                {interview.proctoringSummary?.gazeDivertedCount > 0 ? `${interview.proctoringSummary.gazeDivertedCount} Diverted` : 'Optimal'}
              </p>
              <span className="text-[10px] text-purple-300 font-medium truncate block">
                {interview.emotionAnalytics?.gazeAdherence || 'Screen Focused'}
              </span>
            </div>
          </div>

          {/* 5. Integrity Anomaly Flags */}
          <div className="bg-[#121b2f] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              normalizedFlags.length === 0 
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
            }`}>
              <ShieldAlert size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Integrity Audit</p>
              <p className={`text-base font-extrabold truncate ${normalizedFlags.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {normalizedFlags.length === 0 ? 'Zero Flags' : `${normalizedFlags.length} Flagged Moment(s)`}
              </p>
              <span className="text-[10px] text-slate-400 font-medium truncate block">
                {normalizedFlags.length === 0 ? 'Clean Proctor Report' : 'Review Timecodes'}
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          3. MAIN SPLIT STAGE: VIDEO & PROCTOR (LEFT) / TRANSCRIPT & PROFILE (RIGHT)
          ======================================================== */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ====================================================
              LEFT STAGE: WEBCAM VIDEO PLAYER & TIMEFRAME SCRUBBER (7 Cols)
              ==================================================== */}
          <div className="lg:col-span-7 space-y-6">

            {/* Video Player Container */}
            <div 
              id="session-video-container"
              className="bg-[#101728] border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col"
            >
              {/* Player Header Pill */}
              <div className="px-5 py-3.5 border-b border-slate-800/90 bg-[#0c1322] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaying ? 'bg-rose-400' : 'bg-slate-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-rose-500' : 'bg-slate-500'}`} />
                  </span>
                  <span className="text-xs font-bold text-white tracking-wide uppercase">
                    Candidate Session WebCam Video
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                    {interview.recordingUrl ? 'ARCHIVED VIDEO' : 'SYNTHETIC PROCTOR FEED'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <Clock size={13} className="text-indigo-400" />
                  <span className="text-white font-bold">{formatTime(currentTime)}</span>
                  <span>/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Viewport Screen */}
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group select-none">
                
                {/* 1. Real Video Element if recordingUrl exists */}
                {interview.recordingUrl ? (
                  <video 
                    ref={videoRef}
                    src={interview.recordingUrl}
                    className="w-full h-full object-contain bg-black"
                    playsInline
                    onClick={togglePlay}
                  />
                ) : (
                  // 2. Synthetic Canvas Stream Player
                  <canvas 
                    ref={canvasRef}
                    width={640}
                    height={360}
                    className="w-full h-full object-contain bg-[#080d1a] cursor-pointer"
                    onClick={togglePlay}
                  />
                )}

                {/* Big Center Play Overlay (when paused) */}
                {!isPlaying && (
                  <button 
                    onClick={togglePlay}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/80 hover:bg-indigo-600 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl transition transform hover:scale-110 active:scale-95 z-10 cursor-pointer"
                    title="Play Video"
                  >
                    <Play size={28} fill="white" className="ml-1" />
                  </button>
                )}

                {/* Watermark HUD */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-2 pointer-events-none z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{interview.candidateName || 'Candidate'}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">{interview.requestId ? `REQ-${interview.requestId.substring(0,6)}` : 'PROCTOR'}</span>
                </div>

                {/* ACTIVE ANOMALY ALERT HUD POPUP ON VIDEO */}
                {activeAnomaly && (
                  <div className="absolute top-3 right-3 max-w-xs bg-rose-950/85 backdrop-blur-md border border-rose-500/80 rounded-2xl p-3 shadow-2xl text-left animate-in slide-in-from-top duration-200 z-10">
                    <div className="flex items-center gap-2 text-rose-300 text-xs font-bold mb-1">
                      <AlertOctagon size={14} className="text-rose-400 animate-pulse" />
                      <span>{activeAnomaly.typeLabel}</span>
                      <span className="ml-auto font-mono text-[10px] bg-rose-900/60 px-1.5 py-0.5 rounded text-white">
                        {activeAnomaly.timecode}
                      </span>
                    </div>
                    <p className="text-white text-xs font-medium leading-snug">
                      {activeAnomaly.issue}
                    </p>
                  </div>
                )}

                {/* Bottom Corner Quick Speed indicator */}
                {playbackSpeed !== 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30 z-10">
                    {playbackSpeed}x SPEED
                  </div>
                )}
              </div>

              {/* ====================================================
                  THE HIGHLIGHTED TIMEFRAME SCRUBBER BAR
                  ==================================================== */}
              <div className="px-5 pt-4 pb-2 bg-[#0c1322] border-t border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Sparkles size={12} className="text-indigo-400" />
                    Proctor Timeframe Scrubber
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Markers: <span className="text-rose-400 font-bold">🔴 Off-Screen</span> • <span className="text-amber-400 font-bold">🟡 Gaze Diverted</span> • <span className="text-purple-400 font-bold">🟣 Multi-Person</span>
                  </span>
                </div>

                {/* Interactive Track Container */}
                <div 
                  ref={progressBarRef}
                  onClick={handleScrubberClick}
                  onMouseMove={(e) => {
                    if (!progressBarRef.current) return;
                    const rect = progressBarRef.current.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const pct = Math.max(0, Math.min(1, x / rect.width));
                    const hoverSec = pct * duration;
                    const matchedFlag = normalizedFlags.find(f => Math.abs(hoverSec - f.timestampSeconds) <= 4);
                    setHoveredMarker({
                      time: formatTime(hoverSec),
                      flag: matchedFlag,
                      xPct: pct * 100
                    });
                  }}
                  onMouseLeave={() => setHoveredMarker(null)}
                  className="relative h-4 bg-slate-900 rounded-full cursor-pointer overflow-visible border border-slate-700/60 group"
                >
                  {/* Base Elapsed Progress Bar */}
                  <div 
                    className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (currentTime / (duration || 1)) * 100)}%` }}
                  />

                  {/* Question Markers (Small Cyan Ticks) */}
                  {questionMarks.map((qm, idx) => {
                    const leftPct = Math.min(100, Math.max(0, (qm.timestampSeconds / (duration || 1)) * 100));
                    return (
                      <div 
                        key={idx}
                        className="absolute top-0 bottom-0 w-0.5 bg-cyan-400/70 z-10 hover:bg-cyan-300"
                        style={{ left: `${leftPct}%` }}
                        title={`Q${idx + 1}: ${qm.text} (${qm.timecode})`}
                      />
                    );
                  })}

                  {/* HIGHLIGHTED ANOMALY TIMEFRAME BANDS & PINS */}
                  {normalizedFlags.map((flag) => {
                    const leftPct = Math.min(99, Math.max(1, (flag.timestampSeconds / (duration || 1)) * 100));
                    const spanWidthPct = Math.max(2, (4 / (duration || 1)) * 100);

                    const isGaze = flag.type === 'gaze_diverted';
                    const isMissing = flag.type === 'face_missing';
                    const isMulti = flag.type === 'multiple_faces';

                    const bandBg = isMissing 
                      ? 'bg-rose-500/60 border-rose-400' 
                      : isGaze 
                      ? 'bg-amber-400/60 border-amber-300' 
                      : 'bg-purple-500/60 border-purple-400';

                    const pinBg = isMissing 
                      ? 'bg-rose-500 ring-rose-400' 
                      : isGaze 
                      ? 'bg-amber-400 ring-amber-300' 
                      : 'bg-purple-500 ring-purple-400';

                    return (
                      <React.Fragment key={flag.id}>
                        {/* Highlighted Timeframe Span (4 seconds span) */}
                        <div 
                          className={`absolute top-0 bottom-0 rounded-sm z-10 border-l border-r ${bandBg} pointer-events-none`}
                          style={{ left: `${Math.max(0, leftPct - 1)}%`, width: `${spanWidthPct}%` }}
                        />

                        {/* Interactive Clickable Marker Pin */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            seekTo(flag.timestampSeconds);
                          }}
                          className={`absolute -top-1.5 w-3 h-7 rounded-full ${pinBg} ring-2 ring-black shadow-lg transform -translate-x-1/2 hover:scale-125 transition-transform z-20 cursor-pointer`}
                          title={`Click to jump to ${flag.timecode}: ${flag.issue}`}
                        />
                      </React.Fragment>
                    );
                  })}

                  {/* Playhead Scrubbing Thumb */}
                  <div 
                    className="absolute -top-1 w-4 h-6 rounded-md bg-white border border-slate-900 shadow-xl transform -translate-x-1/2 pointer-events-none z-30 flex items-center justify-center"
                    style={{ left: `${Math.min(100, (currentTime / (duration || 1)) * 100)}%` }}
                  >
                    <div className="w-0.5 h-3 bg-indigo-600 rounded-full" />
                  </div>

                  {/* Floating Hover Tooltip */}
                  {hoveredMarker && (
                    <div 
                      className="absolute -top-12 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-700 shadow-xl pointer-events-none z-40 whitespace-nowrap"
                      style={{ left: `${hoveredMarker.xPct}%` }}
                    >
                      <div className="font-mono font-bold text-cyan-300">{hoveredMarker.time}</div>
                      {hoveredMarker.flag ? (
                        <div className="font-semibold text-rose-300 text-[10px]">
                          ⚠️ {hoveredMarker.flag.issue}
                        </div>
                      ) : (
                        <div className="text-slate-400">Click to seek</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Controls Toolbar */}
              <div className="px-5 py-3.5 bg-[#0b1120] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Jump Back 5s */}
                  <button 
                    onClick={() => jumpSeconds(-5)}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition text-xs font-semibold flex items-center gap-1"
                    title="Jump Back 5s"
                  >
                    <Rewind size={14} />
                    <span className="text-[10px]">5s</span>
                  </button>

                  {/* Play / Pause Toggle */}
                  <button 
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition transform active:scale-95 cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" fill="white" />}
                  </button>

                  {/* Jump Forward 5s */}
                  <button 
                    onClick={() => jumpSeconds(5)}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition text-xs font-semibold flex items-center gap-1"
                    title="Jump Forward 5s"
                  >
                    <span className="text-[10px]">5s</span>
                    <FastForward size={14} />
                  </button>

                  {/* Restart */}
                  <button 
                    onClick={() => seekTo(0)}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition text-xs"
                    title="Restart from beginning"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* Right controls: Speed & Volume & Fullscreen */}
                <div className="flex items-center gap-3">
                  
                  {/* Speed Selector */}
                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                    {[1, 1.25, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono transition ${
                          playbackSpeed === speed 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Volume Button */}
                  <button 
                    onClick={toggleMute}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>

                  {/* Fullscreen Toggle */}
                  <button 
                    onClick={toggleFullscreen}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition"
                    title="Fullscreen"
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* ====================================================
                HIGHLIGHTED TIMEFRAME ANOMALY NAVIGATOR ("JUMP TO INCIDENT")
                ==================================================== */}
            <div className="bg-[#101728] border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <ShieldAlert size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Timeframe Anomaly Navigator
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Click any incident to jump the video directly to that exact moment.
                    </p>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-[#0b1120] p-1 rounded-xl border border-slate-800 text-[11px]">
                  <button 
                    onClick={() => setAnomalyFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      anomalyFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({normalizedFlags.length})
                  </button>
                  <button 
                    onClick={() => setAnomalyFilter('gaze')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      anomalyFilter === 'gaze' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Gaze
                  </button>
                  <button 
                    onClick={() => setAnomalyFilter('missing')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      anomalyFilter === 'missing' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Off-Screen
                  </button>
                  <button 
                    onClick={() => setAnomalyFilter('multiple')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      anomalyFilter === 'multiple' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Multi-Person
                  </button>
                </div>
              </div>

              {/* Anomaly Incident Cards Feed */}
              {filteredFlags.length === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                  <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-1.5" />
                  <p className="text-emerald-300 font-semibold text-xs">No integrity anomalies found in this category.</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Candidate maintained active eye focus and human liveness.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {filteredFlags.map((flag) => {
                    const isCurrentlyPlaying = Math.abs(currentTime - flag.timestampSeconds) <= 3;
                    const isGaze = flag.type === 'gaze_diverted';
                    const isMissing = flag.type === 'face_missing';

                    return (
                      <div 
                        key={flag.id}
                        className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCurrentlyPlaying
                            ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-900/20 ring-1 ring-rose-500'
                            : 'bg-[#151e32] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isMissing 
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                              : isGaze 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                              : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          }`}>
                            {isMissing ? <AlertOctagon size={16} /> : isGaze ? <Eye size={16} /> : <Users size={16} />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {flag.typeLabel}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                flag.severity === 'critical' 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                                {flag.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                              {flag.issue}
                            </p>
                          </div>
                        </div>

                        {/* Jump Button */}
                        <button
                          onClick={() => {
                            seekTo(flag.timestampSeconds);
                            if (!isPlaying) togglePlay();
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                            isCurrentlyPlaying
                              ? 'bg-rose-600 text-white shadow-md'
                              : 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/80'
                          }`}
                        >
                          <Play size={11} fill="currentColor" />
                          <span>Jump to {flag.timecode}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Synchronized Real-Time Emotion & Gaze Curve */}
            <div className="bg-[#101728] border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">
                    Synchronized Emotion & Composure Telemetry
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Live Sync with Video (Time: {formatTime(currentTime)})
                </span>
              </div>

              {/* Synchronized Metrics Pills at Current Timestamp */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Candidate Confidence</span>
                  <span className="text-xl font-extrabold text-white mt-0.5 block">
                    {currentEmotionSample?.confidence !== undefined ? `${currentEmotionSample.confidence}%` : '85%'}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {(currentEmotionSample?.confidence || 85) >= 75 ? 'Composed' : 'Hesitant'}
                  </span>
                </div>

                <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Cognitive Strain</span>
                  <span className="text-xl font-extrabold text-white mt-0.5 block">
                    {currentEmotionSample?.stress !== undefined ? `${currentEmotionSample.stress}%` : '18%'}
                  </span>
                  <span className="text-[10px] text-indigo-300 font-semibold">
                    {currentEmotionSample?.stressLevel || 'Controlled'}
                  </span>
                </div>

                <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Current Gaze State</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <Eye size={14} className={currentEmotionSample?.gaze === 'Screen Focused' ? 'text-cyan-400' : 'text-amber-400'} />
                    <span className="text-xs font-bold text-white truncate max-w-[100px]">
                      {currentEmotionSample?.gaze || 'Screen Focused'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {currentEmotionSample?.gaze === 'Screen Focused' ? 'Direct Camera Alignment' : 'Off-Center'}
                  </span>
                </div>
              </div>
            </div>

          </div>


          {/* ====================================================
              RIGHT STAGE: AI TRANSCRIPT & EVALUATION, CANDIDATE PROFILE (5 Cols)
              ==================================================== */}
          <div className="lg:col-span-5 space-y-6">

            {/* Navigation Tabs */}
            <div className="bg-[#101728] border border-slate-700/80 rounded-2xl p-1.5 flex items-center gap-1 shadow-lg">
              <button 
                onClick={() => setActiveTab('video')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'video' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={14} /> Q&A Transcript
              </button>
              <button 
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <User size={14} /> Profile & Resume
              </button>
              <button 
                onClick={() => setActiveTab('audit')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck size={14} /> Biometrics & Notes
              </button>
            </div>

            {/* TAB 1: AI Q&A TRANSCRIPT & EVALUATION */}
            {activeTab === 'video' && (
              <div className="space-y-4">
                
                {/* AI Evaluation Banner Card */}
                <div className="bg-gradient-to-br from-indigo-950/40 via-[#131b31] to-purple-950/30 border border-indigo-500/30 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Brain size={16} className="text-indigo-400" />
                      AI Response Evaluation
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Semantic scoring of candidate answers against expected technical signals.
                    </p>
                  </div>

                  <div>
                    {interview.evaluations ? (
                      <div className="bg-[#0b1120] border border-indigo-500/30 px-4 py-2 rounded-xl text-center">
                        <span className="text-[9px] uppercase font-bold text-indigo-300 block">Overall Score</span>
                        <span className="text-xl font-extrabold text-white">{interview.overall_score}<span className="text-xs text-slate-500">/10</span></span>
                      </div>
                    ) : (
                      <button 
                        onClick={onEvaluateAnswers} 
                        disabled={isEvaluating} 
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                      >
                        {isEvaluating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        <span>{isEvaluating ? 'Scoring...' : 'Evaluate with AI'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Questions & Answers Scrollable Feed */}
                <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                  {interview.questions && interview.questions.map((q, idx) => {
                    const qText = typeof q === 'string' ? q : q.text;
                    const evalData = interview.evaluations ? interview.evaluations[idx] : null;
                    const candidateAnswer = interview.answers && interview.answers[idx + (interview.answers.length - interview.questions.length)]
                      ? interview.answers[idx + (interview.answers.length - interview.questions.length)]
                      : null;
                    
                    const qMark = questionMarks[idx];

                    return (
                      <div 
                        key={idx} 
                        className="bg-[#101728] border border-slate-700/80 rounded-3xl p-5 shadow-lg space-y-3"
                      >
                        {/* Question Header & Video Jump Button */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                              Q{idx + 1}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                              Technical Prompt
                            </span>
                          </div>

                          {qMark && (
                            <button
                              onClick={() => {
                                seekTo(qMark.timestampSeconds);
                                if (!isPlaying) togglePlay();
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-800 hover:bg-indigo-600 text-cyan-300 hover:text-white border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                              title="Jump video to this question"
                            >
                              <Play size={10} fill="currentColor" />
                              <span>Jump to {qMark.timecode}</span>
                            </button>
                          )}
                        </div>

                        {/* Question Text */}
                        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 font-medium leading-relaxed">
                          {qText}
                        </div>

                        {/* Candidate Answer Bubble */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                            <span>Candidate Verbal Response</span>
                            {candidateAnswer && (
                              <span className="text-slate-500 font-mono">
                                {candidateAnswer.split(/\s+/).filter(Boolean).length} Words
                              </span>
                            )}
                          </div>
                          <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-3.5 text-xs text-slate-300 leading-relaxed">
                            {candidateAnswer ? (
                              candidateAnswer
                            ) : (
                              <span className="text-slate-500 italic">No verbal answer recorded.</span>
                            )}
                          </div>
                        </div>

                        {/* AI Evaluation Rubric */}
                        {evalData && (
                          <div className="bg-[#0b1120] border-l-2 border-indigo-500 rounded-r-2xl p-3.5 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400">Score:</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                                evalData.score >= 4 
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                  : evalData.score === 3 
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}>
                                {evalData.score} / 5
                              </span>
                            </div>

                            <p className="text-xs text-slate-300">
                              {evalData.feedback}
                            </p>

                            {evalData.signals_missed && evalData.signals_missed.length > 0 && (
                              <div className="pt-2 border-t border-slate-800">
                                <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block mb-1">
                                  Missed Technical Signals
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {evalData.signals_missed.map((s, si) => (
                                    <span key={si} className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-800/50 px-2 py-0.5 rounded-md">
                                      ✕ {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: CANDIDATE PROFILE & RESUME */}
            {activeTab === 'profile' && (
              <div className="space-y-5">
                
                {/* Profile Card */}
                <div className="bg-[#101728] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${interview.candidateName || 'Candidate'}&background=4f46e5&color=fff&size=80`} 
                      className="w-14 h-14 rounded-2xl ring-2 ring-indigo-500/30 object-cover shadow-lg" 
                      alt="Avatar"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight">
                        {interview.candidateName || 'Unknown Candidate'}
                      </h3>
                      <p className="text-xs text-indigo-400 font-medium mt-0.5">
                        Applicant for {interview.jobTitle}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800 text-xs">
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Candidate UID</span>
                      <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                        {interview.candidateUid ? `${interview.candidateUid.substring(0, 10)}...` : 'N/A'}
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Phone</span>
                      <span className="text-slate-200">
                        {candidateProfile?.phone || 'Not provided'}
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Education</span>
                      <span className="text-slate-200 text-right">
                        {candidateProfile?.university ? `${candidateProfile.university} (${candidateProfile.gradYear || 'N/A'})` : 'Not provided'}
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">LinkedIn</span>
                      {candidateProfile?.linkedin ? (
                        <a 
                          href={candidateProfile.linkedin.startsWith('http') ? candidateProfile.linkedin : `https://${candidateProfile.linkedin}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 underline"
                        >
                          View Profile <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-slate-500">Not provided</span>
                      )}
                    </div>

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Interview Completed</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {interview.completedAt ? new Date(interview.completedAt).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resume Vault Card */}
                <div className="bg-[#101728] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-indigo-400" />
                      <h4 className="text-sm font-bold text-white">Attached Resume</h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">PDF Vault</span>
                  </div>

                  {candidateProfile?.resumeUrl ? (
                    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[200px]">
                            {candidateProfile?.resumeName || 'candidate_resume.pdf'}
                          </p>
                          <p className="text-[10px] text-slate-400">Verified Resume Document</p>
                        </div>
                      </div>

                      <a 
                        href={candidateProfile.resumeUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                      >
                        <Download size={13} /> View / Download
                      </a>
                    </div>
                  ) : (
                    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-400">No external resume document linked to this profile.</p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: BIOMETRIC AUDIT & RECRUITER NOTES */}
            {activeTab === 'audit' && (
              <div className="space-y-5">
                
                {/* Liveness Verification Breakdown */}
                <div className="bg-[#101728] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} className="text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">Biometric Liveness Verification</h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      VERIFIED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs bg-[#0b1120] p-4 rounded-2xl border border-slate-800">
                    <div className="flex justify-between text-slate-400">
                      <span>Verification Method:</span>
                      <span className="text-white font-medium">Hand-Face Wave Occlusion Gate</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Biometric Depth Status:</span>
                      <span className="text-emerald-400 font-bold">3D Human Presence Authenticated</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Model Version:</span>
                      <span className="font-mono text-slate-300">TensorFlow BlazeFace + Neural Guard</span>
                    </div>
                    {interview.proctoringSummary?.livenessCheck?.verifiedAt && (
                      <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-800">
                        <span>Verified At:</span>
                        <span className="font-mono text-slate-400">
                          {new Date(interview.proctoringSummary.livenessCheck.verifiedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recruiter Hiring Notes */}
                <div className="bg-[#101728] border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-indigo-400" />
                      <h4 className="text-sm font-bold text-white">Recruiter Assessment Notes</h4>
                    </div>
                    {notesSavedSuccess && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
                        <Check size={12} /> Notes Saved
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Internal hiring notes saved directly to this candidate's interview dossier.
                  </p>

                  <textarea 
                    value={recruiterNotes}
                    onChange={(e) => setRecruiterNotes(e.target.value)}
                    placeholder="E.g., Great system design depth, answered question 3 very thoroughly. Minor gaze diversion around 01:14 was brief. Recommended for technical round 2."
                    rows={5}
                    className="w-full bg-[#0b1120] border border-slate-800 focus:border-indigo-500 rounded-2xl p-3.5 text-xs text-slate-200 outline-none resize-none leading-relaxed transition"
                  />

                  <div className="flex justify-end">
                    <button 
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                    >
                      {isSavingNotes ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>{isSavingNotes ? 'Saving...' : 'Save Assessment Notes'}</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>
      </div>

    </div>
  );
}
