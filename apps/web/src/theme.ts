/**
 * Visual system
 *
 * Palette:
 *   ink     #1A2332  — text, chrome
 *   paper   #F4F6F8  — surfaces (not pure white)
 *   accent  #0F6E72  — primary action + active nav (deep teal)
 *   danger  #B42318  — rejected / failed / destructive
 *   success #1F7A4D  — hired / shortlist / sent
 *   warning #A15C07  — needs review / attention
 *
 * Type:
 *   Display — Source Serif 4 (page titles; quiet authority)
 *   Body    — IBM Plex Sans (dense tables, long HR sessions)
 *
 * Signature:
 *   Stage rail — segmented pipeline indicator filled to the candidate’s
 *   current stage. Small on list rows, large on candidate detail.
 *
 * Density: one spacing rhythm; defaultRadius = md.
 */

import { createTheme, type MantineColorsTuple, type MantineThemeOverride } from '@mantine/core';

export const palette = {
  ink: '#1A2332',
  paper: '#F4F6F8',
  accent: '#0F6E72',
  danger: '#B42318',
  success: '#1F7A4D',
  warning: '#A15C07',
} as const;

export const density = {
  defaultRadius: 'md' as const,
  bodyFontSize: 14,
  bodyLineHeight: 1.55,
  titleLetterSpacing: '-0.02em',
  shellNavbarWidth: 240,
  shellNavbarCollapsedWidth: 72,
  shellNavbarMinWidth: 200,
  shellNavbarMaxWidth: 360,
  shellHeaderHeight: 56,
  shellResizeHandleWidth: 4,
  shellLoginCardWidth: 420,
  contentMaxWidth: 720,
  publicContentMaxWidth: 1120,
  sectionGap: 'lg' as const,
  stickyBarClearance: 80,
  motion: {
    durationFast: 0.15,
    duration: 0.28,
    durationSlow: 0.4,
    stagger: 0.05,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    hoverScale: 1.05,
    tapScale: 0.95,
    pageOffset: 12,
    sidebarSpring: { type: 'spring' as const, stiffness: 320, damping: 32 },
  },
  stageRail: {
    sm: { height: 6, gap: 3, radius: 2 },
    lg: { height: 12, gap: 4, radius: 3 },
    labelOffset: 4,
  },
} as const;

/** Mantine primary scale built around palette.accent — all hex stay in this file. */
const accentScale: MantineColorsTuple = [
  '#e7f4f4',
  '#cfe9ea',
  '#9fd3d5',
  '#6cbcbf',
  '#3ea6aa',
  '#0F6E72',
  '#0d5f62',
  '#0b5053',
  '#094144',
  '#063235',
];

const dangerScale: MantineColorsTuple = [
  '#fcebeb',
  '#f7d2d0',
  '#efa9a5',
  '#e57d77',
  '#d9544c',
  '#B42318',
  '#9c1e15',
  '#831912',
  '#6b140e',
  '#520f0b',
];

const successScale: MantineColorsTuple = [
  '#e8f5ee',
  '#d0ebdc',
  '#a3d7ba',
  '#74c296',
  '#4aad75',
  '#1F7A4D',
  '#1a6842',
  '#155636',
  '#11452b',
  '#0c341f',
];

const warningScale: MantineColorsTuple = [
  '#faf0e6',
  '#f5dfc4',
  '#ebc08a',
  '#e0a04f',
  '#d48628',
  '#A15C07',
  '#8a4f06',
  '#734105',
  '#5c3404',
  '#452703',
];

const inkScale: MantineColorsTuple = [
  '#F4F6F8',
  '#e5e8ec',
  '#c8ced6',
  '#a4adba',
  '#7f8a9b',
  '#5c6778',
  '#3d4656',
  '#1A2332',
  '#141b27',
  '#0e131b',
];

export function createAppTheme(fonts: {
  heading: string;
  body: string;
}): MantineThemeOverride {
  return createTheme({
    primaryColor: 'accent',
    defaultRadius: density.defaultRadius,
    fontFamily: fonts.body,
    fontSizes: {
      xs: '12px',
      sm: '13px',
      md: `${density.bodyFontSize}px`,
      lg: '16px',
      xl: '18px',
    },
    headings: {
      fontFamily: fonts.heading,
      fontWeight: '600',
      sizes: {
        h1: { fontSize: '2rem', lineHeight: '1.2', fontWeight: '600' },
        h2: { fontSize: '1.5rem', lineHeight: '1.25', fontWeight: '600' },
        h3: { fontSize: '1.25rem', lineHeight: '1.3', fontWeight: '600' },
        h4: { fontSize: '1.1rem', lineHeight: '1.35', fontWeight: '600' },
        h5: { fontSize: '1rem', lineHeight: '1.4', fontWeight: '600' },
        h6: { fontSize: '0.875rem', lineHeight: '1.45', fontWeight: '600' },
      },
    },
    lineHeights: {
      xs: '1.4',
      sm: '1.45',
      md: String(density.bodyLineHeight),
      lg: '1.6',
      xl: '1.65',
    },
    colors: {
      accent: accentScale,
      danger: dangerScale,
      success: successScale,
      warning: warningScale,
      ink: inkScale,
    },
    black: palette.ink,
    white: palette.paper,
    primaryShade: 5,
    cursorType: 'pointer',
    focusRing: 'auto',
    components: {
      Button: {
        defaultProps: {
          radius: density.defaultRadius,
        },
      },
      Paper: {
        defaultProps: {
          radius: density.defaultRadius,
          bg: palette.paper,
        },
      },
      NavLink: {
        defaultProps: {
          color: 'accent',
        },
      },
    },
    other: {
      palette,
      density,
    },
  });
}
