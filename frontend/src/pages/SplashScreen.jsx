import React, { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function SplashScreen() {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Start fading out slightly before it unmounts (at 3 seconds)
    const timer = setTimeout(() => {
      setFade(true);
    }, 4800); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`h-screen w-full bg-[#0b1120] flex items-center justify-center transition-opacity duration-700 ease-in-out ${fade ? 'opacity-0' : 'opacity-100'}`}>
        <div className="w-full h-full max-w-screen-lg max-h-screen">
          <DotLottieReact
            src="/hirevision-logo.lottie"
            loop
            autoplay
          />
        </div>
    </div>
  );
}
