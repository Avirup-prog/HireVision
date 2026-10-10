import React from 'react';
import { 
  Search, Bell, HelpCircle, ChevronDown, Home, LayoutGrid, Users, FileText, Settings, Book, LogOut,
  Play, Pause, Volume2, Maximize, MoreHorizontal, CheckCircle, Mic, ScanFace
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const stressData = [
  { time: '0:00', value: 10, label: 'Resting' },
  { time: '6:12', value: 30, label: 'Q2 Technical' },
  { time: '14:28', value: 15, label: '' },
  { time: '39:36', value: 50, label: 'Q4 Experience' },
  { time: '40:10', value: 45, label: 'Q5 Coding' },
  { time: '42:00', value: 85, label: 'Apex' },
  { time: '44:00', value: 35, label: 'Q5 Coding' },
  { time: '45:12', value: 50, label: '' },
];

export default function RecruiterAnalytics() {
  return (
    <div className="h-screen w-full bg-[#13161c] text-slate-300 flex font-sans overflow-hidden">
      
      {/* EXTREME LEFT SIDEBAR */}
      <aside className="w-[72px] border-r border-slate-800/80 bg-[#171a21] flex flex-col items-center py-6 gap-6">
        <div className="w-10 h-10 rounded-full mb-4 overflow-hidden border border-slate-700">
           <img src="https://ui-avatars.com/api/?name=Recruiter&background=2563eb&color=fff" alt="Profile" />
        </div>
        <div className="flex flex-col gap-6 flex-1">
          <button className="w-10 h-10 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center">
             <Home size={20} />
          </button>
          <SidebarIcon icon={<LayoutGrid size={20} />} />
          <SidebarIcon icon={<Users size={20} />} />
          <SidebarIcon icon={<FileText size={20} />} />
          <SidebarIcon icon={<Settings size={20} />} />
          <SidebarIcon icon={<Book size={20} />} />
        </div>
        <div className="flex flex-col gap-6 mt-auto">
          <SidebarIcon icon={<HelpCircle size={20} />} />
          <SidebarIcon icon={<LogOut size={20} />} />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full bg-[#13161c]">
        
        {/* TOP NAVBAR */}
        <header className="h-[72px] border-b border-slate-800/80 flex items-center justify-between px-8 bg-[#171a21]">
          <h1 className="text-[17px] font-semibold text-white tracking-wide">
            RECRUITER ANALYTICS: <span className="text-slate-400 font-normal">Alex Chen Interview</span>
          </h1>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search" 
                className="bg-[#0f1115] border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-sm w-64 text-slate-300 focus:outline-none focus:border-slate-600"
              />
            </div>
            <HelpCircle size={18} className="text-slate-500 hover:text-white cursor-pointer" />
            <div className="relative">
              <Bell size={18} className="text-slate-500 hover:text-white cursor-pointer" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer pl-4 border-l border-slate-800">
              Menu <ChevronDown size={14} className="text-slate-500" />
            </div>
          </div>
        </header>

        {/* DASHBOARD GRID */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-12 gap-6">
            
            {/* TOP LEFT: VIDEO PLAYER (Col span 5) */}
            <div className="col-span-12 lg:col-span-5 bg-[#171a21] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[15px] font-semibold text-white">Interview Recording: Alex Chen (45:12)</h3>
                <MoreHorizontal size={18} className="text-slate-500 cursor-pointer" />
              </div>
              
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group">
                 <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Video Feed" className="w-full h-full object-cover opacity-90" />
                 
                 {/* Video Controls Overlay */}
                 <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                   <div className="flex items-center gap-4 mb-2">
                     <div className="w-full h-1 bg-white/20 rounded-full cursor-pointer relative">
                       <div className="absolute top-0 left-0 h-full w-[35%] bg-white rounded-full relative">
                         <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow"></div>
                       </div>
                     </div>
                   </div>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <Play size={18} fill="white" className="text-white cursor-pointer" />
                       <Pause size={18} className="text-white cursor-pointer hidden" />
                       <span className="text-[11px] text-white font-medium">14:28 / 45:12</span>
                     </div>
                     <div className="flex items-center gap-4">
                       <Volume2 size={16} className="text-white cursor-pointer" />
                       <Settings size={16} className="text-white cursor-pointer" />
                       <Maximize size={16} className="text-white cursor-pointer" />
                     </div>
                   </div>
                 </div>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-slate-400">Position: <span className="text-slate-200">Senior Backend Engineer</span></p>
                <p className="text-xs text-slate-400">Date: <span className="text-slate-200">Oct 26, 2023</span></p>
              </div>
            </div>

            {/* TOP MIDDLE: SEMANTIC SCORE (Col span 3) */}
            <div className="col-span-12 lg:col-span-3 bg-[#171a21] border border-orange-500/20 rounded-2xl p-5 shadow-lg flex flex-col shadow-orange-500/5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[15px] font-semibold text-white">Semantic Score</h3>
                <MoreHorizontal size={18} className="text-slate-500 cursor-pointer" />
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center mb-4">
                 <div className="relative w-40 h-40 flex items-center justify-center">
                    {/* SVG Circular Progress Bar representing the glowing orange arc */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="80" cy="80" r="70" fill="transparent" stroke="#1e2433" strokeWidth="8" />
                      <circle cx="80" cy="80" r="70" fill="transparent" stroke="#f97316" strokeWidth="8" 
                        strokeDasharray="439.8" strokeDashoffset="65" 
                        strokeLinecap="round" 
                        className="drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]"
                      />
                    </svg>
                    <div className="absolute text-5xl font-bold text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                      85<span className="text-2xl">%</span>
                    </div>
                 </div>
              </div>
              
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Excellent. Strong answers with highly relevant keywords and technical clarity.
              </p>
            </div>

            {/* TOP RIGHT: KEY METRICS (Col span 4) */}
            <div className="col-span-12 lg:col-span-4 bg-[#171a21] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[15px] font-semibold text-white">Key Metrics</h3>
                <MoreHorizontal size={18} className="text-slate-500 cursor-pointer" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 gap-y-6">
                <MetricBar title="Answer Relevance" value="91%" color="bg-cyan-400" width="w-[91%]" />
                <MetricBar title="Sentiment Analysis" value="74%" color="bg-purple-500" width="w-[74%]" />
                <MetricBar title="Response Time" value="1.2s" color="bg-rose-500" width="w-[15%]" dotOnly />
                <MetricBar title="Confidence Level" value="88%" color="bg-blue-500" width="w-[88%]" />
              </div>
            </div>

            {/* BOTTOM LEFT: STRESS LEVELS GRAPH (Col span 8) */}
            <div className="col-span-12 lg:col-span-8 bg-[#171a21] border border-slate-800/80 rounded-2xl p-5 shadow-lg h-[340px] flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-2 relative z-10">
                <h3 className="text-[15px] font-semibold text-white">Candidate Stress Levels</h3>
                <MoreHorizontal size={18} className="text-slate-500 cursor-pointer" />
              </div>
              
              <div className="flex-1 w-full mt-4 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stressData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                         <stop offset="0%" stopColor="#0ea5e9" />
                         <stop offset="50%" stopColor="#6366f1" />
                         <stop offset="100%" stopColor="#d946ef" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e2433" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} dy={10} />
                    <YAxis 
                      axisLine={false} tickLine={false} 
                      ticks={[10, 40, 70, 90]} 
                      tickFormatter={(val) => {
                        if(val===10) return 'Resting';
                        if(val===40) return 'Baseline';
                        if(val===70) return 'Elevated';
                        if(val===90) return 'Apex';
                        return '';
                      }}
                      tick={{fill: '#64748b', fontSize: 11}}
                      width={80}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="url(#lineGrad)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorStress)" 
                      activeDot={{ r: 6, fill: '#fff', stroke: '#d946ef', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Hardcoded Data Point Labels for pixel perfection */}
              <div className="absolute top-1/2 left-[30%] text-xs text-white font-medium">Q2 Technical</div>
              <div className="absolute top-[40%] left-[50%] text-xs text-white font-medium">Q4 Experience</div>
              <div className="absolute top-[35%] left-[65%] text-xs text-white font-medium">Q5 Coding</div>
              <div className="absolute top-[20%] left-[75%] text-xs text-white font-medium bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">Apex</div>
              <div className="absolute top-[50%] left-[85%] text-xs text-white font-medium">Q5 Coding</div>
            </div>

            {/* BOTTOM RIGHT: INSIGHTS & SECURITY (Col span 4) */}
            <div className="col-span-12 lg:col-span-4 bg-[#171a21] border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[15px] font-semibold text-white">Interview Insights & Security</h3>
                <MoreHorizontal size={18} className="text-slate-500 cursor-pointer" />
              </div>

              {/* Deepfake Pass */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">Deepfake Detection</h4>
                  <p className="text-xs text-emerald-400 font-medium">PASSED (No anomalies detected)</p>
                </div>
              </div>

              {/* Security Flags */}
              <div className="mb-6">
                <h4 className="text-xs text-slate-400 font-semibold mb-3 uppercase tracking-wider">Security Flags</h4>
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#0f1115] border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                    <Mic size={16} className="text-slate-500" />
                    <div>
                      <p className="text-[10px] text-slate-400">Voice Biometrics</p>
                      <p className="text-xs text-emerald-400 font-bold tracking-wide">VERIFIED</p>
                    </div>
                  </div>
                  <div className="flex-1 bg-[#0f1115] border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                    <ScanFace size={16} className="text-slate-500" />
                    <div>
                      <p className="text-[10px] text-slate-400">Face Match</p>
                      <p className="text-xs text-emerald-400 font-bold tracking-wide">99.8%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actionable Insights */}
              <div className="flex-1">
                <h4 className="text-xs text-slate-400 font-semibold mb-3 uppercase tracking-wider">Actionable Insights</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div> Strong Technical Skills
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div> Confident Communication
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div> High Interest
                  </li>
                </ul>
              </div>

            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarIcon({ icon }) {
  return (
    <div className="w-10 h-10 text-slate-500 hover:bg-slate-800 hover:text-slate-300 rounded-xl flex items-center justify-center cursor-pointer transition">
      {icon}
    </div>
  );
}

function MetricBar({ title, value, color, width, dotOnly }) {
  return (
    <div className="bg-[#0f1115] p-3.5 rounded-xl border border-slate-800/80 relative overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-400 flex items-center gap-1">
          {title} <HelpCircle size={10} />
        </p>
      </div>
      <p className="text-2xl font-bold text-white mb-2">{value}</p>
      
      {dotOnly ? (
        <div className="w-full h-1 bg-slate-800 rounded-full mt-2 relative">
           <div className={`absolute left-[15%] w-2 h-2 -top-0.5 rounded-full ${color} shadow-[0_0_8px_rgba(244,63,94,0.8)]`}></div>
        </div>
      ) : (
        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden shadow-inner">
           <div className={`h-full ${color} rounded-full ${width} shadow-[0_0_10px_currentColor]`}></div>
        </div>
      )}
    </div>
  );
}
