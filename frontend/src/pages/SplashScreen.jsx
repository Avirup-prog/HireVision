import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function SplashScreen({ onComplete, onExpanding }) {
  const [dotLottie, setDotLottie] = useState(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const triggeredRef = useRef(false);

  // Trigger the 2nd ripple expansion into the whole screen
  const triggerExpansion = useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    setIsExpanding(true);
    if (onExpanding) onExpanding();

    // 1050ms expansion duration: circle surges past viewport edges
    setTimeout(() => {
      setIsFinished(true);
      if (onComplete) onComplete();
    }, 1050);
  }, [onExpanding, onComplete]);

  // Fast-forward skip for developer & user convenience
  const handleSkip = useCallback(() => {
    if (triggeredRef.current && isFinished) return;
    triggeredRef.current = true;
    setIsExpanding(true);
    setIsFinished(true);
    if (onComplete) onComplete();
  }, [isFinished, onComplete]);

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  // Synchronize with Lottie frame 110 (2nd Ripple start) or precision fallback timer
  useEffect(() => {
    if (dotLottie) {
      const handleFrame = ({ currentFrame }) => {
        // Frame 110 is the exact onset of the 2nd ripple in hirevision-logo.lottie
        if (currentFrame >= 110) {
          triggerExpansion();
        }
      };

      dotLottie.addEventListener('frame', handleFrame);
      return () => {
        try {
          dotLottie.removeEventListener('frame', handleFrame);
        } catch {
          // ignore cleanup errors
        }
      };
    }

    // Safety fallback timer at 3700ms (111 frames / 30fps)
    const fallbackTimer = setTimeout(() => {
      triggerExpansion();
    }, 3700);

    return () => clearTimeout(fallbackTimer);
  }, [dotLottie, triggerExpansion]);

  if (isFinished) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] overflow-hidden select-none cursor-pointer"
      onClick={handleSkip}
      title="Click or press Esc to skip"
    >
      {/* 1. Base dark background (before expansion begins) */}
      {!isExpanding && (
        <div className="absolute inset-0 bg-[#0b1120]" />
      )}

      {/* 2. Ambient breathing nebula aura behind center logo */}
      {!isExpanding && (
        <div 
          className="anim-splash-aura absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, rgba(56,189,248,0.12) 35%, rgba(11,17,32,0) 70%)',
            filter: 'blur(30px)',
          }}
        />
      )}

      {/* 3. Ripple 1 Echo Wave (at 2.33s, echoes the first outer circle ripple) */}
      {!isExpanding && (
        <div 
          className="anim-splash-ripple-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/50 pointer-events-none"
        />
      )}

      {/* 4. Ripple 2: THE EXPANDING PORTAL HOLE (Surges to cover the whole screen) */}
      {isExpanding && (
        <div 
          className="anim-portal-expanding-hole absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        />
      )}

      {/* 5. Center Optical Flash / Core Burst as portal ruptures */}
      {isExpanding && (
        <div 
          className="anim-portal-core-flash absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(56,189,248,0.7) 35%, rgba(37,99,235,0.2) 65%, transparent 75%)',
            filter: 'blur(10px)',
          }}
        />
      )}

      {/* 6. Radial cyber sparkles radiating outward with the shockwave */}
      {isExpanding && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <div
              key={deg}
              className="anim-portal-sparkle absolute w-2 h-2 rounded-full bg-cyan-200"
              style={{
                '--sparkle-rot': `${deg}deg`,
                boxShadow: '0 0 14px #38bdf8, 0 0 24px #60a5fa',
              }}
            />
          ))}
        </div>
      )}

      {/* 7. Central Lottie Logo (smoothly dissolves and scales into the void on expansion) */}
      <div 
        className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
          isExpanding ? 'anim-portal-logo-dissolve' : ''
        }`}
      >
        <div className="w-full h-full max-w-screen-lg max-h-screen">
          <DotLottieReact
            src="/hirevision-logo.lottie"
            autoplay
            loop={false}
            dotLottieRefCallback={setDotLottie}
          />
        </div>
      </div>

      {/* 8. Discreet Skip Badge */}
      <div className="absolute bottom-6 right-6 z-10 opacity-60 hover:opacity-100 transition-opacity pointer-events-auto">
        <span className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 bg-slate-900/70 border border-slate-700/60 backdrop-blur-md shadow-lg flex items-center gap-1.5 hover:text-cyan-400 hover:border-cyan-500/40">
          Skip <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono border border-slate-700">Esc</kbd>
        </span>
      </div>
    </div>
  );
}
