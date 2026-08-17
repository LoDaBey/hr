'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { schemaResolver } from '@mantine/form';
import { AnimatePresence, motion } from 'framer-motion';
import { z } from 'zod';
import { MotionButton } from '@/components/MotionButton';
import { loginCardVariants, motionTransitionSlow } from '@/lib/motion';
import { toastError } from '@/lib/toast';
import { density, palette } from '@/theme';

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const nextUrl = useRef('/hr');

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: schemaResolver(loginSchema, { sync: true }),
  });

  async function handleSubmit(values: typeof form.values) {
    setSubmitting(true);
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setSubmitting(false);

    if (result?.error) {
      toastError('Email or password is incorrect');
      return;
    }

    nextUrl.current = searchParams.get('callbackUrl') ?? '/hr';
    setLeaving(true);
  }

  return (
    <Center mih="100dvh" px="md" style={{ background: palette.paper }}>
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
            <Paper
              withBorder
              p="lg"
              radius={density.defaultRadius}
              style={{ borderColor: `${palette.ink}14` }}
            >
              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                  <Title order={1}>HR sign in</Title>
                  <TextInput
                    className="rounded outline-none"
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    aria-label="Email"
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
                    className="cursor-pointer rounded-lg"
                    aria-label="Sign in"
                    loading={submitting}
                  >
                    Sign in
                  </MotionButton>
                </Stack>
              </form>
            </Paper>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Center>
  );
}
