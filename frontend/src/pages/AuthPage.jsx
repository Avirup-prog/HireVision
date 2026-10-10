import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Mail, Lock, User, Briefcase, AlertCircle, Loader2, Eye, EyeOff, BrainCircuit, ShieldCheck, Zap } from 'lucide-react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import SplashScreen from './SplashScreen';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('candidate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [showAuthSplash, setShowAuthSplash] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-[#0b1120] flex font-sans">
      
      {/* LEFT SIDE: Hero Split */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0a192f] via-[#112240] to-[#0b1120] p-12 flex-col justify-between relative overflow-hidden border-r border-slate-800">
        
        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-700 shadow-xl">
            <Video size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">HireVision</h1>
            <p className="text-[10px] text-blue-300 font-bold tracking-widest uppercase">Interview Intelligence</p>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="relative z-10 max-w-xl">
          <div key={role} className="animate-slide-up">
            <div className="flex items-center gap-4 mb-6">
            <div className="h-px w-8 bg-blue-500"></div>
            <span className="text-xs font-bold text-blue-300 tracking-widest uppercase">
              {role === 'candidate' ? 'Candidate Workspace' : 'Recruiter Workspace'}
            </span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
            {role === 'candidate' 
              ? 'Your next opportunity starts here.' 
              : 'Meet the right talent, faster.'}
          </h1>
          <p className="text-lg text-slate-300 mb-12 max-w-md">
            {role === 'candidate' 
              ? 'Prepare, practice, and complete AI-driven technical interviews with confidence—all in one focused workspace.' 
              : 'Create structured AI interviews, review semantic insights, and make confident hiring decisions with your team.'}
          </p>
          
          {/* Feature Cards (Replaced the 100k stat blocks) */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <BrainCircuit size={24} className="text-blue-400 mb-2" />
              <h3 className="text-white font-semibold text-sm mb-1">Smart AI</h3>
              <p className="text-slate-400 text-xs">Llama-3 powered semantic grading</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <Zap size={24} className="text-emerald-400 mb-2" />
              <h3 className="text-white font-semibold text-sm mb-1">Real-time</h3>
              <p className="text-slate-400 text-xs">Live audio-to-text transcription</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <ShieldCheck size={24} className="text-indigo-400 mb-2" />
              <h3 className="text-white font-semibold text-sm mb-1">Unbiased</h3>
              <p className="text-slate-400 text-xs">Objective rubric-based scorecards</p>
            </div>
          </div>
          </div>
        </div>
        
        {/* Background glow effects */}
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px]"></div>
      </div>

      {/* RIGHT SIDE: Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col p-6 md:p-12 relative bg-[#0b1120]">
        
        {/* Top Right Toggle */}
        <div className="absolute top-8 right-8 text-sm">
          <span className="text-slate-400">{isLogin ? "New here? " : "Already have an account? "}</span>
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-blue-400 font-semibold hover:text-blue-300 transition">
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto mt-12 lg:mt-0">
          <div key={`${role}-${isLogin}`} className="animate-slide-up">
            <h2 className="text-4xl font-bold text-white mb-2">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-slate-400 mb-10">
            Choose your workspace and enter your details to continue.
          </p>

          {/* Role Toggle (Segmented Control style) */}
          <div className="flex p-1.5 bg-[#151e32] rounded-xl mb-8 border border-slate-800">
            <button 
              type="button"
              onClick={() => { setRole('candidate'); setError(null); }}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${role === 'candidate' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <User size={16} /> Candidate
            </button>
            <button 
              type="button"
              onClick={() => { setRole('recruiter'); setError(null); }}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${role === 'recruiter' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Briefcase size={16} /> Recruiter
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" className="w-full bg-[#0b1121] border-2 border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-slate-200 focus:outline-none focus:border-blue-500 transition" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Email address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full bg-[#0b1121] border-2 border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-slate-200 focus:outline-none focus:border-blue-500 transition" />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 bg-emerald-500/20 rounded flex items-center justify-center">
                    <Mail size={12} className="text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" className="w-full bg-[#0b1121] border-2 border-slate-800 rounded-xl pl-12 pr-12 py-3.5 text-slate-200 focus:outline-none focus:border-blue-500 transition" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-[#0b1120]" />
                <span className="text-sm text-slate-400">Remember me</span>
              </label>
              <button type="button" className="text-sm text-blue-400 hover:text-blue-300 transition">Forgot password?</button>
            </div>

            <button disabled={loading} type="submit" className="w-full py-4 mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-lg">
              {loading ? <Loader2 size={20} className="animate-spin" /> : null}
              {isLogin ? `Sign in as ${role}` : `Create ${role} account`} 
              <span className="ml-1">›</span>
            </button>
          </form>
          </div>

        </div>
      </div>
    </div>
  );
}
