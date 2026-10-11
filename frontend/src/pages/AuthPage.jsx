import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Video, Mail, Lock, User, Briefcase, AlertCircle, Loader2, Eye, EyeOff, 
  BrainCircuit, ShieldCheck, Zap, Sparkles, Building, ArrowRight, CheckCircle2, 
  Shield, Cpu, Award, ArrowLeftRight, Radio, Layers, Users, TrendingUp
} from 'lucide-react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import SplashScreen from './SplashScreen';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState(location.state?.role || 'candidate');

  useEffect(() => {
    if (location.state?.role) {
      setRole(location.state.role);
    }
  }, [location.state?.role]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [showAuthSplash, setShowAuthSplash] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        sessionStorage.setItem('hirevision_role', role);
        setShowAuthSplash(true);
        setTimeout(() => {
          if (role === 'candidate') navigate('/candidate/profile');
          else navigate('/recruiter');
        }, 5500);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        if (role === 'recruiter') {
          await setDoc(doc(db, 'recruiters', userCredential.user.uid), {
             uid: userCredential.user.uid,
             name: name,
             email: email,
             company: company,
             createdAt: new Date().toISOString()
          });
        }
        sessionStorage.setItem('hirevision_role', role);
        setShowAuthSplash(true);
        setTimeout(() => {
          if (role === 'candidate') navigate('/candidate/profile');
          else navigate('/recruiter');
        }, 5500);
      }
    } catch (err) {
      console.error(err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  if (showAuthSplash) return <SplashScreen />;

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#070b14] relative overflow-hidden flex flex-col lg:flex-row font-sans text-slate-200 selection:bg-indigo-500 selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. SLIDING HERO SHOWCASE PANEL (Smoothly transforms and shifts sides)     */}
      {/*    - Candidate Mode: Stays on LEFT (lg:translate-x-0)                     */}
      {/*    - Recruiter Mode: Glides to RIGHT (lg:translate-x-full)                */}
      {/* ========================================================================= */}
      <div 
        className={`hidden lg:flex lg:w-1/2 lg:h-full lg:absolute lg:top-0 lg:bottom-0 lg:left-0 z-10 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] p-10 xl:p-14 flex-col justify-between overflow-hidden select-none ${
          role === 'candidate' 
            ? 'lg:translate-x-0 border-r border-slate-800/80 bg-gradient-to-br from-[#070b14] via-[#0e172a] to-[#131f38] shadow-[25px_0_60px_rgba(0,0,0,0.6)]' 
            : 'lg:translate-x-full border-l border-slate-800/80 bg-gradient-to-bl from-[#0a0f1d] via-[#14122d] to-[#0b1a2c] shadow-[-25px_0_60px_rgba(0,0,0,0.6)]'
        }`}
      >
        
        {/* Ambient atmospheric glows */}
        <div className={`absolute top-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-all duration-700 ${
          role === 'candidate' 
            ? '-right-24 bg-indigo-500/15' 
            : '-left-24 bg-purple-500/15'
        }`}></div>
        <div className={`absolute -bottom-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-all duration-700 ${
          role === 'candidate' 
            ? '-left-24 bg-purple-500/15' 
            : '-right-24 bg-cyan-500/15'
        }`}></div>
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Brand Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transition-all duration-500 ${
              role === 'candidate'
                ? 'bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 shadow-indigo-500/40'
                : 'bg-gradient-to-br from-purple-500 via-indigo-600 to-emerald-500 shadow-purple-500/40'
            }`}>
              HV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">HireVision</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border transition-colors ${
                  role === 'candidate'
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                    : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                }`}>
                  {role === 'candidate' ? 'AI Candidate Studio' : 'Enterprise Recruiter'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">Intelligent Technical Interview Platform</p>
            </div>
          </div>

          {/* Quick Interactive Switcher Pill on Showcase */}
          <button
            type="button"
            onClick={() => {
              setRole(role === 'candidate' ? 'recruiter' : 'candidate');
              setError(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#151e32]/80 hover:bg-[#151e32] border border-slate-700/60 text-xs text-slate-300 hover:text-white transition group"
            title="Switch portal workspace and slide split screen"
          >
            <ArrowLeftRight size={13} className="text-indigo-400 group-hover:rotate-180 transition-transform duration-500" />
            <span>Switch to {role === 'candidate' ? 'Recruiter' : 'Candidate'}</span>
          </button>
        </div>

        {/* Center Hero Content (Dynamically transforms with animated text & components) */}
        <div className="relative z-10 max-w-xl my-auto py-8">
          <div key={role} className="animate-slide-up space-y-6">
            
            {/* Role Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-semibold tracking-wide shadow-sm">
              <span className={`w-2 h-2 rounded-full animate-pulse ${role === 'candidate' ? 'bg-indigo-400' : 'bg-purple-400'}`}></span>
              <span>{role === 'candidate' ? 'Candidate Launchpad Portal' : 'Recruiter Intelligence Command'}</span>
            </div>

            {/* Main Kinetic Headline */}
            <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.12] tracking-tight">
              {role === 'candidate' ? (
                <>
                  Master your interview with <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">AI Copilot</span>.
                </>
              ) : (
                <>
                  Screen top talent with <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Autonomous Rubrics</span>.
                </>
              )}
            </h2>

            {/* Subtitle */}
            <p className="text-base text-slate-300 leading-relaxed max-w-lg">
              {role === 'candidate' 
                ? 'Pre-calibrate your camera & audio, answer role-specific technical questions generated from your resume, and get instant semantic grading.' 
                : 'Configure 6-digit PIN campaigns, admit knocking candidates in real time, and grade responses objectively using Groq LLaMA 3.3.'}
            </p>

            {/* Dynamic Interactive Preview Card */}
            <div className="rounded-2xl bg-[#0b1121]/80 border border-slate-700/60 p-5 shadow-2xl backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
              
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Cpu size={14} className={role === 'candidate' ? 'text-indigo-400' : 'text-purple-400'} />
                  {role === 'candidate' ? 'Live AI Test Simulator' : 'Active Campaign Command & Live Queue'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  {role === 'candidate' ? 'Neural Engine Online' : 'Lobby Listening'}
                </span>
              </div>

              {role === 'candidate' ? (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-[#151e32] border border-slate-700/50 text-xs text-slate-200">
                    <p className="font-semibold text-white mb-1">“Explain how React fiber reconciliation avoids main-thread blocking?”</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="text-emerald-400 font-bold">✓ Audio Speech-to-Text Active</span>
                      <span>•</span>
                      <span>BlazeFace Calibrated</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-[#151e32] border border-slate-700/50 text-xs text-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Fullstack Architect Campaign</p>
                      <p className="text-[11px] text-slate-400">
                        PIN: <span className="font-mono text-purple-400 font-bold">849201</span> • 5 Focus Skills
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded text-xs">
                        96% Rubric Score
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">1 In Waiting Room</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature Mini Bento Strip */}
            <div className="grid grid-cols-3 gap-3.5 pt-2">
              {role === 'candidate' ? (
                <>
                  <div className="bg-[#0b1121]/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-sm hover:border-slate-700 transition">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-2">
                      <BrainCircuit size={18} />
                    </div>
                    <h4 className="text-white font-bold text-xs">Groq LLaMA</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Semantic rubric grading</p>
                  </div>

                  <div className="bg-[#0b1121]/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-sm hover:border-slate-700 transition">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="text-white font-bold text-xs">Proctored</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Face mesh calibration</p>
                  </div>

                  <div className="bg-[#0b1121]/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-sm hover:border-slate-700 transition">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2">
                      <Zap size={18} />
                    </div>
                    <h4 className="text-white font-bold text-xs">Real-Time</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Live speech transcription</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#0b1121]/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-sm hover:border-slate-700 transition">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2">
                      <Layers size={18} />
                    </div>
                    <h4 className="text-white font-bold text-xs">Autonomous</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Zero-fatigue grading</p>
                  </div>

                  <div className="bg-[#0b1121]/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-sm hover:border-slate-700 transition">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2">
                      <Users size={18} />
                    </div>
                    <h4 className="text-white font-bold text-xs">Waiting Room</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Real-time candidate queue</p>
                  </div>

                  <div className="bg-[#0b1121]/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-sm hover:border-slate-700 transition">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                      <TrendingUp size={18} />
                    </div>
                    <h4 className="text-white font-bold text-xs">Talent Podium</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Ranked candidate shortlists</p>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Footer Security Badge */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-500">
          <Shield size={14} className="text-indigo-400" />
          <span>Enterprise Grade Security • End-to-End SSL & Firebase Authenticated</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SLIDING AUTH FORM PANEL (Smoothly transforms and shifts sides)         */}
      {/*    - Candidate Mode: Stays on RIGHT (lg:translate-x-0)                    */}
      {/*    - Recruiter Mode: Glides to LEFT (lg:-translate-x-full)                */}
      {/* ========================================================================= */}
      <div 
        className={`w-full lg:w-1/2 min-h-screen lg:min-h-full lg:h-full relative lg:absolute lg:top-0 lg:bottom-0 lg:left-1/2 z-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between p-6 sm:p-12 lg:p-12 xl:p-16 bg-[#0b1120] overflow-y-auto ${
          role === 'candidate' 
            ? 'lg:translate-x-0' 
            : 'lg:-translate-x-full'
        }`}
      >
        
        {/* Top Header Toggle (Sign In vs Create Account) */}
        <div className="flex justify-end items-center text-xs sm:text-sm">
          <span className="text-slate-400 mr-2">
            {isLogin ? "New to HireVision?" : "Already have an account?"}
          </span>
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(null); }} 
            className="text-indigo-400 font-bold hover:text-indigo-300 transition underline underline-offset-4"
          >
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </div>

        {/* Form Container */}
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div key={`${role}-${isLogin}`} className="animate-slide-up">
            
            {/* Header Titles with Dynamic Role Persona */}
            <div className="mb-8">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {isLogin 
                  ? (role === 'candidate' ? 'Welcome back, Candidate' : 'Welcome back, Recruiter') 
                  : (role === 'candidate' ? 'Create Candidate Profile' : 'Register Recruiter Workspace')}
              </h2>
              <p className="text-slate-400 text-sm mt-1.5">
                {isLogin 
                  ? `Enter your ${role} workspace credentials to access your portal.` 
                  : `Get started with HireVision by creating your new ${role} profile.`}
              </p>
            </div>

            {/* Role Switcher (Interactive Segmented Control that triggers Split-Screen Swap) */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500">Workspace Role</span>
                <span className="text-[11px] text-indigo-400 font-medium flex items-center gap-1">
                  {/* <ArrowLeftRight size={11} />
                  <span>Clicking swaps split screen</span> */}
                </span>
              </div>
              
              <div className="p-1.5 bg-[#151e32] rounded-2xl border border-slate-800 grid grid-cols-2 gap-1.5 shadow-inner relative">
                <button 
                  type="button"
                  onClick={() => { setRole('candidate'); setError(null); }}
                  className={`py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    role === 'candidate' 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <User size={16} />
                  <span>Candidate</span>
                </button>

                <button 
                  type="button"
                  onClick={() => { setRole('recruiter'); setError(null); }}
                  className={`py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    role === 'recruiter' 
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 scale-[1.02]' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Briefcase size={16} />
                  <span>Recruiter</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 shadow-lg animate-slide-up">
                <AlertCircle size={18} className="text-rose-400 mt-0.5 shrink-0" />
                <p className="text-xs text-rose-300 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Full Name (Sign Up only) */}
              {!isLogin && (
                <div className="animate-slide-up">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                      placeholder="e.g. Alex Johnson" 
                      className="w-full bg-[#0b1121] border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" 
                    />
                  </div>
                </div>
              )}

              {/* Company (Recruiter Sign Up only) */}
              {!isLogin && role === 'recruiter' && (
                <div className="animate-slide-up">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Company / Organization</label>
                  <div className="relative">
                    <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      value={company} 
                      onChange={(e) => setCompany(e.target.value)} 
                      placeholder="e.g. Acme Tech Labs" 
                      className="w-full bg-[#0b1121] border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" 
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    placeholder="you@example.com" 
                    className="w-full bg-[#0b1121] border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" 
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    placeholder="Enter your password" 
                    className="w-full bg-[#0b1121] border border-slate-800 rounded-xl pl-12 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Extra row: Remember me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-[#0b1120] accent-indigo-600 cursor-pointer" 
                  />
                  <span className="text-xs text-slate-400">Remember me</span>
                </label>
                <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition">
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button 
                disabled={loading} 
                type="submit" 
                className={`w-full py-3.5 mt-2 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base transform hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer ${
                  role === 'candidate'
                    ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25'
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/25'
                }`}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>
                      {isLogin 
                        ? `Sign in as ${role === 'candidate' ? 'Candidate' : 'Recruiter'}` 
                        : `Create ${role === 'candidate' ? 'Candidate' : 'Recruiter'} Account`}
                    </span>
                    <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access Guidance */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                By accessing HireVision, you agree to our Terms of Service. Sessions are proctored and analyzed by our AI evaluation algorithms.
              </p>
            </div>

          </div>
        </div>

        {/* Bottom subtle copyright */}
        <div className="text-center text-xs text-slate-600">
          © {new Date().getFullYear()} HireVision AI Inc. All rights reserved.
        </div>

      </div>

    </div>
  );
}
