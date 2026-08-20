'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Alert,
  Box,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { schemaResolver } from '@mantine/form';
import { AnimatePresence, motion } from 'framer-motion';
import { z } from 'zod';
import { MotionButton } from '@/components/MotionButton';
import { loginCardVariants, motionTransitionSlow } from '@/lib/motion';
import { density, palette, shadows } from '@/theme';

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nextUrl = useRef('/hr');

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: schemaResolver(loginSchema, { sync: true }),
  });

  async function handleSubmit(values: typeof form.values) {
    setSubmitting(true);
    setFormError(null);
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setSubmitting(false);

    if (result?.error) {
      setFormError('Email or password is incorrect');
      return;
    }

    nextUrl.current = searchParams.get('callbackUrl') ?? '/hr';
    setLeaving(true);
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = form.validate();
    if (validation.hasErrors) return;
    void handleSubmit(form.getValues());
  }

  return (
    <Center
      mih="100dvh"
      px="md"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, ${palette.accent}22, transparent),
          ${palette.paper}
        `,
      }}
    >
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          router.push(nextUrl.current);
          router.refresh();
        }}
      >
        {!leaving ? (
          <motion.div
            key="login-card"
            variants={loginCardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={motionTransitionSlow}
            style={{ width: '100%', maxWidth: density.shellLoginCardWidth }}
          >
            <Box
              p="xl"
              style={{
                background: palette.surface,
                border: `1px solid ${palette.border}`,
                borderRadius: 12,
                boxShadow: shadows.md,
              }}
            >
              <form onSubmit={onFormSubmit}>
                <Stack gap="lg">
                  <Stack gap={6} align="center">
                    <Box
                      aria-hidden
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: `linear-gradient(135deg, ${palette.accent} 0%, #0b5053 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: `2px solid ${palette.surface}`,
                          borderRight: 'none',
                          borderBottom: 'none',
                          transform: 'rotate(45deg) translate(1px, 1px)',
                        }}
                      />
                    </Box>
                    <Title order={1} ta="center" style={{ fontSize: '1.5rem' }}>
                      Hiring
                    </Title>
                    <Text size="sm" ta="center" style={{ color: palette.muted }}>
                      Sign in to your recruitment workspace
                    </Text>
                  </Stack>

                  {formError ? (
                    <Alert color="danger" title="Sign-in failed" role="alert">
                      {formError}
                    </Alert>
                  ) : null}

                  <Stack gap="md">
                    <TextInput
                      className="rounded outline-none"
                      label="Email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      aria-label="Email"
                      placeholder="you@company.com"
                      {...form.getInputProps('email')}
                    />
                    <PasswordInput
                      className="rounded outline-none"
                      label="Password"
                      name="password"
                      autoComplete="current-password"
                      aria-label="Password"
                      {...form.getInputProps('password')}
                    />
                    <MotionButton
                      type="submit"
                      fullWidth
                      className="cursor-pointer rounded-lg"
                      aria-label="Sign in"
                      loading={submitting}
                      disabled={submitting}
                    >
                      Sign in
                    </MotionButton>
                  </Stack>
                </Stack>
              </form>
            </Box>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Center>
  );
}
