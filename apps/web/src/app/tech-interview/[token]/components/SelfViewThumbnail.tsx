'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { palette } from '@/theme';

const THUMB_W = 140;
const THUMB_H = 105;
const MARGIN = 16;

export function SelfViewThumbnail({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (pos != null || typeof window === 'undefined') return;
    setPos({
      x: window.innerWidth - THUMB_W - MARGIN,
      y: window.innerHeight - THUMB_H - MARGIN,
    });
  }, [pos]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pos == null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };
    },
    [pos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const maxX = window.innerWidth - THUMB_W - MARGIN;
    const maxY = window.innerHeight - THUMB_H - MARGIN;
    setPos({
      x: Math.min(maxX, Math.max(MARGIN, drag.originX + (e.clientX - drag.startX))),
      y: Math.min(maxY, Math.max(MARGIN, drag.originY + (e.clientY - drag.startY))),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  if (!stream || pos == null) return null;

  return (
    <div
      role="img"
      aria-label="Live self-view — drag to reposition"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: THUMB_W,
        height: THUMB_H,
        zIndex: 120,
        borderRadius: 10,
        overflow: 'hidden',
        background: palette.ink,
        border: `2px solid ${palette.paper}`,
        boxShadow: `0 8px 24px ${palette.ink}44`,
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
