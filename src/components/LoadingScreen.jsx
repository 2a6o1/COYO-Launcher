import { useState, useEffect } from "react";
import blackLogo from "../assets/1.png";
import whiteLogo from "../assets/12.png";

export default function LoadingScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const duration = 6000;
    const intervalMs = 50;
    const step = (100 * intervalMs) / duration;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => setFading(true), 200);
          setTimeout(() => onFinish(), 500);
          return 100;
        }
        return Math.round(next);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className={`loading-screen ${fading ? "fade-out" : ""}`}>
      <div className="loading-liquid" />
      <div className="loading-content">
        <div className="loading-logo">
          <img
            src={blackLogo}
            alt="Coyo Launcher"
            className="loading-logo-img"
          />
          <img
            src={whiteLogo}
            alt="Coyo Launcher"
            className="loading-logo-img"
          />
        </div>
        <div className="loading-bar-container">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
