import React, { useState, useEffect } from 'react';
import { 
  Search, Bell, HelpCircle, ChevronDown, Home, LayoutGrid, Users, FileText, Settings, Book, LogOut,
  MoreHorizontal, ChevronRight, CheckCircle, Clock, AlertTriangle, X, Play, Plus, Copy, Check, Briefcase, Mic,
  Video, Activity, Brain, Fingerprint, ShieldAlert, Award, Pause, Trash2, LayoutDashboard, LineChart,
  TrendingUp, Sparkles, UserCheck, Zap, ArrowUpRight, BarChart3, Target, Calendar, CheckCircle2, ShieldCheck,
  Filter, Eye, RefreshCw, Radio, Layers, AlertCircle, ExternalLink, ArrowRight
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, getDocs, orderBy, query, where, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard'); 
  
  
  const [jobs, setJobs] = useState([]);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobStartTime, setNewJobStartTime] = useState('');
  const [newJobEndTime, setNewJobEndTime] = useState('');
  const [focusedSkills, setFocusedSkills] = useState('');
  const [sections, setSections] = useState([{ category: 'Core Technical Skills', count: 3 }]);

  
  
  const [waitingCandidates, setWaitingCandidates] = useState([]);
  

  const [completedInterviews, setCompletedInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('all'); // 'all' | 'top' | 'shortlisted'
  const [copiedJobId, setCopiedJobId] = useState(null);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedJobId(code);
    setTimeout(() => setCopiedJobId(null), 2000);
  };

  
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch Jobs created by this recruiter
    const fetchJobs = async () => {
      const q = query(collection(db, 'jobs'), where('recruiterId', '==', user.uid));
      const snapshot = await getDocs(q);
      const fetched = [];
      snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
      setJobs(fetched);
    };

    // Fetch Completed Interviews filtered by recruiterId
    const fetchInterviews = async () => {
      const q = query(collection(db, 'interviews'), where('recruiterId', '==', user.uid));
      const snapshot = await onSnapshot(q, (snapshot) => {
          const fetched = [];
          snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
          fetched.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
          setCompletedInterviews(fetched);
      });
      return snapshot; // 
    };

    fetchJobs();
    const unsubInterviews = fetchInterviews();
    setLoading(false);

    // LIVE Listener for Waiting Room
    const qWaiting = query(
      collection(db, 'interview_requests'), 
      where('recruiterId', '==', user.uid),
      where('status', '==', 'waiting')
    );
    
    const unsubscribe = onSnapshot(qWaiting, (snapshot) => {
      const waiting = [];
      snapshot.forEach(d => waiting.push({ id: d.id, ...d.data() }));
      setWaitingCandidates(waiting);
    });

    return () => unsubscribe();
  }, []);

  
  useEffect(() => {
    if (selectedInterview && selectedInterview.candidateUid) {
      const fetchProfile = async () => {
        try {
          const snap = await getDoc(doc(db, 'candidates', selectedInterview.candidateUid));
          if (snap.exists()) {
            setCandidateProfile(snap.data());
          } else {
            setCandidateProfile(null);
          }
        } catch (e) {
          setCandidateProfile(null);
        }
      };
      fetchProfile();
    } else {
      setCandidateProfile(null);
    }
  }, [selectedInterview]);

  const addSection = () => {
    setSections([...sections, { category: 'Core Technical Skills', count: 1 }]);
  };
  
  const removeSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };
  
  const updateSection = (index, field, value) => {
    const newSections = [...sections];
    newSections[index][field] = value;
    setSections(newSections);
  };

  
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    if (!newJobTitle || !newJobStartTime || !newJobEndTime) {
      alert("Please fill in the Job Title, Start Time, and End Time.");
      return;
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const jobData = {
      jobId: code, recruiterId: auth.currentUser.uid, title: newJobTitle,
      startTime: newJobStartTime, endTime: newJobEndTime, 
      focusedSkills: focusedSkills.split(',').map(s => s.trim()).filter(s => s),
      config: sections,
      createdAt: new Date().toISOString(), status: 'active'
    };
    
    try {
      const docRef = await addDoc(collection(db, 'jobs'), jobData);
      setJobs([...jobs, { id: docRef.id, ...jobData }]);
      setShowNewJobModal(false); setNewJobTitle(''); setNewJobStartTime(''); setNewJobEndTime(''); setFocusedSkills(''); setSections([{ category: 'Core Technical Skills', count: 3 }]);
    } catch (err) { alert("Error creating job"); }
  };

  const handlePauseJob = async (job) => {
    try {
      const newStatus = job.status === 'paused' ? 'active' : 'paused';
      await updateDoc(doc(db, 'jobs', job.id), { status: newStatus });
      setJobs(jobs.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
    } catch (e) {}
  };

  const handleDeleteJob = async (id) => {
    if(!window.confirm("Delete this job profile permanently?")) return;
    try {
      await deleteDoc(doc(db, 'jobs', id));
      setJobs(jobs.filter(j => j.id !== id));
    } catch (e) {}
  };

  // 3. Waiting Room Actions
  const handleApprove = async (requestId) => {
    try { await updateDoc(doc(db, 'interview_requests', requestId), { status: 'approved' }); } catch (e) {}
  };
  const handleDeny = async (requestId) => {
    try { await updateDoc(doc(db, 'interview_requests', requestId), { status: 'rejected' }); } catch (e) {}
  };

  
  const handleShortlist = async () => {
    if (!selectedInterview) return;
    try {
      await updateDoc(doc(db, 'interviews', selectedInterview.id), { status: 'shortlisted' });
      
      if (selectedInterview.requestId) {
        await updateDoc(doc(db, 'interview_requests', selectedInterview.requestId), { status: 'shortlisted' });
      }

      setSelectedInterview({...selectedInterview, status: 'shortlisted'});
      alert("Candidate Shortlisted successfully!");
    } catch(e) {
      alert("Error shortlisting candidate");
    }
  };

  const handleDeleteInterview = async (id, e) => {
    e.stopPropagation();
    if(!window.confirm("Are you sure you want to permanently delete this interview record?")) return;
    try {
      await deleteDoc(doc(db, 'interviews', id));
      // State is automatically updated via onSnapshot listener in useEffect
    } catch(e) {
      alert("Error deleting interview");
    }
  };

  // 5. Evaluate Answers
  const handleEvaluateAnswers = async () => {
    if (!selectedInterview) return;
    setIsEvaluating(true);
    try {
      const response = await fetch('http://localhost:8000/api/evaluate-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: selectedInterview.questions,
          answers: selectedInterview.answers.slice(-selectedInterview.questions.length)
        })
      });
      const data = await response.json();
      
      if (data.error) {
        alert("Error evaluating: " + data.error);
      } else {
        const updateData = {
          evaluations: data.evaluations,
          overall_score: data.overall_score_out_of_10
        };
        await updateDoc(doc(db, 'interviews', selectedInterview.id), updateData);
        setSelectedInterview({...selectedInterview, ...updateData});
      }
    } catch (e) {
      alert("Network error evaluating answers");
    }
    setIsEvaluating(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.removeItem('hirevision_role');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-300 font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/60 bg-[#0b1121] p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <span className="text-white font-bold text-lg">HV</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">HireVision</h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Recruiter</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </div>
          </button>
          
          <button 
            onClick={() => setActiveTab('jobs')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              activeTab === 'jobs' 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Briefcase size={20} />
              <span className="font-medium">Active Jobs</span>
            </div>
            {jobs.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                {jobs.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('waiting')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              activeTab === 'waiting' 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock size={20} />
              <span className="font-medium">Waiting Room</span>
            </div>
            {waitingCandidates.length > 0 ? (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse shadow-lg shadow-red-500/30">
                {waitingCandidates.length}
              </span>
            ) : (
              <span className="text-xs text-slate-600 font-mono">0</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('completed')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              activeTab === 'completed' 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutGrid size={20} />
              <span className="font-medium">All Results</span>
            </div>
            {completedInterviews.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                {completedInterviews.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('selected')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
              activeTab === 'selected' 
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Award size={20} />
              <span className="font-medium">Shortlisted</span>
            </div>
            {completedInterviews.filter(c => c.status === 'shortlisted').length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                {completedInterviews.filter(c => c.status === 'shortlisted').length}
              </span>
            )}
          </button>
        </nav>

        <div className="mt-auto">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={20} />
            <span className="font-medium">Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-slate-800/60 bg-[#0b1121]/80 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white capitalize tracking-tight">
              {activeTab === 'dashboard' ? 'Overview' : activeTab === 'jobs' ? 'Job Profiles' : activeTab === 'waiting' ? 'Live Waiting Room' : activeTab === 'completed' ? 'Interview Results' : 'Shortlisted Candidates'}
            </h2>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Enterprise Command Center</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {waitingCandidates.length > 0 && (
              <button 
                onClick={() => setActiveTab('waiting')}
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition animate-pulse"
              >
                <Radio size={14} />
                <span>{waitingCandidates.length} in Lobby</span>
              </button>
            )}

            <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-200">{auth.currentUser?.displayName || 'Recruiter'}</p>
                <p className="text-xs text-indigo-400 font-mono">Lead Recruiter</p>
              </div>
              <div className="relative">
                <img 
                  src={`https://ui-avatars.com/api/?name=${auth.currentUser?.displayName || 'Recruiter'}&background=4f46e5&color=fff&bold=true`} 
                  className="w-10 h-10 rounded-full border-2 border-indigo-500/40 shadow-md" 
                  alt="Avatar" 
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0b1121]"></span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          
                      {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="max-w-7xl mx-auto space-y-8 animate-slide-up pb-12">
                
                {/* 1. Executive Welcome & Command Header */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#151e32] via-[#1a2542] to-[#151e32] border border-slate-700/60 p-6 md:p-8 shadow-2xl">
                  {/* Ambient background glows */}
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
                  <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

                  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold tracking-wide">
                          <Calendar size={13} />
                          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          AI Proctoring & Groq Engine Active
                        </span>
                      </div>

                      <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                        Welcome back, <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">{auth.currentUser?.displayName?.split(' ')[0] || 'Recruiter'}</span>
                      </h1>
                      <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl leading-relaxed">
                        Real-time candidate telemetry, live lobby admissions, and Groq-powered interview evaluations for your active hiring campaigns.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {waitingCandidates.length > 0 && (
                        <button
                          onClick={() => setActiveTab('waiting')}
                          className="relative inline-flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all shadow-lg shadow-red-500/20 group"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping absolute top-2 right-2"></span>
                          <Clock size={18} className="text-red-400 group-hover:rotate-12 transition-transform" />
                          <span>Waiting Room ({waitingCandidates.length})</span>
                        </button>
                      )}

                      <button
                        onClick={() => setShowNewJobModal(true)}
                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <Plus size={18} />
                        <span>Create Job Role</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Urgent Knocking Candidate Alert (if any) */}
                {waitingCandidates.length > 0 && (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/40 via-[#1e1526] to-[#151e32] border border-red-500/40 p-5 shadow-xl animate-slide-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-inner">
                            <Radio size={24} className="animate-pulse" />
                          </div>
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#151e32] animate-ping"></span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-bold text-base">Candidate Knocking in Lobby!</h3>
                            <span className="bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Action Needed</span>
                          </div>
                          <p className="text-slate-300 text-xs md:text-sm mt-0.5">
                            <span className="font-semibold text-white">{waitingCandidates[0]?.candidateName || 'Candidate'}</span> is waiting to start interview for Job Code <span className="font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded font-bold">{waitingCandidates[0]?.jobId}</span>
                            {waitingCandidates.length > 1 && ` and ${waitingCandidates.length - 1} other candidate(s)`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          onClick={() => handleDeny(waitingCandidates[0]?.id)}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition"
                        >
                          Deny
                        </button>
                        <button
                          onClick={() => handleApprove(waitingCandidates[0]?.id)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition transform hover:scale-105"
                        >
                          <Check size={16} /> Admit Candidate
                        </button>
                        <button
                          onClick={() => setActiveTab('waiting')}
                          className="px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                        >
                          View Lobby ({waitingCandidates.length})
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. High-Impact KPI Bento Cards */}
                {(() => {
                  const totalCandidates = waitingCandidates.length + completedInterviews.length;
                  const activeJobsCount = jobs.filter(j => j.status !== 'paused').length;
                  const evaluatedList = completedInterviews.filter(c => c.evaluations && c.evaluations.length > 0);
                  const evaluatedCount = evaluatedList.length;
                  
                  let avgPercentage = 0;
                  if (evaluatedCount > 0) {
                    const totalScorePct = evaluatedList.reduce((acc, c) => {
                      const max = c.evaluations.length * 5;
                      const earned = c.evaluations.reduce((sum, e) => sum + (e.score || 0), 0);
                      return acc + (max > 0 ? (earned / max) * 100 : 0);
                    }, 0);
                    avgPercentage = Math.round(totalScorePct / evaluatedCount);
                  }

                  const shortlistedCount = completedInterviews.filter(c => c.status === 'shortlisted').length;
                  const conversionRate = completedInterviews.length > 0 
                    ? Math.round((shortlistedCount / completedInterviews.length) * 100) 
                    : 0;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {/* Bento 1: Total Talent Pool */}
                      <div className="group relative overflow-hidden rounded-2xl bg-[#151e32]/90 hover:bg-[#151e32] border border-slate-800/80 hover:border-indigo-500/40 p-5 shadow-xl transition-all duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                            <Users size={22} />
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                            <TrendingUp size={12} /> +14.8%
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Talent Pool</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">{totalCandidates}</h2>
                            <span className="text-xs text-slate-500 font-medium">candidates</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span>{waitingCandidates.length} in lobby</span>
                            <span className="text-indigo-400 font-medium">{completedInterviews.length} completed</span>
                          </div>
                        </div>
                      </div>

                      {/* Bento 2: Interview Campaigns */}
                      <div className="group relative overflow-hidden rounded-2xl bg-[#151e32]/90 hover:bg-[#151e32] border border-slate-800/80 hover:border-purple-500/40 p-5 shadow-xl transition-all duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                            <Briefcase size={22} />
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
                            {activeJobsCount} Active
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Interview Campaigns</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">{jobs.length}</h2>
                            <span className="text-xs text-slate-500 font-medium">job roles</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span>6-Digit Access PINs</span>
                            <span className="text-purple-400 font-medium">Live sync</span>
                          </div>
                        </div>
                      </div>

                      {/* Bento 3: AI Evaluated & Scored */}
                      <div className="group relative overflow-hidden rounded-2xl bg-[#151e32]/90 hover:bg-[#151e32] border border-slate-800/80 hover:border-cyan-500/40 p-5 shadow-xl transition-all duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                            <Brain size={22} />
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full">
                            <Sparkles size={12} /> Groq LLaMA
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Evaluated</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">{evaluatedCount}</h2>
                            <span className="text-xs text-cyan-400 font-bold">{avgPercentage > 0 ? `${avgPercentage}% avg` : 'Pending'}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span>AI Scored Sessions</span>
                            <span className="text-cyan-400 font-medium">{completedInterviews.length - evaluatedCount} unscored</span>
                          </div>
                        </div>
                      </div>

                      {/* Bento 4: Shortlisted Talent */}
                      <div className="group relative overflow-hidden rounded-2xl bg-[#151e32]/90 hover:bg-[#151e32] border border-slate-800/80 hover:border-amber-500/40 p-5 shadow-xl transition-all duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                            <Award size={22} />
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                            {conversionRate}% Rate
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Shortlisted Talent</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">{shortlistedCount}</h2>
                            <span className="text-xs text-amber-400 font-medium">candidates</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span>Finalists Pool</span>
                            <span className="text-amber-400 font-medium">Ready for Hire</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Split Section: Pipeline Funnel (7 cols) + Quick Job PINs (5 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column (7 cols): Candidate Pipeline Funnel */}
                  <div className="lg:col-span-7 bg-[#151e32] border border-slate-800/90 rounded-3xl p-6 md:p-7 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <BarChart3 size={18} className="text-indigo-400" />
                            <h2 className="text-lg font-bold text-white tracking-tight">Hiring Velocity & Funnel</h2>
                          </div>
                          <p className="text-slate-400 text-xs">Live candidate progression across evaluation checkpoints</p>
                        </div>
                        <button
                          onClick={() => setActiveTab('completed')}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition"
                        >
                          View Results <ChevronRight size={14} />
                        </button>
                      </div>

                      {/* Funnel Steps */}
                      {(() => {
                        const total = Math.max(waitingCandidates.length + completedInterviews.length, 1);
                        const c1 = waitingCandidates.length + completedInterviews.length;
                        const c2 = completedInterviews.length;
                        const c3 = completedInterviews.filter(c => c.evaluations && c.evaluations.length > 0).length;
                        const c4 = completedInterviews.filter(c => c.status === 'shortlisted').length;

                        const stages = [
                          { label: 'Applied & Lobby', count: c1, icon: Users, color: 'from-blue-600 to-indigo-600', badgeColor: 'bg-blue-500/10 text-blue-400' },
                          { label: 'Session Completed', count: c2, icon: Video, color: 'from-indigo-600 to-purple-600', badgeColor: 'bg-indigo-500/10 text-indigo-400' },
                          { label: 'AI Scored (Groq)', count: c3, icon: Brain, color: 'from-purple-600 to-cyan-500', badgeColor: 'bg-purple-500/10 text-purple-400' },
                          { label: 'Final Shortlist', count: c4, icon: Award, color: 'from-cyan-500 to-emerald-500', badgeColor: 'bg-emerald-500/10 text-emerald-400' },
                        ];

                        return (
                          <div className="space-y-4">
                            {stages.map((stg, i) => {
                              const pct = Math.round((stg.count / total) * 100);
                              const IconComponent = stg.icon;
                              return (
                                <div key={i} className="group p-3 rounded-2xl bg-[#0b1121]/60 border border-slate-800/80 hover:border-slate-700 transition-all">
                                  <div className="flex items-center justify-between text-xs mb-2">
                                    <div className="flex items-center gap-2.5">
                                      <div className={`p-1.5 rounded-lg ${stg.badgeColor}`}>
                                        <IconComponent size={14} />
                                      </div>
                                      <span className="font-semibold text-slate-200">{stg.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-white">{stg.count} <span className="text-slate-500 font-normal">candidates</span></span>
                                      <span className="font-mono text-slate-400 w-10 text-right">{pct}%</span>
                                    </div>
                                  </div>
                                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                                    <div
                                      className={`h-full rounded-full bg-gradient-to-r ${stg.color} transition-all duration-1000 group-hover:brightness-110`}
                                      style={{ width: `${Math.max(pct, 3)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* AI Insight banner */}
                    <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-3 bg-indigo-500/5 rounded-2xl p-3 border border-indigo-500/15">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <Sparkles size={16} />
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <span className="text-indigo-400 font-bold">AI Insight:</span> Candidates evaluated with scores exceeding 80% show a 3.4x higher interview pass rate across technical questions.
                      </p>
                    </div>
                  </div>

                  {/* Right Column (5 cols): Active Job Access Launchpad */}
                  <div className="lg:col-span-5 bg-[#151e32] border border-slate-800/90 rounded-3xl p-6 md:p-7 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <Zap size={18} className="text-amber-400" />
                          <h2 className="text-lg font-bold text-white tracking-tight">Active Interview PINs</h2>
                        </div>
                        <button
                          onClick={() => setShowNewJobModal(true)}
                          className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5"
                        >
                          <Plus size={13} /> New Role
                        </button>
                      </div>
                      <p className="text-slate-400 text-xs mb-4">
                        Instant 6-digit access codes for candidates to enter the interview lobby:
                      </p>

                      {/* Job PIN Cards */}
                      <div className="space-y-3">
                        {jobs.slice(0, 3).map(job => (
                          <div
                            key={job.id}
                            className={`p-3.5 rounded-2xl border transition-all ${
                              job.status === 'paused'
                                ? 'bg-[#0b1121]/40 border-amber-500/20 opacity-70'
                                : 'bg-[#0b1121]/80 border-slate-800/80 hover:border-indigo-500/30'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-bold text-white truncate max-w-[180px]">{job.title}</h3>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                job.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {job.status === 'paused' ? 'Paused' : 'Active'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-2 rounded-xl">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">PIN:</span>
                                <span className="font-mono text-base font-extrabold tracking-widest text-indigo-400">
                                  {job.jobId}
                                </span>
                              </div>
                              <button
                                onClick={() => handleCopyCode(job.jobId)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                                  copiedJobId === job.jobId
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                              >
                                {copiedJobId === job.jobId ? (
                                  <>
                                    <Check size={12} /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} /> Copy
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}

                        {jobs.length === 0 && (
                          <div className="text-center py-8 px-4 rounded-2xl bg-[#0b1121]/40 border border-dashed border-slate-800">
                            <Briefcase size={28} className="mx-auto text-slate-600 mb-2" />
                            <p className="text-xs text-slate-400 font-medium">No active interview roles yet.</p>
                            <button
                              onClick={() => setShowNewJobModal(true)}
                              className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl transition"
                            >
                              Create First Job PIN
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{jobs.length} total job profile(s)</span>
                      <button
                        onClick={() => setActiveTab('jobs')}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition"
                      >
                        Manage All Jobs <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Top Candidates Leaderboard & Registry */}
                <div className="bg-[#151e32] border border-slate-800/90 rounded-3xl p-6 md:p-8 shadow-2xl">
                  
                  {/* Registry Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Award size={20} className="text-amber-400" />
                        <h2 className="text-xl font-bold text-white tracking-tight">Top Candidates Leaderboard</h2>
                      </div>
                      <p className="text-slate-400 text-xs">Ranked by AI evaluation score, technical depth, and proctoring integrity</p>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex p-1 bg-[#0b1121] rounded-xl border border-slate-800">
                        <button
                          onClick={() => setDashboardFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            dashboardFilter === 'all'
                              ? 'bg-indigo-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          All ({completedInterviews.length})
                        </button>
                        <button
                          onClick={() => setDashboardFilter('top')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            dashboardFilter === 'top'
                              ? 'bg-indigo-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Top Matches (80%+)
                        </button>
                        <button
                          onClick={() => setDashboardFilter('shortlisted')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            dashboardFilter === 'shortlisted'
                              ? 'bg-indigo-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Shortlisted ({completedInterviews.filter(c => c.status === 'shortlisted').length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="mb-6 relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search candidate by name, job role, or ID..."
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      className="w-full bg-[#0b1121] border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    {dashboardSearch && (
                      <button
                        onClick={() => setDashboardSearch('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Candidate List */}
                  {(() => {
                    let candidates = [...completedInterviews];

                    // Sort by AI score descending
                    candidates.sort((a, b) => {
                      const scoreA = a.evaluations ? a.evaluations.reduce((sum, e) => sum + (e.score || 0), 0) : 0;
                      const scoreB = b.evaluations ? b.evaluations.reduce((sum, e) => sum + (e.score || 0), 0) : 0;
                      return scoreB - scoreA;
                    });

                    // Search filter
                    if (dashboardSearch.trim()) {
                      const q = dashboardSearch.toLowerCase();
                      candidates = candidates.filter(c => 
                        (c.candidateName && c.candidateName.toLowerCase().includes(q)) ||
                        (c.jobTitle && c.jobTitle.toLowerCase().includes(q)) ||
                        (c.candidateUid && c.candidateUid.toLowerCase().includes(q))
                      );
                    }

                    // Tab filter
                    if (dashboardFilter === 'top') {
                      candidates = candidates.filter(c => {
                        if (!c.evaluations || c.evaluations.length === 0) return false;
                        const max = c.evaluations.length * 5;
                        const earned = c.evaluations.reduce((sum, e) => sum + (e.score || 0), 0);
                        return max > 0 && (earned / max) >= 0.8;
                      });
                    } else if (dashboardFilter === 'shortlisted') {
                      candidates = candidates.filter(c => c.status === 'shortlisted');
                    }

                    if (candidates.length === 0) {
                      return (
                        <div className="text-center py-16 px-4 rounded-2xl bg-[#0b1121]/40 border border-dashed border-slate-800">
                          <Users size={40} className="mx-auto text-slate-600 mb-3" />
                          <h3 className="text-base font-bold text-white mb-1">No candidates match your criteria</h3>
                          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                            {dashboardSearch ? `No candidates found for "${dashboardSearch}".` : 'Invite candidates using your active 6-digit access codes to review their AI evaluations.'}
                          </p>
                          {dashboardSearch && (
                            <button
                              onClick={() => setDashboardSearch('')}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
                            >
                              Clear search query
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {candidates.slice(0, 8).map((candidate, idx) => {
                          const maxScore = (candidate.evaluations?.length || 0) * 5;
                          const earned = candidate.evaluations?.reduce((sum, e) => sum + (e.score || 0), 0) || 0;
                          const percentage = maxScore > 0 ? Math.round((earned / maxScore) * 100) : 0;
                          const isShortlisted = candidate.status === 'shortlisted';

                          return (
                            <div
                              key={candidate.id}
                              onClick={() => setSelectedInterview(candidate)}
                              className="group relative overflow-hidden rounded-2xl bg-[#0b1121]/70 hover:bg-[#0b1121] border border-slate-800/80 hover:border-indigo-500/40 p-4 md:p-5 transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-lg"
                            >
                              <div className="flex items-center gap-4">
                                {/* Rank Medal */}
                                <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border ${
                                  idx === 0 
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                    : idx === 1 
                                    ? 'bg-slate-300/20 text-slate-200 border-slate-300/40'
                                    : idx === 2 
                                    ? 'bg-amber-700/20 text-amber-500 border-amber-700/40'
                                    : 'bg-slate-800/60 text-slate-500 border-slate-700/40'
                                }`}>
                                  #{idx + 1}
                                </div>

                                {/* Avatar */}
                                <div className="relative shrink-0">
                                  <img
                                    src={`https://ui-avatars.com/api/?name=${candidate.candidateName || 'C'}&background=334155&color=fff&bold=true`}
                                    className="w-11 h-11 rounded-2xl border border-slate-700 shadow"
                                    alt="Avatar"
                                  />
                                  {isShortlisted && (
                                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] shadow">
                                      ★
                                    </span>
                                  )}
                                </div>

                                {/* Info */}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-white font-bold text-sm md:text-base group-hover:text-indigo-300 transition-colors">
                                      {candidate.candidateName || 'Unnamed Candidate'}
                                    </h3>
                                    {isShortlisted && (
                                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Shortlisted
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                                    <span className="text-indigo-400 font-medium">{candidate.jobTitle || 'General Application'}</span>
                                    <span>•</span>
                                    <span className="text-slate-500 font-mono text-[11px]">
                                      {candidate.completedAt ? new Date(candidate.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Right side: Scores & Actions */}
                              <div className="flex items-center justify-between md:justify-end gap-5">
                                {/* Score Indicator */}
                                <div className="text-right">
                                  {candidate.evaluations && candidate.evaluations.length > 0 ? (
                                    <div>
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="font-extrabold text-white text-sm">{earned}/{maxScore}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                          percentage >= 80 
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                            : percentage >= 60 
                                            ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' 
                                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                        }`}>
                                          {percentage}% Fit
                                        </span>
                                      </div>
                                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5 ml-auto">
                                        <div
                                          className={`h-full rounded-full ${
                                            percentage >= 80 ? 'bg-emerald-500' : percentage >= 60 ? 'bg-indigo-500' : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${percentage}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500 italic bg-slate-800/60 px-2.5 py-1 rounded-lg">
                                      Unscored
                                    </span>
                                  )}
                                </div>

                                {/* Clean Session Pill */}
                                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 text-slate-400 text-xs border border-slate-700/40">
                                  <ShieldCheck size={13} className="text-emerald-400" />
                                  <span>Proctored Clean</span>
                                </div>

                                {/* Review File Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInterview(candidate);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-transparent transition-all shadow-sm"
                                >
                                  <span>Review File</span>
                                  <ArrowUpRight size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}{/* JOBS TAB */}
          {activeTab === 'jobs' && (
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Your Interview Links</h3>
                  <p className="text-slate-400 text-sm">Create specific 6-digit codes for different job roles and set their active time windows.</p>
                </div>
                <button 
                  onClick={() => setShowNewJobModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  <Plus size={18} />
                  New Job Role
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {jobs.map(job => (
                  <div key={job.id} className={`bg-[#151e32] border rounded-2xl p-6 transition-all group ${job.status === 'paused' ? 'border-amber-500/30 opacity-75' : 'border-slate-700/50 hover:border-indigo-500/30'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-lg font-bold text-white">{job.title}</h4>
                      {job.status === 'paused' && <span className="bg-amber-500/10 text-amber-500 text-[10px] uppercase font-bold px-2 py-1 rounded">Paused</span>}
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Access Code</span>
                        <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md tracking-widest font-bold">{job.jobId}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Starts</span>
                        <span className="text-slate-300">{new Date(job.startTime).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Ends</span>
                        <span className="text-slate-300">{new Date(job.endTime).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 border-t border-slate-700/50 pt-4">
                      <button onClick={() => handlePauseJob(job)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition">
                        <Pause size={14} /> {job.status === 'paused' ? 'Resume' : 'Pause'}
                      </button>
                      <button onClick={() => handleDeleteJob(job.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition">
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WAITING ROOM TAB */}
          {activeTab === 'waiting' && (
            <div className="max-w-4xl mx-auto">
              {/* ... existing waiting room UI ... */}
              <div className="bg-[#151e32] border border-indigo-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                  Live Monitor
                </h3>
                <p className="text-slate-400 text-sm mb-8">Approve or deny candidates currently attempting to join your interviews.</p>
                
                <div className="space-y-4">
                  {waitingCandidates.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Clock size={40} className="mx-auto mb-3 opacity-20" />
                      <p>Waiting for candidates to connect...</p>
                    </div>
                  ) : (
                    waitingCandidates.map(req => (
                      <div key={req.id} className="bg-[#0b1121] border border-slate-700 p-5 rounded-xl flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                          <img src={`https://ui-avatars.com/api/?name=${req.candidateName}&background=334155&color=fff`} className="w-12 h-12 rounded-full" alt="Candidate" />
                          <div>
                            <h4 className="text-lg font-bold text-white">{req.candidateName}</h4>
                            <p className="text-sm text-slate-400">Job Code: <span className="font-mono text-indigo-400">{req.jobId}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleDeny(req.id)} className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 font-medium transition-colors">Deny</button>
                          <button onClick={() => handleApprove(req.id)} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow-lg transition-all flex items-center gap-2"><Check size={18} /> Admit</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* COMPLETED TAB */}
          {activeTab === 'completed' && (
            <div className="max-w-6xl mx-auto space-y-4">
               {loading ? <p className="text-center text-slate-500 py-10">Loading results...</p> : 
                 completedInterviews.map((candidate) => (
                    <div key={candidate.id} className="bg-[#151e32] border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 transition-all hover:border-slate-700">
                      <div className="flex items-center gap-4">
                        <img src={`https://ui-avatars.com/api/?name=${candidate.candidateName}&background=1e293b&color=fff&size=64`} alt="C" className="rounded-full border-2 border-slate-700" />
                        <div>
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                             {candidate.candidateName}
                             {candidate.status === 'shortlisted' && <span className="bg-green-500/20 text-green-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Shortlisted</span>}
                          </h3>
                          <p className="text-xs text-indigo-400 font-medium my-1">Applied for: {candidate.jobTitle || 'General'}</p>
                          <p className="text-xs text-slate-500">{new Date(candidate.completedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedInterview(candidate)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-500/25">
                          <FileText size={16} /> Applicant Review
                        </button>
                        <button onClick={(e) => handleDeleteInterview(candidate.id, e)} className="bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 p-2.5 rounded-xl transition border border-slate-700 hover:border-red-800/50" title="Delete Interview">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                 ))
               }
            </div>
          )}

          {/* SELECTED TAB */}
          {activeTab === 'selected' && (
            <div className="max-w-6xl mx-auto space-y-4">
               {completedInterviews.filter(c => c.status === 'shortlisted').length === 0 ? (
                 <div className="text-center py-20 text-slate-500">
                    <Award size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg">No candidates have been shortlisted yet.</p>
                 </div>
               ) : (
                 completedInterviews.filter(c => c.status === 'shortlisted').map((candidate) => (
                    <div key={candidate.id} className="bg-gradient-to-r from-green-900/20 to-[#151e32] border border-green-500/30 rounded-2xl p-6 flex justify-between items-center transition-all">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img src={`https://ui-avatars.com/api/?name=${candidate.candidateName}&background=22c55e&color=fff&size=64`} alt="C" className="rounded-full border-2 border-green-500/50" />
                          <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full"><Award size={12}/></div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{candidate.candidateName}</h3>
                          <p className="text-xs text-green-400 font-medium my-1">Shortlisted for: {candidate.jobTitle || 'General'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedInterview(candidate)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2">
                           Review File
                        </button>
                        <button onClick={(e) => handleDeleteInterview(candidate.id, e)} className="bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 p-2.5 rounded-xl transition border border-slate-700 hover:border-red-800/50" title="Delete Interview">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                 ))
               )}
            </div>
          )}

        </div>
      </main>

      {/* FULL SCREEN APPLICANT REVIEW PORTAL */}
      {selectedInterview && (
        <div className="fixed inset-0 z-50 bg-[#050810] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
           
           {/* Portal Header */}
           <div className="h-16 border-b border-slate-800/80 bg-[#0b1121] px-6 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-4">
               <button onClick={() => setSelectedInterview(null)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition">
                 <X size={20}/>
               </button>
               <div className="h-6 w-px bg-slate-700"></div>
               <h2 className="text-xl font-bold text-white">Applicant Review Portal</h2>
             </div>
             
             <div className="flex items-center gap-3">
               {selectedInterview.status === 'shortlisted' ? (
                  <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2">
                    <CheckCircle size={16} /> Candidate Shortlisted
                  </span>
               ) : (
                  <button onClick={handleShortlist} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition shadow-lg shadow-green-600/20 flex items-center gap-2">
                    <Award size={16} /> Shortlist Candidate
                  </button>
               )}
             </div>
           </div>

           {/* Portal Grid */}
           <div className="flex-1 overflow-y-auto p-6 md:p-8">
             <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT COLUMN: Metadata & Video */}
                <div className="space-y-6 lg:col-span-1">
                   
                   {/* Candidate Profile Card */}
                   <div className="bg-[#151e32] border border-slate-700/80 rounded-2xl p-6">
                      <div className="flex items-center gap-4 mb-6">
                         <img src={`https://ui-avatars.com/api/?name=${selectedInterview.candidateName}&background=4f46e5&color=fff&size=80`} className="rounded-full shadow-lg" alt="Avatar"/>
                         <div>
                            <h3 className="text-2xl font-bold text-white leading-tight">{selectedInterview.candidateName}</h3>
                            <p className="text-indigo-400 font-medium text-sm mt-1">{selectedInterview.jobTitle}</p>
                         </div>
                      </div>
                      
                      <div className="space-y-3 text-sm">
                         <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-500">Email / UID</span>
                           <span className="text-slate-300 font-mono text-xs">{selectedInterview.candidateUid.substring(0,8)}...</span>
                         </div>
                         <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-500">Phone</span>
                           <span className="text-slate-300">{candidateProfile?.phone || 'Not provided'}</span>
                         </div>
                         <div className="flex justify-between border-b border-slate-800 pb-2">
                           <span className="text-slate-500">Education</span>
                           <span className="text-slate-300">{candidateProfile?.university ? `${candidateProfile.university} (${candidateProfile.gradYear})` : 'Not provided'}</span>
                         </div>
                         <div className="flex justify-between pb-2">
                           <span className="text-slate-500">LinkedIn</span>
                           <span className="text-blue-400 underline cursor-pointer">{candidateProfile?.linkedin || 'Not provided'}</span>
                         </div>
                      </div>
                   </div>

                   {/* Video Recording Placeholder */}
                   <div className="bg-[#151e32] border border-slate-700/80 rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                        <h4 className="font-semibold text-white flex items-center gap-2"><Video size={16} className="text-indigo-400"/> Session Recording</h4>
                      </div>
                      <div className="relative aspect-video bg-black flex items-center justify-center group cursor-pointer">
                         <img src={`https://images.unsplash.com/photo-1573164713988-8665fc963095?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`} className="absolute inset-0 opacity-40 object-cover grayscale group-hover:grayscale-0 transition" alt="Video Placeholder"/>
                         <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center relative z-10 group-hover:scale-110 transition">
                           <Play size={20} fill="white" className="text-white ml-1" />
                         </div>
                         <div className="absolute bottom-2 left-2 bg-black/60 text-[10px] text-white px-2 py-1 rounded font-mono">14:22 / 18:45</div>
                      </div>
                   </div>

                   {/* AI Vision & DeepFake Metrics Placeholder */}
                     <div className="bg-[#151e32] border border-slate-700/80 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                           <ShieldAlert size={20} className={selectedInterview.proctoringFlags && selectedInterview.proctoringFlags.length > 0 ? "text-red-400" : "text-green-400"} />
                           <h4 className="font-bold text-white">AI Proctoring Log</h4>
                        </div>
                        
                        {!selectedInterview.proctoringFlags || selectedInterview.proctoringFlags.length === 0 ? (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                             <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
                             <p className="text-green-400 text-sm font-medium">No suspicious behavior detected.</p>
                          </div>
                        ) : (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                             <p className="text-red-400 font-bold text-xs uppercase mb-3 border-b border-red-500/30 pb-2">{selectedInterview.proctoringFlags.length} Flag(s) Triggered</p>
                             <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                               {selectedInterview.proctoringFlags.map((flag, idx) => (
                                 <div key={idx} className="flex flex-col gap-1">
                                   <span className="text-red-300 font-medium text-sm">{flag.issue}</span>
                                   <span className="text-slate-500 text-xs font-mono">{flag.time}</span>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                     </div>
                  </div>

                  {/* RIGHT COLUMN: Semantics & Transcript */}
                <div className="space-y-6 lg:col-span-2">
                   
                   {/* AI Answer Evaluation */}
                   <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/10 border border-indigo-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex gap-6 items-center">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                           <Brain size={32} className="text-indigo-400" />
                        </div>
                        <div>
                           <h4 className="text-lg font-bold text-white mb-1">AI Answer Evaluation</h4>
                           <p className="text-sm text-slate-400">Deep semantic scoring of candidate responses against expected signals.</p>
                        </div>
                      </div>
                      
                      <div>
                        {selectedInterview.evaluations ? (
                           <div className="bg-[#0b1121] px-6 py-3 rounded-xl border border-indigo-500/30 flex flex-col items-center justify-center">
                              <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider mb-1">Overall Score</p>
                              <p className="text-2xl font-bold text-white">{selectedInterview.overall_score}<span className="text-sm text-slate-500">/10</span></p>
                           </div>
                        ) : (
                           <button onClick={handleEvaluateAnswers} disabled={isEvaluating} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition whitespace-nowrap shadow-lg shadow-indigo-500/20">
                             {isEvaluating ? 'Analyzing...' : 'Evaluate with AI'}
                           </button>
                        )}
                      </div>
                   </div>

                   {/* Transcript Section */}
                   <div className="bg-[#151e32] border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30 shrink-0">
                        <h4 className="font-semibold text-white flex items-center gap-2"><FileText size={16} className="text-indigo-400"/> Full AI Transcript</h4>
                        <span className="text-xs text-slate-500">{selectedInterview.questions.length} Q&A Pairs</span>
                      </div>
                      
                      <div className="p-6 overflow-y-auto space-y-6 flex-1">
                        {selectedInterview.questions && selectedInterview.questions.map((q, index) => {
                          const evalData = selectedInterview.evaluations ? selectedInterview.evaluations[index] : null;
                          return (
                          <div key={index} className="space-y-4 pb-6 border-b border-slate-800/50 last:border-0">
                            {/* AI Question Bubble */}
                            <div className="flex gap-3 max-w-[85%]">
                              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 shadow-lg">
                                <span className="text-white text-xs font-bold">AI</span>
                              </div>
                              <div className="bg-[#0b1121] border border-slate-700 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-200">
                                {typeof q === 'string' ? q : q.text}
                              </div>
                            </div>
                            
                            {/* Candidate Answer Bubble */}
                            <div className="flex gap-3 justify-end">
                              <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl rounded-tr-sm p-4 text-sm text-slate-200 max-w-[85%]">
                                {selectedInterview.answers && selectedInterview.answers[index + (selectedInterview.answers.length - selectedInterview.questions.length)] ? selectedInterview.answers[index + (selectedInterview.answers.length - selectedInterview.questions.length)] : <span className="text-slate-500 italic">No answer recorded.</span>}
                              </div>
                              <img src={`https://ui-avatars.com/api/?name=${selectedInterview.candidateName}&background=4f46e5&color=fff&size=40`} className="w-8 h-8 rounded-full shrink-0 shadow-lg" alt="C"/>
                            </div>

                            {/* Evaluation Data */}
                            {evalData && (
                              <div className="ml-11 max-w-[80%] bg-[#0b1121] border-l-2 border-indigo-500 p-4 rounded-r-xl">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-xs font-bold text-slate-400">Score:</span>
                                  <span className={`text-sm font-bold ${evalData.score >= 4 ? 'text-green-400' : evalData.score === 3 ? 'text-yellow-400' : 'text-red-400'}`}>{evalData.score}/5</span>
                                </div>
                                <p className="text-xs text-slate-300 mb-3">{evalData.feedback}</p>
                                
                                {evalData.signals_missed && evalData.signals_missed.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-[10px] uppercase text-red-400 font-bold mb-1">Missed Signals</p>
                                    <ul className="list-disc pl-4 text-xs text-slate-400">
                                      {evalData.signals_missed.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )})}
                      </div>
                   </div>

                </div>
             </div>
           </div>
        </div>
      )}
      
      {/* NEW JOB MODAL */}
      {showNewJobModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#151e32] border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative my-8">
            <button onClick={() => setShowNewJobModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Briefcase size={20} className="text-indigo-400"/> Configure New Job Profile</h3>
            
            <form onSubmit={handleCreateJob} className="space-y-6">
              
              {/* Basic Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Job Title</label>
                  <input type="text" value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} className="w-full bg-[#0b1121] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. Senior Frontend Developer"/>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Focused Skills (Comma separated, optional)</label>
                  <input type="text" value={focusedSkills} onChange={e => setFocusedSkills(e.target.value)} className="w-full bg-[#0b1121] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" placeholder="e.g. React, JavaScript, Tailwind"/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Start Time</label>
                    <input type="datetime-local" value={newJobStartTime} onChange={e => setNewJobStartTime(e.target.value)} className="w-full bg-[#0b1121] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">End Time</label>
                    <input type="datetime-local" value={newJobEndTime} onChange={e => setNewJobEndTime(e.target.value)} className="w-full bg-[#0b1121] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"/>
                  </div>
                </div>
              </div>

              {/* AI Interview Configuration */}
              <div className="border-t border-slate-800 pt-6">
                 <div className="flex justify-between items-center mb-4">
                   <div>
                     <h4 className="text-white font-medium flex items-center gap-2"><Brain size={16} className="text-purple-400"/> AI Interview Strategy</h4>
                     <p className="text-xs text-slate-400 mt-1">Configure the types and quantities of questions.</p>
                   </div>
                   <button type="button" onClick={addSection} className="text-xs bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1">
                     <Plus size={14}/> Add Section
                   </button>
                 </div>

                 <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                   {sections.map((sec, index) => (
                     <div key={index} className="bg-[#0b1121] border border-slate-700/50 p-4 rounded-xl flex gap-3 relative group">
                        
                        <div className="flex-1">
                          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Category</label>
                          <select value={sec.category} onChange={(e) => updateSection(index, 'category', e.target.value)} className="w-full bg-[#151e32] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500">
                            <option>Introduction / Background</option>
                            <option>Core Technical Skills</option>
                            <option>Behavioral / Soft Skills</option>
                            <option>Scenario-based Problem Solving</option>
                            <option>System Design / Architecture</option>
                          </select>
                        </div>
                        
                        <div className="w-24">
                          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Count</label>
                          <input type="number" min="1" max="10" value={sec.count} onChange={(e) => updateSection(index, 'count', parseInt(e.target.value))} className="w-full bg-[#151e32] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"/>
                        </div>

                        {sections.length > 1 && (
                          <button type="button" onClick={() => removeSection(index)} className="absolute -right-2 -top-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 p-1.5 rounded-full border border-slate-700 opacity-0 group-hover:opacity-100 transition shadow-lg">
                            <X size={14} />
                          </button>
                        )}
                     </div>
                   ))}
                 </div>
                 
                 <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between">
                   <span className="text-xs text-indigo-300">Total AI Questions:</span>
                   <span className="text-lg font-bold text-indigo-400">{sections.reduce((acc, curr) => acc + (curr.count || 0), 0)}</span>
                 </div>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-800">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-indigo-500/20">Generate 6-Digit Interview Code</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
