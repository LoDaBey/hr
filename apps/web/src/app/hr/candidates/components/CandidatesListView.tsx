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
  Title,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { StageRail } from '@/components/StageRail';
import { datetime } from '@/lib/format';
import {
  CANDIDATE_LIST_STAGES,
  RECOMMENDATION,
  STAGE,
  STATUS,
  labelOf,
  selectOptions,
  stageLabel,
} from '@/lib/labels';
import { useHrCandidates } from '@/hooks/useHrCandidates';
import { useHrJobs } from '@/hooks/useHrJobs';
import { density } from '@/theme';
import type { Recommendation, Stage, Status } from '@/types/domain';
import { CandidateRowActions } from './CandidateRowActions';

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

  const jobOptions = (jobsData?.jobs ?? []).map((j) => ({
    value: j.id,
    label: j.title,
  }));

  return (
    <Stack gap="md">
      <Title order={1}>Candidates</Title>

      <Group align="flex-end" wrap="wrap">
        <Select
          className="rounded outline-none"
          label="Job"
          aria-label="Filter by job"
          clearable
          searchable
          data={jobOptions}
          value={jobId}
          onChange={(value) => setParams({ job_id: value })}
          w={220}
        />
        <Select
          className="rounded outline-none"
          label="Stage"
          aria-label="Filter by stage"
          clearable
          data={STAGE_OPTIONS}
          value={stage}
          onChange={(value) => setParams({ stage: value })}
          w={220}
        />
        <Select
          className="rounded outline-none"
          label="Status"
          aria-label="Filter by status"
          clearable
          data={STATUS_OPTIONS}
          value={status}
          onChange={(value) => setParams({ status: value })}
          w={160}
        />
        <TextInput
          className="rounded outline-none"
          label="Search"
          aria-label="Search candidates by name or email"
          placeholder="Name or email"
          value={q ?? ''}
          onChange={(e) => setParams({ q: e.currentTarget.value || null })}
          w={200}
        />
        <NumberInput
          className="rounded outline-none"
          label="Min score"
          aria-label="Minimum screening score"
          value={minScore ? Number(minScore) : ''}
          onChange={(value) =>
            setParams({ min_score: value === '' || value == null ? null : String(value) })
          }
          w={120}
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
          w={120}
        />
        {filtersActive ? (
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Clear candidate filters"
            variant="default"
            onClick={() => router.push(pathname)}
          >
            Clear
          </MotionButton>
        ) : null}
      </Group>

      {error ? (
        <ErrorState title="Could not load candidates" message={error.message} />
      ) : (
        <DataTable
          withTableBorder
          borderRadius="sm"
          highlightOnHover
          minHeight={200}
          fetching={isLoading}
          records={data?.rows ?? []}
          idAccessor="application_id"
          columns={[
            {
              accessor: 'full_name',
              title: 'Name',
              render: (row) => (
                <Link
                  href={`/hr/candidates/${row.application_id}`}
                  aria-label={`Open candidate ${row.full_name}`}
                >
                  {row.full_name}
                </Link>
              ),
            },
            { accessor: 'email', title: 'Email' },
            { accessor: 'job_title', title: 'Job' },
            {
              accessor: 'stage',
              title: 'Stage',
              width: 180,
              render: (row) => (
                <Stack gap={0}>
                  <StageRail stage={row.stage as Stage} size="sm" />
                  <Text size="xs" c="dimmed" mt={density.stageRail.labelOffset}>
                    {stageLabel(row.stage as Stage)}
                  </Text>
                </Stack>
              ),
            },
            {
              accessor: 'status',
              title: 'Status',
              render: (row) => (
                <Text size="sm">{labelOf(STATUS, row.status as Status)}</Text>
              ),
            },
            { accessor: 'screening_score', title: 'Score' },
            {
              accessor: 'recommendation',
              title: 'AI rec',
              render: (row) =>
                labelOf(RECOMMENDATION, row.recommendation as Recommendation | null),
            },
            {
              accessor: 'created_at',
              title: 'Applied',
              render: (row) => datetime(row.created_at),
            },
            {
              accessor: 'actions',
              title: 'Actions',
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
          noRecordsText={
            filtersActive ? 'No matches for these filters' : 'No candidates yet'
          }
        />
      )}

      {filtersActive && data && data.total === 0 ? (
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label="Clear filters to see all candidates"
          variant="light"
          w="fit-content"
          onClick={() => router.push(pathname)}
        >
          Clear filters
        </MotionButton>
      ) : null}
    </Stack>
  );
}
