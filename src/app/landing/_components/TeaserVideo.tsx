"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

// The Petra promo video (narrated by פטי, marketing/promo-video) with a "צפו בדמו" button under it that starts playback in place.
export function TeaserVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    v.scrollIntoView({ behavior: "smooth", block: "center" });
    void v.play();
  };

  return (
    <>
      <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-800">
        <video
          ref={videoRef}
          src="/promo.mp4"
          poster="/landing/screens/promo-poster.webp"
          controls
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="w-full h-full object-cover"
          aria-label="סרטון תדמית — פטרה, ניהול עסקים של חיות מחמד"
        />
      </div>
      <div className="text-center mt-8">
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white lp-press transition-opacity disabled:opacity-0 focus:outline-none focus:ring-2 focus:ring-brand-400"
          style={{ background: "#C2410C" }}
        >
          <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
          צפו בדמו
        </button>
      </div>
    </>
  );
}
