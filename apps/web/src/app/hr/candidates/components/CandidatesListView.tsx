'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { CandidateAvatar } from '@/components/hr/CandidateAvatar';
import { ApplicationStatusBadge } from '@/components/hr/status/DomainStatusBadges';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { StageBadge } from '@/components/StageBadge';
import { StageRail } from '@/components/StageRail';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { datetime } from '@/lib/format';
import {
  CANDIDATE_LIST_STAGES,
  RECOMMENDATION,
  STAGE,
  STATUS,
  labelOf,
  selectOptions,
} from '@/lib/labels';
import { useHrCandidates } from '@/hooks/useHrCandidates';
import { useHrJobs } from '@/hooks/useHrJobs';
import type { FilterChip } from '@/types/ui';
import type { Recommendation, Stage, Status } from '@/types/domain';
import { CandidateRowActions } from './CandidateRowActions';
import { ScreeningPendingCell } from './ScreeningPendingCell';

const pageSize = 20;

const STAGE_OPTIONS = selectOptions(STAGE, CANDIDATE_LIST_STAGES);
const STATUS_OPTIONS = selectOptions(STATUS);

export function CandidatesListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const jobId = searchParams.get('job_id');
  const stage = searchParams.get('stage');
  const status = searchParams.get('status');
  const q = searchParams.get('q');
  const minScore = searchParams.get('min_score');
  const minExperience = searchParams.get('min_experience');
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const filtersActive = Boolean(jobId || stage || status || q || minScore || minExperience);

  const query = useMemo(
    () => ({
      job_id: jobId,
      stage,
      status,
      q,
      min_score: minScore,
      min_experience: minExperience,
      page,
      page_size: pageSize,
    }),
    [jobId, stage, status, q, minScore, minExperience, page],
  );

  const { data, error, isLoading, mutate } = useHrCandidates(query);
  const { data: jobsData } = useHrJobs();

  const setParams = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete('page');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const clearAll = () => router.push(pathname);

  const jobOptions = (jobsData?.jobs ?? []).map((j) => ({
    value: j.id,
    label: j.title,
  }));

  const chips: FilterChip[] = [];
  if (jobId) {
    const jobLabel = jobOptions.find((j) => j.value === jobId)?.label ?? 'Job';
    chips.push({ key: 'job_id', label: `Job: ${jobLabel}`, onRemove: () => setParams({ job_id: null }) });
  }
  if (stage) {
    chips.push({
      key: 'stage',
      label: `Stage: ${labelOf(STAGE, stage as Stage)}`,
      onRemove: () => setParams({ stage: null }),
    });
  }
  if (status) {
    chips.push({
      key: 'status',
      label: `Status: ${labelOf(STATUS, status as Status)}`,
      onRemove: () => setParams({ status: null }),
    });
  }
  if (q) {
    chips.push({ key: 'q', label: `Search: ${q}`, onRemove: () => setParams({ q: null }) });
  }
  if (minScore) {
    chips.push({
      key: 'min_score',
      label: `Min score: ${minScore}`,
      onRemove: () => setParams({ min_score: null }),
    });
  }
  if (minExperience) {
    chips.push({
      key: 'min_experience',
      label: `Min years: ${minExperience}`,
      onRemove: () => setParams({ min_experience: null }),
    });
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Candidates"
        count={data?.total}
        subtitle="Search, filter, and open applications."
      />

      <FilterBar chips={chips} onClearAll={filtersActive ? clearAll : undefined}>
        <Select
          className="rounded outline-none"
          label="Job"
          aria-label="Filter by job"
          clearable
          searchable
          data={jobOptions}
          value={jobId}
          onChange={(value) => setParams({ job_id: value })}
          w={200}
        />
        <Select
          className="rounded outline-none"
          label="Stage"
          aria-label="Filter by stage"
          clearable
          data={STAGE_OPTIONS}
          value={stage}
          onChange={(value) => setParams({ stage: value })}
          w={200}
        />
        <Select
          className="rounded outline-none"
          label="Status"
          aria-label="Filter by status"
          clearable
          data={STATUS_OPTIONS}
          value={status}
          onChange={(value) => setParams({ status: value })}
          w={140}
        />
        <TextInput
          className="rounded outline-none"
          label="Search"
          aria-label="Search candidates by name or email"
          placeholder="Name or email"
          value={q ?? ''}
          onChange={(e) => setParams({ q: e.currentTarget.value || null })}
          w={180}
        />
        <NumberInput
          className="rounded outline-none"
          label="Min score"
          aria-label="Minimum screening score"
          value={minScore ? Number(minScore) : ''}
          onChange={(value) =>
            setParams({ min_score: value === '' || value == null ? null : String(value) })
          }
          w={110}
        />
        <NumberInput
          className="rounded outline-none"
          label="Min years"
          aria-label="Minimum years of experience"
          value={minExperience ? Number(minExperience) : ''}
          onChange={(value) =>
            setParams({
              min_experience: value === '' || value == null ? null : String(value),
            })
          }
          w={110}
        />
      </FilterBar>

      {error ? (
        <ErrorState title="Could not load candidates" message={error.message} />
      ) : !isLoading && (data?.rows?.length ?? 0) === 0 ? (
        <EmptyState
          title={filtersActive ? 'No matches for these filters' : 'No candidates yet'}
          description={
            filtersActive
              ? 'Try clearing filters or adjusting search.'
              : 'Candidates appear here when they apply to a job.'
          }
          action={
            filtersActive ? (
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Clear filters to see all candidates"
                variant="light"
                onClick={clearAll}
              >
                Clear filters
              </MotionButton>
            ) : null
          }
        />
      ) : (
        <DataTable
          className="hr-data-table"
          withTableBorder
          borderRadius="md"
          highlightOnHover
          minHeight={200}
          fetching={isLoading}
          records={data?.rows ?? []}
          idAccessor="application_id"
          columns={[
            {
              accessor: 'full_name',
              title: 'Candidate',
              render: (row) => (
                <Group gap="sm" wrap="nowrap">
                  <CandidateAvatar name={row.full_name} size={32} />
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text
                      component={Link}
                      href={`/hr/candidates/${row.application_id}`}
                      aria-label={`Open candidate ${row.full_name}`}
                      fw={600}
                      size="sm"
                      c="accent"
                      style={{ textDecoration: 'none' }}
                      lineClamp={1}
                    >
                      {row.full_name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {row.email}
                    </Text>
                  </Stack>
                </Group>
              ),
            },
            {
              accessor: 'job_title',
              title: 'Role',
              render: (row) => (
                <Text size="sm" lineClamp={1}>
                  {row.job_title}
                </Text>
              ),
            },
            {
              accessor: 'stage',
              title: 'Stage',
              width: 200,
              render: (row) => (
                <Stack gap={4}>
                  <StageRail stage={row.stage as Stage} size="sm" />
                  <StageBadge stage={row.stage as Stage} />
                </Stack>
              ),
            },
            {
              accessor: 'status',
              title: 'Status',
              render: (row) => <ApplicationStatusBadge status={row.status as Status} />,
            },
            {
              accessor: 'screening_score',
              title: 'Score',
              width: 80,
              render: (row) =>
                row.screening_pending ? (
                  <ScreeningPendingCell />
                ) : (
                  <Text size="sm" fw={600}>
                    {row.screening_score ?? '—'}
                  </Text>
                ),
            },
            {
              accessor: 'recommendation',
              title: 'Match',
              render: (row) =>
                row.screening_pending ? (
                  <ScreeningPendingCell />
                ) : (
                  <Text size="sm">
                    {labelOf(RECOMMENDATION, row.recommendation as Recommendation | null)}
                  </Text>
                ),
            },
            {
              accessor: 'created_at',
              title: 'Applied',
              render: (row) => (
                <Text size="sm" c="dimmed">
                  {datetime(row.created_at)}
                </Text>
              ),
            },
            {
              accessor: 'actions',
              title: '',
              width: 56,
              render: (row) => (
                <CandidateRowActions
                  applicationId={row.application_id}
                  fullName={row.full_name}
                  onDeleted={() => void mutate()}
                />
              ),
            },
          ]}
          totalRecords={data?.total ?? 0}
          recordsPerPage={pageSize}
          page={page}
          onPageChange={(nextPage) => setParams({ page: String(nextPage) }, false)}
          noRecordsText=""
        />
      )}
    </Stack>
  );
}
