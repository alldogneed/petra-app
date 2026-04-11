"use client";

import { useState } from "react";
import { Play, X, Users, ShoppingBag, Clock, Sparkles, LayoutDashboard, Target, Settings, Hotel } from "lucide-react";
import { TUTORIAL_VIDEOS, TUTORIAL_CATEGORIES, type TutorialVideo } from "@/lib/tutorials-config";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard: ({ className }) => <LayoutDashboard className={className} />,
  Users:           ({ className }) => <Users className={className} />,
  Target:          ({ className }) => <Target className={className} />,
  ShoppingBag:     ({ className }) => <ShoppingBag className={className} />,
  Settings:        ({ className }) => <Settings className={className} />,
  Hotel:           ({ className }) => <Hotel className={className} />,
};

export default function TutorialsPage() {
  const [activeVideo, setActiveVideo] = useState<TutorialVideo | null>(null);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            סרטוני הדרכה
            <span className="badge-brand text-xs px-2 py-0.5">חדש</span>
          </h1>
          <p className="text-sm text-petra-muted mt-0.5">
            סרטונים קצרים שיעזרו לך להפיק את המקסימום מפטרה
          </p>
        </div>
      </div>

      {/* Categories + Videos */}
      <div className="space-y-10">
        {TUTORIAL_CATEGORIES.map((cat) => {
          const videos = TUTORIAL_VIDEOS.filter((v) => v.category === cat.id);
          if (videos.length === 0) return null;
          const Icon = ICON_MAP[cat.icon];

          return (
            <section key={cat.id}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                  {Icon && <Icon className="w-4 h-4 text-brand-600" />}
                </div>
                <h2 className="text-base font-bold text-petra-text">{cat.label}</h2>
                <span className="text-xs text-petra-muted">({videos.length})</span>
              </div>

              {/* Video grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onPlay={() => setActiveVideo(video)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Video Modal */}
      {activeVideo && (
        <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}

function VideoCard({
  video,
  onPlay,
}: {
  video: TutorialVideo;
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className="group card text-right w-full overflow-hidden hover:shadow-card-hover hover:-translate-y-[1px] transition-all duration-200"
    >
      {/* Thumbnail area */}
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 h-40 flex items-center justify-center">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Play button */}
        <div className="relative w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-brand-600 transition-all duration-200">
          <Play className="w-6 h-6 text-white fill-white mr-[-2px]" />
        </div>

        {/* New badge */}
        {video.isNew && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              חדש
            </span>
          </div>
        )}

        {/* Duration */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" />
          {video.durationLabel}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-petra-text text-sm mb-1">{video.title}</h3>
        <p className="text-xs text-petra-muted leading-relaxed">{video.description}</p>
      </div>
    </button>
  );
}

function VideoModal({
  video,
  onClose,
}: {
  video: TutorialVideo;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-0 sm:p-4" onClick={onClose}>
      <div
        className="relative z-10 w-full sm:max-w-4xl mx-auto flex flex-col h-full sm:h-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button + title */}
        <div className="flex items-center justify-between p-3 sm:mb-3 sm:px-1">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="text-right flex-1 mr-2">
            <h3 className="text-white font-bold text-base sm:text-lg">{video.title}</h3>
            <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">{video.description}</p>
          </div>
        </div>

        {/* Video player */}
        <div className="sm:rounded-2xl overflow-hidden shadow-2xl bg-black flex-1 sm:flex-none">
          <video
            src={video.url}
            controls
            autoPlay
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            className="w-full h-full sm:h-auto sm:max-h-[70vh]"
            style={{ display: "block" }}
          >
            הדפדפן שלך לא תומך בהפעלת וידאו.
          </video>
        </div>
      </div>
    </div>
  );
}
