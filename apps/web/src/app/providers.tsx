'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Toaster } from 'react-hot-toast';
import { SWRConfig } from 'swr';
import { api } from '@/lib/api';
import { createAppTheme, palette } from '@/theme';

export default function Providers({
  children,
  fonts,
}: {
  children: ReactNode;
  fonts: { heading: string; body: string };
}) {
  const theme = createAppTheme(fonts);

  return (
    <SessionProvider>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <DatesProvider settings={{ consistentWeeks: true }}>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: palette.paper,
                color: palette.ink,
                border: `1px solid ${palette.ink}22`,
                borderRadius: 8,
                fontSize: 14,
              },
              success: {
                iconTheme: {
                  primary: palette.success,
                  secondary: palette.paper,
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: palette.danger,
                  secondary: palette.paper,
                },
              },
            }}
          />
          <SWRConfig
            value={{
              fetcher: (path: string) => api(path),
              revalidateOnFocus: false,
              shouldRetryOnError: false,
            }}
          >
            {children}
          </SWRConfig>
        </DatesProvider>
      </MantineProvider>
    </SessionProvider>
  );
}
