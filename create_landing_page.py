landing_page_jsx = '''import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, ArrowRight, CheckCircle2, ShieldCheck, BrainCircuit, Video, Mic, 
  Users, Briefcase, Zap, Star, ChevronDown, ChevronRight, Play, Eye, FileText, 
  Check, Copy, Award, Cpu, Radio, BarChart3, Clock, Layers, Terminal, ChevronUp,
  Activity, Shield, Laptop, Compass, Flame, HelpCircle
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // Interactive states
  const [activeTab, setActiveTab] = useState('candidate'); // 'candidate' | 'recruiter'
  const [demoView, setDemoView] = useState('vision'); // 'vision' | 'evaluation'
  const [copiedPIN, setCopiedPIN] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [simulatedScore, setSimulatedScore] = useState(94);

  const handleCopyDemoPIN = () => {
    navigator.clipboard.writeText("849201");
    setCopiedPIN(true);
    setTimeout(() => setCopiedPIN(false), 2000);
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleStartRole = (selectedRole) => {
    navigate('/login', { state: { role: selectedRole } });
  };

  const faqs = [
    {
      q: "How does HireVision tailor questions specifically to a candidate's resume?",
      a: "Our backend leverages Groq LLaMA 3.3 to extract verified experience anchors, technical competencies, and project ownership directly from uploaded PDF resumes. Questions are synthesized strictly around verbatim anchors in the candidate's background combined with the recruiter's configured focus skills."
    },
    {
      q: "How does the BlazeFace neural computer vision proctoring work?",
      a: "Before entering the interview, candidates complete an interactive calibration where TensorFlow.js BlazeFace verifies facial distance, horizontal alignment, and head posture. During the session, non-invasive continuous telemetry ensures session integrity without installing intrusive kernel-level tracking software."
    },
    {
      q: "How are 6-digit access codes generated and managed?",
      a: "Recruiters create job campaign profiles specifying target roles, focus skills, and AI question distributions (Technical, Behavioral, System Design). The platform generates a unique 6-digit PIN with active time windows that candidates enter to request lobby admission."
    },
    {
      q: "Can candidates upload and store multiple resumes?",
      a: "Yes! The candidate portal features 'My Resumes Vault' with persistent storage and realtime synchronization. Candidates can upload multiple tailored resumes and select the best one via a single dropdown click before starting their interview."
    },
    {
      q: "How are interview answers graded objectively?",
      a: "Each candidate response is transcribed in real-time and evaluated against a strict 5-tier rubric by the Groq LLaMA 3.3 inference engine. The AI identifies explicit signals hit, signals missed, and potential red flags, producing an objective scorecard."
    }
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      
      {/* Background Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-indigo-500/15 via-purple-500/10 to-transparent blur-[140px] pointer-events-none"></div>
      <div className="absolute top-[800px] -left-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-[1600px] -right-40 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* ========================================================= */}
      {/* 1. STICKY NAVIGATION BAR                                 */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070b14]/80 border-b border-slate-800/80 px-6 lg:px-12 h-20 flex items-center justify-between transition-all">
        {/* Brand Logo */}
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white font-black text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            HV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white tracking-tight">HireVision</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                AI 2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Autonomous Interview Intelligence</p>
          </div>
        </div>

        {/* Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-indigo-400 transition">Capabilities</a>
          <a href="#simulator" className="hover:text-indigo-400 transition">Live Sandbox</a>
          <a href="#workflow" className="hover:text-indigo-400 transition">How It Works</a>
          <a href="#rubric" className="hover:text-indigo-400 transition">AI Rubric</a>
          <a href="#faq" className="hover:text-indigo-400 transition">FAQ</a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/login')}
            className="hidden sm:inline-flex px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 transition transform hover:scale-105 active:scale-95"
          >
            <span>Launch Platform</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. HERO SECTION                                          */}
      {/* ========================================================= */}
      <section className="relative pt-16 pb-24 px-6 lg:px-12 max-w-7xl mx-auto flex flex-col items-center text-center">
        
        {/* Top Eyebrow Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-8 shadow-sm">
          <Sparkles size={14} className="text-indigo-400 animate-spin" />
          <span>Next-Gen Technical Hiring & Interview Automation</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-400 text-[11px]">Groq LLaMA 3.3 Engine</span>
        </div>

        {/* Giant Kinetic Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08] max-w-5xl mb-6">
          Autonomous Technical Interviews, <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
            Engineered for Unbiased Precision.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-400 max-w-3xl leading-relaxed mb-10">
          HireVision transforms engineering assessments. From resume-anchored question synthesis and neural camera framing calibration to real-time speech transcription and strict Groq rubric grading.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => handleStartRole('candidate')}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-extrabold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Users size={18} />
            <span>Enter as Candidate</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => handleStartRole('recruiter')}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-extrabold bg-[#151e32] hover:bg-[#1a2540] text-slate-200 border border-slate-700/80 hover:border-indigo-500/50 shadow-xl transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Briefcase size={18} className="text-indigo-400" />
            <span>Recruiter Command Center</span>
          </button>

          <a
            href="#simulator"
            className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold text-slate-400 hover:text-white transition"
          >
            <Play size={16} className="text-cyan-400" />
            <span>Explore Simulator</span>
          </a>
        </div>

        {/* Metrics Ticker */}
        <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-3xl bg-[#11192e]/60 border border-slate-800/90 backdrop-blur-md shadow-2xl">
          <div className="text-center p-3">
            <h3 className="text-3xl font-black text-white mb-1">100%</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Objective Rubric Scoring</p>
          </div>
          <div className="text-center p-3">
            <h3 className="text-3xl font-black text-indigo-400 mb-1">&lt; 200ms</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Groq Inference Latency</p>
          </div>
          <div className="text-center p-3">
            <h3 className="text-3xl font-black text-emerald-400 mb-1">98.4%</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Posture & Frame Stability</p>
          </div>
          <div className="text-center p-3">
            <h3 className="text-3xl font-black text-purple-400 mb-1">6-Digit</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Segmented PIN Protocol</p>
          </div>
        </div>

      </section>

      {/* ========================================================= */}
      {/* 3. INTERACTIVE LIVE SIMULATOR SANDBOX                    */}
      {/* ========================================================= */}
      <section id="simulator" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2 block">Real-time Platform Preview</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Experience HireVision in Action</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
            Switch between the Candidate Vision Stream and the Recruiter Telemetry Dashboard to see the dual-sided platform mechanics.
          </p>

          {/* Toggle Pills */}
          <div className="inline-flex p-1.5 bg-[#151e32] rounded-2xl border border-slate-800 mt-6 shadow-inner">
            <button
              onClick={() => setDemoView('vision')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                demoView === 'vision' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video size={15} /> Candidate Vision & Speech
            </button>
            <button
              onClick={() => setDemoView('evaluation')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                demoView === 'evaluation' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BrainCircuit size={15} /> Recruiter Evaluation & Rubric
            </button>
          </div>
        </div>

        {/* Sandbox Window */}
        <div className="relative rounded-3xl bg-[#11192e] border border-slate-700/80 p-6 md:p-8 shadow-2xl overflow-hidden">
          {/* Top Window Bar */}
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
              <span className="ml-2 font-mono text-slate-500">hirevision://session/live-eval</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Telemetry Live
              </span>
            </div>
          </div>

          {/* Sandbox Body */}
          {demoView === 'vision' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Simulated Camera Oval */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="relative w-64 h-80 rounded-[48px] bg-[#070b14] border-2 border-indigo-500/60 shadow-[0_0_30px_rgba(99,102,241,0.25)] flex items-center justify-center overflow-hidden">
                  {/* Subtle Grid scanline */}
                  <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
                  
                  {/* Face Mesh Silhouette */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-32 rounded-full border border-dashed border-emerald-400/80 flex items-center justify-center animate-pulse">
                      <span className="text-xs text-emerald-300 font-mono">Face Aligned</span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-300">
                      <CheckCircle2 size={12} /> Posture 100% Stable
                    </div>
                  </div>

                  {/* Corner Target Markers */}
                  <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-indigo-400"></div>
                  <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-indigo-400"></div>
                  <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-indigo-400"></div>
                  <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-indigo-400"></div>
                </div>
                <p className="text-[11px] text-slate-500 mt-3 font-mono">BlazeFace Neural Mesh Framing Calibration</p>
              </div>

              {/* Right Column: Live Simulated Q&A */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[#151e32] border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BrainCircuit size={14} /> AI Interviewer Prompt
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Category: Core Technical</span>
                  </div>
                  <h4 className="text-lg font-bold text-white leading-snug">
                    “In your recent project with microservices, how did you resolve distributed transactions while avoiding cascading latency?”
                  </h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Anchored to resume project: <span className="text-indigo-300 font-medium">Fintech Payments Gateway</span>
                  </p>
                </div>

                {/* Candidate Live Response Simulation */}
                <div className="bg-[#0b1121] border border-indigo-500/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <Mic size={14} className="text-emerald-400 animate-pulse" />
                      Live Audio Speech-to-Text Transcription
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">Transcribing live...</span>
                  </div>
                  <p className="text-sm text-slate-300 italic leading-relaxed">
                    “We implemented an asynchronous Saga pattern with transactional outbox messages in Kafka, which decoupled execution and bounded our latency to under 45ms...”
                  </p>
                  
                  {/* Signals Hit tags */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Detected Signals:</span>
                    <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                      ✓ Saga Pattern
                    </span>
                    <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                      ✓ Outbox Pattern
                    </span>
                    <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                      ✓ Latency Trade-Off
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Recruiter Evaluation Report Simulation */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[#151e32] border border-slate-700/60 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
                        JD
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">John Doe</h4>
                        <p className="text-xs text-slate-400">Role: Senior Backend Engineer • Access PIN: 849201</p>
                      </div>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
                      Shortlisted Candidate
                    </span>
                  </div>

                  {/* Rubric Breakdown */}
                  <div className="space-y-3 pt-3 border-t border-slate-800">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-semibold">Technical Depth & Architectural Trade-offs</span>
                        <span className="text-emerald-400 font-bold">5 / 5 (Tier 5)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="w-[100%] h-full bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-semibold">Problem-Solving & Scenario Reasoning</span>
                        <span className="text-indigo-400 font-bold">4.6 / 5 (Tier 4)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="w-[92%] h-full bg-indigo-500 rounded-full"></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-semibold">Communication & Signal Ownership</span>
                        <span className="text-purple-400 font-bold">4.8 / 5 (Tier 5)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="w-[96%] h-full bg-purple-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Score Radar Card */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full bg-[#0b1121] border border-slate-800 rounded-2xl p-6 text-center shadow-xl">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-black text-3xl mx-auto mb-3 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                    96%
                  </div>
                  <h4 className="text-lg font-bold text-white">Overall Match Score</h4>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">Exceptional Candidate Fit</p>

                  <div className="mt-5 pt-4 border-t border-slate-800/80 text-left space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Proctoring Integrity:</span>
                      <span className="text-emerald-400 font-bold">0 Flagged Infractions</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Evaluation Engine:</span>
                      <span className="text-indigo-400 font-bold">Groq LLaMA 3.3 (120B)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. PLATFORM CAPABILITIES (BENTO GRID)                     */}
      {/* ========================================================= */}
      <section id="features" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2 block">System Architecture</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Core Platform Capabilities</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
            Engineered from the ground up for fair, transparent, and ultra-fast technical recruitment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Resume Deep Dive */}
          <div className="bg-[#11192e] border border-slate-800/90 rounded-3xl p-7 hover:border-indigo-500/40 transition shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Resume-Anchored Synthesis</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extracts verifiable achievements, tech stacks, and seniority markers from PDF resumes to create grounded questions that challenge actual past work.
            </p>
          </div>

          {/* Card 2: Neural Vision Proctoring */}
          <div className="bg-[#11192e] border border-slate-800/90 rounded-3xl p-7 hover:border-emerald-500/40 transition shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">BlazeFace Neural Vision</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lightweight in-browser face landmark detection with distance checking and a 2-second stability hold before admitting candidates to the exam room.
            </p>
          </div>

          {/* Card 3: Groq LLaMA Scoring */}
          <div className="bg-[#11192e] border border-slate-800/90 rounded-3xl p-7 hover:border-cyan-500/40 transition shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <BrainCircuit size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Strict 5-Tier Rubric Scoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Evaluates answers on content, architecture trade-offs, and ownership without penalizing accents or vocal fluency, ensuring 100% fair evaluation.
            </p>
          </div>

          {/* Card 4: 6-Digit PIN Protocol */}
          <div className="bg-[#11192e] border border-slate-800/90 rounded-3xl p-7 hover:border-purple-500/40 transition shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <KeyIcon size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">6-Digit PIN Launchpad</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Auto-advancing segmented PIN input allowing candidates to join specific job tests instantly with scheduled time-window validation.
            </p>
          </div>

          {/* Card 5: Live Waiting Room */}
          <div className="bg-[#11192e] border border-slate-800/90 rounded-3xl p-7 hover:border-red-500/40 transition shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Radio size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Live Knocking Reception Lobby</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time Firestore listeners alerting recruiters when candidates knock, complete with 1-click batch admission and pre-flight checklist verification.
            </p>
          </div>

          {/* Card 6: My Resumes Vault */}
          <div className="bg-[#11192e] border border-slate-800/90 rounded-3xl p-7 hover:border-amber-500/40 transition shadow-xl group">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Award size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">My Resumes Personal Vault</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Persistent resume storage allowing candidates to maintain multiple versions and select their target resume with one click during test applications.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. WORKFLOW JOURNEY: CANDIDATE VS RECRUITER               */}
      {/* ========================================================= */}
      <section id="workflow" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2 block">Step-By-Step Workflow</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">How HireVision Works</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
            Explore the streamlined end-to-end journey for both candidates and hiring managers.
          </p>

          {/* Persona Switcher */}
          <div className="inline-flex p-1.5 bg-[#151e32] rounded-2xl border border-slate-800 mt-6">
            <button
              onClick={() => setActiveTab('candidate')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'candidate' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={16} /> Candidate Journey
            </button>
            <button
              onClick={() => setActiveTab('recruiter')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'recruiter' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase size={16} /> Recruiter Journey
            </button>
          </div>
        </div>

        {/* 3 Step Cards */}
        {activeTab === 'candidate' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#11192e] border border-slate-800 rounded-3xl p-7 relative">
              <span className="text-4xl font-black text-indigo-500/30 mb-4 block">01</span>
              <h3 className="text-lg font-bold text-white mb-2">PIN Launchpad & Resume</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your 6-digit access code provided by the recruiter and select your active resume from the My Resumes vault.
              </p>
            </div>

            <div className="bg-[#11192e] border border-slate-800 rounded-3xl p-7 relative">
              <span className="text-4xl font-black text-indigo-500/30 mb-4 block">02</span>
              <h3 className="text-lg font-bold text-white mb-2">Hardware Calibration</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calibrate your camera framing inside the visual oval guide, confirm microphone audio level, and wait in the lobby for recruiter admission.
              </p>
            </div>

            <div className="bg-[#11192e] border border-slate-800 rounded-3xl p-7 relative">
              <span className="text-4xl font-black text-indigo-500/30 mb-4 block">03</span>
              <h3 className="text-lg font-bold text-white mb-2">Interactive AI Interview</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verbally answer dynamic technical questions generated from your background with real-time speech-to-text and instant grading.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#11192e] border border-slate-800 rounded-3xl p-7 relative">
              <span className="text-4xl font-black text-purple-500/30 mb-4 block">01</span>
              <h3 className="text-lg font-bold text-white mb-2">Configure Campaign & PIN</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Set up job title, schedule window, focus skills, and AI question count distributions. Generate an instant 6-digit PIN to share.
              </p>
            </div>

            <div className="bg-[#11192e] border border-slate-800 rounded-3xl p-7 relative">
              <span className="text-4xl font-black text-purple-500/30 mb-4 block">02</span>
              <h3 className="text-lg font-bold text-white mb-2">Live Lobby Admission</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive real-time knocking alerts as candidates calibrate their devices. Review their pre-flight checklist and admit them in 1-click.
              </p>
            </div>

            <div className="bg-[#11192e] border border-slate-800 rounded-3xl p-7 relative">
              <span className="text-4xl font-black text-purple-500/30 mb-4 block">03</span>
              <h3 className="text-lg font-bold text-white mb-2">Review & Shortlist</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Examine Groq LLaMA semantic evaluations, signals hit/missed, and proctoring trust logs to shortlist your finalists effortlessly.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 6. AI RUBRIC STANDARD                                    */}
      {/* ========================================================= */}
      <section id="rubric" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-r from-[#11192e] via-[#152342] to-[#11192e] border border-slate-700/80 p-8 lg:p-12 shadow-2xl">
          <div className="max-w-3xl mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2 block">Objective Evaluation Standard</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">The HireVision 5-Tier Scoring Rubric</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Candidate answers are evaluated purely on technical substance, architectural trade-offs, and personal ownership — free from human fatigue, accent bias, or subjective prejudice.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="bg-[#0b1121] border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Score 1</span>
              <h4 className="text-sm font-bold text-white mt-2 mb-1">Irrelevant</h4>
              <p className="text-[11px] text-slate-400">No relevant technical content or completely missed question scope.</p>
            </div>

            <div className="bg-[#0b1121] border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">Score 2</span>
              <h4 className="text-sm font-bold text-white mt-2 mb-1">Generic</h4>
              <p className="text-[11px] text-slate-400">Vague overview lacking concrete implementation details or real ownership.</p>
            </div>

            <div className="bg-[#0b1121] border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Score 3</span>
              <h4 className="text-sm font-bold text-white mt-2 mb-1">Competent</h4>
              <p className="text-[11px] text-slate-400">Technically accurate but shallow. Demonstrates textbook recall.</p>
            </div>

            <div className="bg-[#0b1121] border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Score 4</span>
              <h4 className="text-sm font-bold text-white mt-2 mb-1">Proficient</h4>
              <p className="text-[11px] text-slate-400">Specific with real-world examples, debugging stories, and trade-off analysis.</p>
            </div>

            <div className="bg-[#0b1121] border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Score 5</span>
              <h4 className="text-sm font-bold text-white mt-2 mb-1">Exceptional</h4>
              <p className="text-[11px] text-slate-400">Deep architectural mastery with performance metrics, edge cases, and vision.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 7. FREQUENTLY ASKED QUESTIONS                             */}
      {/* ========================================================= */}
      <section id="faq" className="py-20 px-6 lg:px-12 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2 block">Common Questions</span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index} 
                className="rounded-2xl bg-[#11192e] border border-slate-800/80 overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm md:text-base font-bold text-white hover:text-indigo-400 transition"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={18} className="text-indigo-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-500 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 8. CALL TO ACTION BANNER                                  */}
      {/* ========================================================= */}
      <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto mb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/40 via-[#151e32] to-purple-900/40 border border-indigo-500/40 p-10 lg:p-16 text-center shadow-2xl">
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Ready to Experience the Future of Technical Hiring?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            Whether you are preparing for your next engineering role or hiring the next tech lead for your company, HireVision delivers speed, intelligence, and fairness.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => handleStartRole('candidate')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-extrabold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30 transition transform hover:scale-105"
            >
              <Users size={18} />
              <span>Launch Candidate Workspace</span>
            </button>
            <button
              onClick={() => handleStartRole('recruiter')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-extrabold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition transform hover:scale-105"
            >
              <Briefcase size={18} className="text-indigo-400" />
              <span>Open Recruiter Portal</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 9. FOOTER                                                 */}
      {/* ========================================================= */}
      <footer className="border-t border-slate-800/80 bg-[#070b14] py-12 px-6 lg:px-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              HV
            </div>
            <span className="text-white font-bold text-sm">HireVision AI</span>
            <span>•</span>
            <span>Autonomous Interview & Candidate Intelligence System</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              All Engines Operational
            </span>
            <span>© {new Date().getFullYear()} HireVision Project. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

function KeyIcon(props) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="m21 2-9.6 9.6"/>
      <path d="m15.5 7.5 3 3L22 7l-3-3"/>
    </svg>
  );
}
'''

with open('frontend/src/pages/LandingPage.jsx', 'w', encoding='utf-8') as f:
    f.write(landing_page_jsx)

print("Created LandingPage.jsx successfully")
