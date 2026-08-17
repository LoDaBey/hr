'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Box } from '@mantine/core';
import { density, palette } from '@/theme';

export function SidebarResizeHandle({
  disabled,
  onResize,
}: {
  disabled?: boolean;
  onResize: (nextWidth: number) => void;
}) {
  const dragging = useRef(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current || disabled) return;
      const next = Math.min(
        density.shellNavbarMaxWidth,
        Math.max(density.shellNavbarMinWidth, event.clientX),
      );
      onResize(next);
    },
    [disabled, onResize],
  );

  const stopDragging = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [onPointerMove, stopDragging]);

  if (disabled) return null;

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={(event) => {
        event.preventDefault();
        dragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: density.shellResizeHandleWidth,
        height: '100%',
        cursor: 'col-resize',
        background: 'transparent',
        zIndex: 2,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = `${palette.accent}55`;
      }}
      onMouseLeave={(event) => {
        if (!dragging.current) event.currentTarget.style.background = 'transparent';
      }}
    />
  );
}
