import React, { useEffect, useRef, useState } from 'react';

const SETUP_VIDEO_LAST_PLAYED_KEY = 'setup_video_last_played_date_v1';

const getTodayKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const SetupScreen = () => {
  const setupVideoSrc = `${process.env.PUBLIC_URL || ''}/videoes/SettingUp%20Video.mp4`;
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [skipVideoToday, setSkipVideoToday] = useState(false);
  const [videoDone, setVideoDone] = useState(false);

  useEffect(() => {
    try {
      const today = getTodayKey();
      const lastPlayed = localStorage.getItem(SETUP_VIDEO_LAST_PLAYED_KEY);
      if (lastPlayed === today) {
        setSkipVideoToday(true);
        setVideoDone(true);
      } else {
        localStorage.setItem(SETUP_VIDEO_LAST_PLAYED_KEY, today);
      }
    } catch {
      // Ignore storage failures and play video by default.
    }
  }, []);

  const handleUnmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setIsMuted(false);
    video.play().catch(() => {});
  };

  const handleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    setIsMuted(true);
  };

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  return (
    <div className={`setup-overlay${videoDone ? ' setup-overlay--done' : ''}`}>
      <div className={`setup-video-card${videoDone ? ' setup-video-card--done' : ''}`}>
        {!skipVideoToday && (
          <>
            <video
              ref={videoRef}
              className="setup-video"
              src={setupVideoSrc}
              autoPlay
              muted={isMuted}
              playsInline
              onClick={handleVideoClick}
              onEnded={() => setVideoDone(true)}
            />
            <button
              className="setup-unmute"
              type="button"
              onClick={isMuted ? handleUnmute : handleMute}
            >
              {isMuted ? 'Tap To Unmute' : 'Tap To Mute'}
            </button>
          </>
        )}
        <div className="setup-caption">SettingUp Video</div>
      </div>
      <div className={`setup-status${videoDone ? ' setup-status--done' : ''}`}>
        <span className="setup-spinner" />
        <span>Setting Up Your Business</span>
      </div>
    </div>
  );
};

export default SetupScreen;
