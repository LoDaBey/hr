'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import {
  Anchor,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ErrorState } from '@/components/ErrorState';
import { MotionStagger } from '@/components/hr/MotionPrimitives';
import { useHrDashboard } from '@/hooks/useHrDashboard';
import { listItemVariants, motionTransition } from '@/lib/motion';
import { DASHBOARD_STAGE_COLS } from '@/lib/pipeline-rail';
import { dismissBanner, toast } from '@/lib/toast';
import { density, palette } from '@/theme';
import { motion } from 'framer-motion';

const DASHBOARD_ALERT_ID = 'dashboard-alerts';

function candidatesHref(jobId: string, stage: string | null): string {
  const params = new URLSearchParams({ job_id: jobId });
  if (stage) params.set('stage', stage);
  if (!stage) params.set('status', 'REJECTED');
  return `/hr/candidates?${params.toString()}`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <motion.div variants={listItemVariants} transition={motionTransition} whileHover={{ y: -2 }}>
      <Paper withBorder p="md" radius={density.defaultRadius} style={{ borderColor: `${palette.ink}14` }}>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Text fw={700} size="xl" style={{ color: palette.ink, letterSpacing: density.titleLetterSpacing }}>
          {value}
        </Text>
      </Paper>
    </motion.div>
  );
}

export function DashboardView() {
  const { data, error, isLoading } = useHrDashboard();

  useEffect(() => {
    if (!data) return;
    const { totals } = data;
    if (totals.failed_emails <= 0 && totals.open_errors <= 0) {
      dismissBanner(DASHBOARD_ALERT_ID);
      return;
    }

    const parts: string[] = [];
    if (totals.failed_emails > 0) {
      parts.push(
        `${totals.failed_emails} failed email${totals.failed_emails === 1 ? '' : 's'}`,
      );
    }
    if (totals.open_errors > 0) {
      parts.push(
        `${totals.open_errors} open workflow error${totals.open_errors === 1 ? '' : 's'}`,
      );
    }

    toast.error(
      (t) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <strong>Attention needed:</strong> {parts.join('. ')}.
          <a
            href="/hr/errors"
            aria-label="Open errors page"
            onClick={() => toast.dismiss(t.id)}
            style={{ color: palette.accent, textDecoration: 'underline', marginLeft: 4 }}
          >
            View errors
          </a>
        </span>
      ),
      {
        id: DASHBOARD_ALERT_ID,
        duration: 12000,
      },
    );
  }, [data]);

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader aria-label="Loading dashboard" color="accent" />
      </Group>
    );
  }

  if (error || !data) {
    return <ErrorState title="Dashboard unavailable" message="Could not load HR dashboard." />;
  }

  const { totals, by_job } = data;

  const tiles: Array<{ label: string; value: number }> = [
    { label: 'Needs your review', value: totals.needs_review },
    { label: 'Applicants', value: totals.applicants },
    { label: 'New today', value: totals.new_today },
    { label: 'Assessments pending', value: totals.assessments_pending },
    { label: 'Tech tests pending', value: totals.techtests_pending },
    { label: 'Interviews upcoming', value: totals.interviews_upcoming },
    { label: 'Hired', value: totals.hired },
    { label: 'Rejected', value: totals.rejected },
  ];

  return (
    <Stack gap={density.sectionGap}>
      <Title order={1}>Dashboard</Title>

      <MotionStagger>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {tiles.map((tile) => (
            <StatCard key={tile.label} label={tile.label} value={tile.value} />
          ))}
        </SimpleGrid>
      </MotionStagger>

      {by_job.length === 0 ? (
        <Paper withBorder p="lg" radius={density.defaultRadius}>
          <Text c="dimmed">No published jobs yet. Create a job and publish it to see the pipeline.</Text>
        </Paper>
      ) : (
        <motion.div
          variants={listItemVariants}
          initial="initial"
          animate="animate"
          transition={motionTransition}
        >
          <Paper withBorder radius={density.defaultRadius} style={{ overflow: 'hidden', borderColor: `${palette.ink}14` }}>
            <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Job</Table.Th>
                  {DASHBOARD_STAGE_COLS.map((col) => (
                    <Table.Th key={col.key}>{col.label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {by_job.map((job) => (
                  <Table.Tr key={job.job_id}>
                    <Table.Td>
                      <Anchor
                        component={Link}
                        href={`/hr/jobs/${job.job_id}`}
                        aria-label={`Open job ${job.title}`}
                        c="accent"
                        underline="hover"
                        fw={600}
                        size="sm"
                      >
                        {job.title}
                      </Anchor>
                    </Table.Td>
                    {DASHBOARD_STAGE_COLS.map((col) => {
                      const count = job.counts[col.key] ?? 0;
                      return (
                        <Table.Td key={col.key}>
                          <Anchor
                            component={Link}
                            href={candidatesHref(job.job_id, col.stage)}
                            aria-label={`${job.title} ${col.label}: ${count}`}
                            c="accent"
                            underline="hover"
                          >
                            {count}
                          </Anchor>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </motion.div>
      )}
    </Stack>
  );
}
