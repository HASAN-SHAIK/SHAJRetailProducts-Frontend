import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useBranchStore } from '../store/branchStore';
import { hasFeature } from '../utils/entitlements';
import { PosDatabaseSyncManager } from '../components/PosSetup/PosDatabaseSyncManager';
import './SetupScreen.css';

const SETUP_VIDEO_LAST_PLAYED_KEY = 'setup_video_last_played_date_v1';

const getTodayKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const SetupScreen = () => {
  const navigate = useNavigate();
  const userDetails = useSelector((state) => state.user.userDetails);
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);

  const setupVideoSrc = `${process.env.PUBLIC_URL || ''}/videoes/SettingUp%20Video.mp4`;
  const videoRef = useRef(null);
  const hasMarkedPlayedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(true);
  const [skipVideoToday, setSkipVideoToday] = useState(() => {
    try {
      const today = getTodayKey();
      const lastPlayed = localStorage.getItem(SETUP_VIDEO_LAST_PLAYED_KEY);
      return lastPlayed === today;
    } catch {
      return false;
    }
  });
  const [videoDone, setVideoDone] = useState(false);
  const [showVideoDrawer, setShowVideoDrawer] = useState(false);

  const isMobileDevice =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 768px)').matches ||
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  const mobileAccessEnabled = hasFeature(tenantConfig, 'mobile_access');

  useEffect(() => {
    if (skipVideoToday) {
      setVideoDone(true);
    }
  }, [skipVideoToday]);

  const markPlayedToday = () => {
    if (hasMarkedPlayedRef.current) return;
    hasMarkedPlayedRef.current = true;
    try {
      localStorage.setItem(SETUP_VIDEO_LAST_PLAYED_KEY, getTodayKey());
    } catch {
      // Ignore storage failures and continue video playback.
    }
  };

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

  const handleSetupComplete = () => {
    const targetRoute = isMobileDevice && mobileAccessEnabled ? '/m/neworder' : '/billing/retail';
    navigate(targetRoute, { replace: true });
  };

  return (
    <div className="setup-page-wrapper">
      <header className="setup-header-brand">
        <h1 className="setup-brand-title">SHAJRetail POS</h1>
        <p className="setup-brand-subtitle">Database Preparation & Terminal Setup</p>
      </header>

      <main className="setup-main-content">
        <PosDatabaseSyncManager
          userDetails={userDetails}
          branchId={selectedBranchId}
          onComplete={handleSetupComplete}
          autoRedirect={true}
          allowSkip={true}
        />

        {/* Optional Collapsible Tutorial / Setup Video Section */}
        <section className="setup-video-drawer" aria-label="Tutorial Video Section">
          <button
            type="button"
            className="setup-video-toggle"
            onClick={() => setShowVideoDrawer((prev) => !prev)}
            aria-expanded={showVideoDrawer}
          >
            <span>📹 {showVideoDrawer ? 'Hide Business Setup Video' : 'Watch Business Setup Video (Optional)'}</span>
            <span>{showVideoDrawer ? '▲' : '▼'}</span>
          </button>

          {showVideoDrawer && (
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
                      aria-label="Business setup progress video"
                      onClick={handleVideoClick}
                      onPlay={markPlayedToday}
                      onEnded={() => setVideoDone(true)}
                      onError={() => setVideoDone(true)}
                    />
                    <button
                      className="setup-unmute"
                      type="button"
                      aria-label={isMuted ? 'Unmute setup video' : 'Mute setup video'}
                      onClick={isMuted ? handleUnmute : handleMute}
                    >
                      {isMuted ? 'Tap To Unmute' : 'Tap To Mute'}
                    </button>
                  </>
                )}
                <div className="setup-caption">SettingUp Video</div>
              </div>
              <div
                className={`setup-status${videoDone ? ' setup-status--done' : ''}`}
                role="status"
                aria-live="polite"
              >
                <span className="setup-spinner" aria-hidden="true" />
                <span>Setting Up Your Business</span>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default SetupScreen;
