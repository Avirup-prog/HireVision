import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CandidateInterview from './pages/CandidateInterview';
import RecruiterAnalytics from './pages/RecruiterAnalytics';
import RecruiterDashboard from './pages/RecruiterDashboard';
import AuthPage from './pages/AuthPage';
import CandidateProfile from './pages/CandidateProfile';
import SplashScreen from './pages/SplashScreen';
import LandingPage from './pages/LandingPage';


const ProtectedRoute = ({ children, allowedRole }) => {
  const currentRole = sessionStorage.getItem('hirevision_role');
  
  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRole && currentRole !== allowedRole) {
    // If they are on the wrong page for their current tab's session
    if (currentRole === 'candidate') return <Navigate to="/candidate/profile" replace />;
    if (currentRole === 'recruiter') return <Navigate to="/recruiter" replace />;
  }
  
  return children;
};

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5500);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        
        {/* Candidate Routes */}
        <Route path="/candidate/profile" element={
          <ProtectedRoute allowedRole="candidate">
             <CandidateProfile />
          </ProtectedRoute>
        } />
        <Route path="/candidate/interview" element={
          <ProtectedRoute allowedRole="candidate">
             <CandidateInterview />
          </ProtectedRoute>
        } />

        {/* Recruiter Routes */}
        <Route path="/recruiter" element={
          <ProtectedRoute allowedRole="recruiter">
             <RecruiterDashboard />
          </ProtectedRoute>
        } />
        <Route path="/recruiter/analytics" element={
          <ProtectedRoute allowedRole="recruiter">
             <RecruiterAnalytics />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;