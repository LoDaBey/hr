'use client';

import { useState } from 'react';
import { Alert, Group, Loader, NumberInput, Stack, Switch, Text, Title } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { useHrSettings } from '@/hooks/useHrSettings';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { HrSettingsPatchPayload, HrSettingsResult } from '@/types/api';

export function SettingsView() {
  const { data, error, isLoading, mutate } = useHrSettings();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<HrSettingsPatchPayload | null>(null);

  const values: HrSettingsResult | null = data
    ? {
        ...data,
        ...draft,
      }
    : null;

  async function save() {
    if (!draft || Object.keys(draft).length === 0) return;
    setSaving(true);
    try {
      await api<HrSettingsResult>('/api/hr/settings', {
        method: 'PATCH',
        body: draft,
      });
      setDraft(null);
      await mutate();
      toastSuccess('Settings saved');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader aria-label="Loading settings" color="accent" />
      </Group>
    );
  }

  if (error || !values) {
    return (
      <Alert color="danger" title="Could not load settings">
        {error instanceof Error ? error.message : 'Try refreshing the page.'}
      </Alert>
    );
  }

  return (
    <Stack gap={density.sectionGap} maw={640}>
      <div>
        <Title order={1} style={{ color: palette.ink }}>
          Settings
        </Title>
        <Text c="dimmed" mt="xs">
          Applies to every candidate. You can still send now or cancel from any candidate.
        </Text>
      </div>

      <Stack gap="lg">
        <Stack gap="sm">
          <Switch
            checked={values.auto_send_assessment}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                auto_send_assessment: e.currentTarget.checked,
              }))
            }
            label="Auto-send assessment invites"
            color="accent"
          />
          <Group gap="xs" align="center" wrap="wrap">
            <Text size="sm">
              When HR shortlists at screening, send the assessment invite automatically after
            </Text>
            <NumberInput
              className="rounded outline-none"
              aria-label="Assessment auto-send delay in minutes"
              value={values.auto_send_assessment_delay_minutes}
              onChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  auto_send_assessment_delay_minutes: typeof v === 'number' ? v : 0,
                }))
              }
              min={0}
              max={10080}
              w={100}
              disabled={!values.auto_send_assessment}
            />
            <Text size="sm">minutes.</Text>
          </Group>
          <Text size="xs" c="dimmed">
            0 means send immediately. The candidate deadline starts when the email is due to send.
          </Text>
        </Stack>

        <Stack gap="sm">
          <Switch
            checked={values.auto_send_techtest}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                auto_send_techtest: e.currentTarget.checked,
              }))
            }
            label="Auto-send recorded tech test invites"
            color="accent"
          />
          <Group gap="xs" align="center" wrap="wrap">
            <Text size="sm">
              When HR shortlists at technical review, send the recorded test invite automatically
              after
            </Text>
            <NumberInput
              className="rounded outline-none"
              aria-label="Recorded tech test auto-send delay in minutes"
              value={values.auto_send_techtest_delay_minutes}
              onChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  auto_send_techtest_delay_minutes: typeof v === 'number' ? v : 0,
                }))
              }
              min={0}
              max={10080}
              w={100}
              disabled={!values.auto_send_techtest}
            />
            <Text size="sm">minutes.</Text>
          </Group>
        </Stack>

        <Stack gap="sm">
          <Text fw={600} style={{ color: palette.ink }}>
            Automatic screening decisions
          </Text>
          <Text size="sm" c="dimmed">
            Strong and weak candidates move forward or out without a click. Middling scores
            stay in Needs your review. Per-job shortlist threshold overrides the default
            minimum score below.
          </Text>
          <Switch
            checked={values.auto_shortlist_enabled}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                auto_shortlist_enabled: e.currentTarget.checked,
              }))
            }
            label="Auto-shortlist strong matches"
            color="accent"
          />
          <Group gap="xs" align="center" wrap="wrap">
            <Text size="sm">Default minimum score (overridden by each job&apos;s threshold)</Text>
            <NumberInput
              className="rounded outline-none"
              aria-label="Default auto-shortlist minimum score"
              value={values.auto_shortlist_min_score}
              onChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  auto_shortlist_min_score: typeof v === 'number' ? v : 75,
                }))
              }
              min={0}
              max={100}
              w={100}
            />
          </Group>
          <Group gap="xs" align="center" wrap="wrap">
            <Text size="sm">Minimum confidence</Text>
            <NumberInput
              className="rounded outline-none"
              aria-label="Auto-shortlist minimum confidence"
              value={values.auto_shortlist_min_confidence}
              onChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  auto_shortlist_min_confidence: typeof v === 'number' ? v : 0.75,
                }))
              }
              min={0}
              max={1}
              step={0.05}
              decimalScale={2}
              w={100}
            />
          </Group>
          <Switch
            checked={values.auto_reject_hard_fail}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                auto_reject_hard_fail: e.currentTarget.checked,
              }))
            }
            label="Auto-reject hard requirement failures"
            color="accent"
          />
          <Group gap="xs" align="center" wrap="wrap">
            <Text size="sm">Auto-reject when score is at or below</Text>
            <NumberInput
              className="rounded outline-none"
              aria-label="Auto-reject maximum score"
              value={values.auto_reject_max_score}
              onChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  auto_reject_max_score: typeof v === 'number' ? v : 40,
                }))
              }
              min={0}
              max={100}
              w={100}
            />
          </Group>
        </Stack>

        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label="Save settings"
          color="accent"
          loading={saving}
          disabled={saving || !draft || Object.keys(draft).length === 0}
          onClick={() => void save()}
          style={{ alignSelf: 'flex-start' }}
        >
          Save
        </MotionButton>
      </Stack>
    </Stack>
  );
}
