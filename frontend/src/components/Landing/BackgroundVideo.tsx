'use client';

import { useEffect, useRef } from 'react';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';

const FADE_MS = 500;
const FADE_OUT_THRESHOLD_S = 0.55;
const LOOP_RESTART_DELAY_MS = 100;

/**
 * Fixed, full-viewport looping background video that sits behind the entire
 * page (nav, hero copy, feature cards, footer) rather than just one section.
 * Uses a custom rAF fade system instead of CSS transitions: 500ms fade-in on
 * load/loop-start, 500ms fade-out starting 0.55s before the clip ends, then a
 * hard cut to opacity 0 on "ended" followed by a 100ms reset before looping.
 */
export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = '0';

    const cancelFade = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const fadeTo = (target: number, duration: number) => {
      cancelFade();
      const currentVideo = videoRef.current;
      if (!currentVideo) return;

      const parsed = parseFloat(currentVideo.style.opacity);
      const start = Number.isNaN(parsed) ? (target === 1 ? 0 : 1) : parsed;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const value = start + (target - start) * t;
        if (currentVideo) currentVideo.style.opacity = String(value);

        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(step);
    };

    const handlePlaying = () => {
      fadeTo(1, FADE_MS);
    };

    const handleTimeUpdate = () => {
      const duration = video.duration;
      if (!duration || Number.isNaN(duration)) return;

      const remaining = duration - video.currentTime;
      if (remaining <= FADE_OUT_THRESHOLD_S && !fadingOutRef.current) {
        fadingOutRef.current = true;
        fadeTo(0, FADE_MS);
      }
    };

    const handleEnded = () => {
      cancelFade();
      video.style.opacity = '0';

      window.setTimeout(() => {
        const currentVideo = videoRef.current;
        if (!currentVideo) return;
        currentVideo.currentTime = 0;
        fadingOutRef.current = false;
        void currentVideo.play();
      }, LOOP_RESTART_DELAY_MS);
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      cancelFade();
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover translate-y-[17%]"
        style={{ opacity: 0 }}
        autoPlay
        muted
        playsInline
        preload="auto"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      {/* Scrim so page text/cards stay readable over the footage */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
    </div>
  );
}
