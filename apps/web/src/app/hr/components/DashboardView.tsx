'use client';

import Link from 'next/link';
import {
  Anchor,
  Box,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { MotionStagger } from '@/components/hr/MotionPrimitives';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCardSkeleton, TableSkeleton } from '@/components/ui/SkeletonBlocks';
import { useHrDashboard } from '@/hooks/useHrDashboard';
import { listItemVariants, motionTransition } from '@/lib/motion';
import { DASHBOARD_STAGE_COLS } from '@/lib/pipeline-rail';
import { density, palette } from '@/theme';
import type { MetricCardProps } from '@/types/ui';
import { motion } from 'framer-motion';
import { DashboardCandidatesTable } from './DashboardCandidatesTable';

function candidatesHref(jobId: string, stage: string | null): string {
  const params = new URLSearchParams({ job_id: jobId });
  if (stage) params.set('stage', stage);
  if (!stage) params.set('status', 'REJECTED');
  return `/hr/candidates?${params.toString()}`;
}

export function DashboardView() {
  const { data, error, isLoading } = useHrDashboard();

  if (isLoading) {
    return (
      <Stack gap={density.sectionGap}>
        <PageHeader title="Dashboard" subtitle="What needs attention right now." />
        <MetricCardSkeleton count={8} />
        <TableSkeleton rows={4} />
      </Stack>
    );
  }

  if (error || !data) {
    return <ErrorState title="Dashboard unavailable" message="Could not load HR dashboard." />;
  }

  const { totals, by_job } = data;

  const tiles: MetricCardProps[] = [
    {
      label: 'Needs your review',
      value: totals.needs_review,
      href: '/hr/candidates?stage=INITIAL_SCREENING_REVIEW',
      emphasis: 'primary',
      tone: 'warning',
    },
    {
      label: 'Applicants',
      value: totals.applicants,
      href: '/hr/candidates',
    },
    {
      label: 'New today',
      value: totals.new_today,
      href: '/hr/candidates',
      emphasis: 'default',
    },
    {
      label: 'Assessments pending',
      value: totals.assessments_pending,
      href: '/hr/candidates?stage=TECH_ASSESSMENT_SENT',
    },
    {
      label: 'Tech tests pending',
      value: totals.techtests_pending,
      href: '/hr/candidates?stage=RECORDED_TECH_INVITED',
    },
    {
      label: 'Interviews upcoming',
      value: totals.interviews_upcoming,
      href: '/hr/interviews',
    },
    {
      label: 'Hired',
      value: totals.hired,
      href: '/hr/candidates?stage=HIRED',
      tone: 'success',
      emphasis: 'muted',
    },
    {
      label: 'Rejected',
      value: totals.rejected,
      href: '/hr/candidates?status=REJECTED',
      tone: 'danger',
      emphasis: 'muted',
    },
  ];

  return (
    <Stack gap={density.sectionGap}>
      <PageHeader
        title="Dashboard"
        subtitle="What needs attention right now."
        actions={
          <MotionButton
            component={Link}
            href="/hr/jobs/new"
            className="cursor-pointer rounded-lg"
            aria-label="Create new job"
            size="sm"
          >
            New job
          </MotionButton>
        }
      />

      <MotionStagger>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {tiles.map((tile) => (
            <motion.div key={tile.label} variants={listItemVariants} transition={motionTransition}>
              <MetricCard {...tile} />
            </motion.div>
          ))}
        </SimpleGrid>
      </MotionStagger>

      <DashboardCandidatesTable />

      {by_job.length === 0 ? (
        <EmptyState
          title="No published jobs yet"
          description="Create a job and publish it to see the hiring pipeline."
          action={
            <MotionButton
              component={Link}
              href="/hr/jobs/new"
              className="cursor-pointer rounded-lg"
              aria-label="Create new job"
            >
              New job
            </MotionButton>
          }
        />
      ) : (
        <motion.div
          variants={listItemVariants}
          initial="initial"
          animate="animate"
          transition={motionTransition}
        >
          <Box
            style={{
              overflow: 'auto',
              border: `1px solid ${palette.border}`,
              borderRadius: 8,
              background: palette.surface,
            }}
          >
            <Text
              size="sm"
              fw={600}
              px="md"
              py="sm"
              style={{ borderBottom: `1px solid ${palette.border}` }}
            >
              Pipeline by job
            </Text>
            <Table
              highlightOnHover
              horizontalSpacing="md"
              verticalSpacing="xs"
              stickyHeader
              style={{ minWidth: 720 }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: palette.paper,
                      minWidth: 160,
                    }}
                  >
                    Job
                  </Table.Th>
                  {DASHBOARD_STAGE_COLS.map((col) => (
                    <Table.Th key={col.key} style={{ whiteSpace: 'nowrap' }}>
                      {col.label}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {by_job.map((job) => (
                  <Table.Tr key={job.job_id}>
                    <Table.Td
                      style={{
                        position: 'sticky',
                        left: 0,
                        background: palette.surface,
                        zIndex: 1,
                      }}
                    >
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
                          {count > 0 ? (
                            <Anchor
                              component={Link}
                              href={candidatesHref(job.job_id, col.stage)}
                              aria-label={`${job.title} ${col.label}: ${count}`}
                              c="accent"
                              underline="hover"
                              fw={500}
                              size="sm"
                            >
                              {count}
                            </Anchor>
                          ) : (
                            <Text size="sm" c="dimmed">
                              0
                            </Text>
                          )}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        </motion.div>
      )}
    </Stack>
  );
}
