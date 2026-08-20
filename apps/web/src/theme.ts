/**
 * Visual system
 *
 * Palette:
 *   ink     #1A2332  — text, chrome
 *   paper   #F4F6F8  — canvas (page background)
 *   surface #FFFFFF  — raised cards on paper
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
  surface: '#FFFFFF',
  accent: '#0F6E72',
  danger: '#B42318',
  success: '#1F7A4D',
  warning: '#A15C07',
  muted: '#5c6778',
  border: 'rgba(26, 35, 50, 0.10)',
  borderStrong: 'rgba(26, 35, 50, 0.16)',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(26, 35, 50, 0.04), 0 1px 3px rgba(26, 35, 50, 0.06)',
  md: '0 2px 6px rgba(26, 35, 50, 0.06), 0 4px 12px rgba(26, 35, 50, 0.06)',
} as const;

export const density = {
  defaultRadius: 'md' as const,
  bodyFontSize: 14,
  bodyLineHeight: 1.55,
  titleLetterSpacing: '-0.02em',
  controlHeight: 36,
  controlHeightSm: 30,
  tableRowHeight: 48,
  shellNavbarWidth: 240,
  shellNavbarCollapsedWidth: 72,
  shellNavbarMinWidth: 200,
  shellNavbarMaxWidth: 360,
  shellHeaderHeight: 56,
  shellResizeHandleWidth: 4,
  shellLoginCardWidth: 420,
  contentMaxWidth: 720,
  publicContentMaxWidth: 1120,
  pagePadding: 'md' as const,
  sectionGap: 'md' as const,
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
        h1: { fontSize: '1.75rem', lineHeight: '1.25', fontWeight: '600' },
        h2: { fontSize: '1.375rem', lineHeight: '1.3', fontWeight: '600' },
        h3: { fontSize: '1.125rem', lineHeight: '1.35', fontWeight: '600' },
        h4: { fontSize: '1rem', lineHeight: '1.4', fontWeight: '600' },
        h5: { fontSize: '0.9375rem', lineHeight: '1.4', fontWeight: '600' },
        h6: { fontSize: '0.8125rem', lineHeight: '1.45', fontWeight: '600' },
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
    white: palette.surface,
    primaryShade: 5,
    cursorType: 'pointer',
    focusRing: 'auto',
    shadows: {
      xs: shadows.sm,
      sm: shadows.sm,
      md: shadows.md,
      lg: shadows.md,
      xl: shadows.md,
    },
    components: {
      Button: {
        defaultProps: {
          radius: density.defaultRadius,
        },
        styles: {
          root: {
            fontWeight: 500,
          },
        },
      },
      ActionIcon: {
        defaultProps: {
          radius: density.defaultRadius,
        },
      },
      Paper: {
        defaultProps: {
          radius: density.defaultRadius,
          bg: palette.surface,
          withBorder: true,
        },
        styles: {
          root: {
            borderColor: palette.border,
          },
        },
      },
      Card: {
        defaultProps: {
          radius: density.defaultRadius,
          bg: palette.surface,
          withBorder: true,
          padding: 'md',
        },
        styles: {
          root: {
            borderColor: palette.border,
          },
        },
      },
      TextInput: {
        defaultProps: {
          radius: density.defaultRadius,
        },
        styles: {
          input: {
            minHeight: density.controlHeight,
          },
        },
      },
      Textarea: {
        defaultProps: {
          radius: density.defaultRadius,
        },
      },
      Select: {
        defaultProps: {
          radius: density.defaultRadius,
        },
        styles: {
          input: {
            minHeight: density.controlHeight,
          },
        },
      },
      NumberInput: {
        defaultProps: {
          radius: density.defaultRadius,
        },
        styles: {
          input: {
            minHeight: density.controlHeight,
          },
        },
      },
      PasswordInput: {
        defaultProps: {
          radius: density.defaultRadius,
        },
        styles: {
          input: {
            minHeight: density.controlHeight,
          },
        },
      },
      Table: {
        defaultProps: {
          horizontalSpacing: 'md',
          verticalSpacing: 'sm',
          highlightOnHover: true,
        },
        styles: {
          th: {
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: palette.muted,
            backgroundColor: palette.paper,
          },
          td: {
            fontSize: `${density.bodyFontSize}px`,
          },
        },
      },
      Badge: {
        defaultProps: {
          radius: 'sm',
          variant: 'light',
        },
        styles: {
          root: {
            fontWeight: 600,
            textTransform: 'none',
          },
        },
      },
      Tabs: {
        defaultProps: {
          color: 'accent',
        },
        styles: {
          tab: {
            fontWeight: 500,
            fontSize: '13px',
          },
          list: {
            borderColor: palette.border,
          },
        },
      },
      Modal: {
        defaultProps: {
          radius: density.defaultRadius,
          centered: true,
          overlayProps: { backgroundOpacity: 0.45, blur: 2 },
        },
      },
      Alert: {
        defaultProps: {
          radius: density.defaultRadius,
        },
      },
      NavLink: {
        defaultProps: {
          color: 'accent',
        },
      },
      Tooltip: {
        defaultProps: {
          withArrow: true,
          openDelay: 200,
        },
      },
      Skeleton: {
        defaultProps: {
          radius: density.defaultRadius,
        },
      },
    },
    other: {
      palette,
      density,
      shadows,
    },
  });
}
