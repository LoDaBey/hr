import type { ReactNode } from 'react';
import { IBM_Plex_Sans, Source_Serif_4 } from 'next/font/google';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'mantine-datatable/styles.css';
import './globals.css';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import { palette } from '@/theme';
import Providers from './providers';

const display = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata = { title: 'Recruitment' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      {...mantineHtmlProps}
      className={`${display.variable} ${body.variable}`}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body style={{ background: palette.paper, color: palette.ink }}>
        <Providers
          fonts={{
            heading: 'var(--font-display), "Source Serif 4", Georgia, serif',
            body: 'var(--font-body), "IBM Plex Sans", system-ui, sans-serif',
          }}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
