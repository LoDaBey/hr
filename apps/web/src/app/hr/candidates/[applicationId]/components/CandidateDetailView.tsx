'use client';

import Link from 'next/link';
import {
  Anchor,
  Box,
  Group,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { IconMail, IconPhone } from '@tabler/icons-react';
import { AssessmentInviteBar } from '@/components/hr/AssessmentInviteBar';
import { AssessmentReview } from '@/components/hr/AssessmentReview';
import { CandidateAvatar } from '@/components/hr/CandidateAvatar';
import { DecisionBar } from '@/components/hr/DecisionBar';
import { ApplicationStatusBadge } from '@/components/hr/status/DomainStatusBadges';
import { TechTestInviteBar } from '@/components/hr/TechTestInviteBar';
import { TechTestReview } from '@/components/hr/TechTestReview';
import { useRouter } from 'next/navigation';
import { CandidateRowActions } from '../../components/CandidateRowActions';
import { ApplicationAnswersSection } from './ApplicationAnswersSection';
import { CandidateEmailsSection } from './CandidateEmailsSection';
import { CandidateTimelineSection } from './CandidateTimelineSection';
import { FinalDecisionBar } from './FinalDecisionBar';
import {
  InterviewPanelsSection,
  isFinalInterviewPanelStage,
} from './InterviewPanelsSection';
import { ParsedCvSummary } from './ParsedCvSummary';
import { ScreeningResultSection } from './ScreeningResultSection';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { StageBadge } from '@/components/StageBadge';
import { StageRail } from '@/components/StageRail';
import { PageSkeleton } from '@/components/ui/SkeletonBlocks';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { datetime } from '@/lib/format';
import { useHrCandidate } from '@/hooks/useHrCandidate';
import { density, palette, shadows } from '@/theme';
import type { Stage } from '@/types/domain';

const ASSESSMENT_INVITE_STAGES: Stage[] = [
  'INITIAL_SHORTLISTED',
  'TECH_ASSESSMENT_SENT',
  'TECH_ASSESSMENT_STARTED',
];

const TECHTEST_INVITE_STAGES: Stage[] = [
  'TECH_SHORTLISTED',
  'RECORDED_TECH_INVITED',
  'RECORDED_TECH_STARTED',
];

function parseStatusMessage(status: string): string | null {
  if (status === 'DONE') return null;
  if (status === 'FAILED') return 'Could not read this CV — open the file';
  if (status === 'PENDING') return 'Reading CV…';
  if (status === 'MANUAL') return 'CV needs manual review';
  return null;
}

function DecisionBarSlot({
  applicationId,
  application,
  assessment,
  techtest,
  communications,
  interviews,
  data,
  assessmentAutoSkipped,
  techtestAutoSkipped,
  onMutate,
}: {
  applicationId: string;
  application: import('@/types/domain').Application;
  assessment: import('@/types/api').HrCandidatesGetResult['assessment'];
  techtest: import('@/types/api').HrCandidatesGetResult['techtest'];
  communications: import('@/types/domain').Communication[];
  interviews: import('@/types/domain').Interview[];
  data: import('@/types/api').HrCandidatesGetResult;
  assessmentAutoSkipped: boolean;
  techtestAutoSkipped: boolean;
  onMutate: () => void;
}) {
  const showAssessmentInvite = ASSESSMENT_INVITE_STAGES.includes(application.stage);
  const showTechTestInvite = TECHTEST_INVITE_STAGES.includes(application.stage);
  const showInterviewPanels = isFinalInterviewPanelStage(application.stage);
  const showFinalDecision = application.stage === 'FINAL_INTERVIEW_COMPLETED';

  if (showAssessmentInvite) {
    return (
      <AssessmentInviteBar
        applicationId={applicationId}
        stage={application.stage}
        assessment={assessment}
        communications={communications}
        jobHasAssessment={data.job_has_assessment}
        autoInviteSkipped={assessmentAutoSkipped}
        onInvited={onMutate}
      />
    );
  }
  if (showTechTestInvite) {
    return (
      <TechTestInviteBar
        applicationId={applicationId}
        stage={application.stage}
        techtest={techtest}
        communications={communications}
        jobHasTechTest={data.job_has_techtest}
        autoInviteSkipped={techtestAutoSkipped}
        onInvited={onMutate}
      />
    );
  }
  if (showFinalDecision || showInterviewPanels) {
    return (
      <Stack gap="sm">
        {showFinalDecision ? (
          <FinalDecisionBar
            applicationId={applicationId}
            candidateName={data.candidate.full_name}
            onDecided={onMutate}
          />
        ) : null}
        {showInterviewPanels ? (
          <InterviewPanelsSection
            applicationId={applicationId}
            stage={application.stage}
            interviews={interviews}
            onMutate={onMutate}
          />
        ) : null}
      </Stack>
    );
  }
  return (
    <DecisionBar
      applicationId={applicationId}
      stage={application.stage}
      onDecided={onMutate}
    />
  );
}

export function CandidateDetailView({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useHrCandidate(applicationId);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error || !data) {
    return (
      <ErrorState title="Candidate not found" message="This application could not be loaded." />
    );
  }

  const {
    candidate,
    application,
    job,
    application_answers,
    cv,
    screening,
    screening_pending,
    assessment,
    techtest,
    interviews,
    communications,
    timeline,
  } = data;
  const assessmentAutoSkipped = timeline.some(
    (e) =>
      e.event_type === 'AUTO_INVITE_SKIPPED' &&
      e.payload &&
      typeof e.payload === 'object' &&
      (e.payload as { kind?: string }).kind === 'ASSESSMENT',
  );
  const techtestAutoSkipped = timeline.some(
    (e) =>
      e.event_type === 'AUTO_INVITE_SKIPPED' &&
      e.payload &&
      typeof e.payload === 'object' &&
      (e.payload as { kind?: string }).kind === 'TECH_TEST',
  );
  const cvStatusMessage = cv ? parseStatusMessage(cv.parse_status) : null;
  const refresh = () => void mutate();
  const hasAssessments = Boolean(assessment?.review || techtest?.review);

  return (
    <Stack gap={density.sectionGap}>
      <Box
        p="md"
        style={{
          background: palette.surface,
          border: `1px solid ${palette.border}`,
          borderRadius: 8,
          boxShadow: shadows.sm,
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
            <Group gap="md" align="flex-start" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <CandidateAvatar name={candidate.full_name} size={48} />
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Title order={1} style={{ fontSize: '1.5rem' }}>
                  {candidate.full_name}
                </Title>
                <Group gap="md" wrap="wrap">
                  <Group gap={6}>
                    <IconMail size={14} style={{ color: palette.muted }} aria-hidden />
                    <Anchor href={`mailto:${candidate.email}`} size="sm" c="dimmed" underline="hover">
                      {candidate.email}
                    </Anchor>
                  </Group>
                  {candidate.phone ? (
                    <Group gap={6}>
                      <IconPhone size={14} style={{ color: palette.muted }} aria-hidden />
                      <Anchor href={`tel:${candidate.phone}`} size="sm" c="dimmed" underline="hover">
                        {candidate.phone}
                      </Anchor>
                    </Group>
                  ) : null}
                </Group>
                <Text size="sm">
                  <Anchor
                    component={Link}
                    href={`/hr/jobs/${job.id}`}
                    c="accent"
                    underline="hover"
                    fw={500}
                    aria-label={`Open job ${job.title}`}
                  >
                    {job.title}
                  </Anchor>
                  <Text span c="dimmed" size="sm">
                    {' '}
                    · applied {datetime(application.created_at)}
                  </Text>
                </Text>
              </Stack>
            </Group>
            <Group gap="sm" align="flex-start">
              <ApplicationStatusBadge status={application.status} />
              <StageBadge stage={application.stage} />
              <CandidateRowActions
                applicationId={application.id}
                fullName={candidate.full_name}
                onDeleted={() => router.push('/hr/candidates')}
              />
            </Group>
          </Group>

          <StageRail stage={application.stage} size="lg" showLabels />
        </Stack>
      </Box>

      <Box
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: palette.paper,
          paddingBottom: 4,
          paddingTop: 2,
        }}
      >
        <DecisionBarSlot
          applicationId={application.id}
          application={application}
          assessment={assessment}
          techtest={techtest}
          communications={communications}
          interviews={interviews}
          data={data}
          assessmentAutoSkipped={assessmentAutoSkipped}
          techtestAutoSkipped={techtestAutoSkipped}
          onMutate={refresh}
        />
      </Box>

      <Tabs defaultValue="overview" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="screening">Screening</Tabs.Tab>
          <Tabs.Tab value="assessments" disabled={!hasAssessments}>
            Assessments
          </Tabs.Tab>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <Group
            align="flex-start"
            gap="md"
            wrap="wrap"
            grow
            preventGrowOverflow={false}
            style={{ alignItems: 'flex-start' }}
          >
            <Box style={{ flex: '2 1 0%', minWidth: 260, maxWidth: '100%' }}>
              <SectionCard title="Application answers">
                <ApplicationAnswersSection answers={application_answers} />
              </SectionCard>
            </Box>

            <Box style={{ flex: '3 1 0%', minWidth: 320, maxWidth: '100%' }}>
              <SectionCard title="CV">
                {cv ? (
                  <Stack gap="sm">
                    <Group gap="sm" wrap="wrap">
                      <MotionButton
                        component="a"
                        href={`/api/hr/candidates/${application.id}/cv`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer rounded-lg"
                        aria-label="Open CV"
                        size="sm"
                      >
                        Open CV
                      </MotionButton>
                      <Text size="sm" c="dimmed">
                        {cv.original_name}
                      </Text>
                      {cvStatusMessage ? (
                        <StatusBadge
                          label={cvStatusMessage}
                          tone={cv.parse_status === 'FAILED' ? 'danger' : 'warning'}
                        />
                      ) : null}
                    </Group>
                    <Text fw={600} size="sm">
                      Extracted from CV
                    </Text>
                    {cv.parsed ? (
                      <ParsedCvSummary parsed={cv.parsed as import('./ParsedCvSummary').ParsedCv} />
                    ) : (
                      <Text c="dimmed" size="sm">
                        No parsed summary yet.
                      </Text>
                    )}
                  </Stack>
                ) : (
                  <Text c="dimmed" size="sm">
                    No CV uploaded. Request one if this role requires it.
                  </Text>
                )}
              </SectionCard>
            </Box>
          </Group>
        </Tabs.Panel>

        <Tabs.Panel value="screening">
          <SectionCard title="Screening result">
            <ScreeningResultSection screening={screening} screeningPending={screening_pending} />
          </SectionCard>
        </Tabs.Panel>

        <Tabs.Panel value="assessments">
          <Stack gap="md">
            {assessment?.review ? (
              <SectionCard title="Technical assessment review">
                <AssessmentReview
                  applicationId={applicationId}
                  gradeKind="ASSESSMENT"
                  onGraded={refresh}
                  review={{
                    id: assessment.id,
                    status: assessment.status,
                    late: assessment.late,
                    ai_score: assessment.ai_score,
                    ai_max_score: assessment.ai_max_score,
                    submitted_at: assessment.submitted_at,
                    overall_feedback: assessment.review.overall_feedback,
                    has_overall_evaluation: assessment.review.has_overall_evaluation,
                    grading_error: assessment.review.grading_error,
                    questions: assessment.review.questions,
                  }}
                />
              </SectionCard>
            ) : null}

            {techtest?.review ? (
              <SectionCard title="Recorded technical interview">
                <TechTestReview
                  applicationId={applicationId}
                  onGraded={refresh}
                  review={{
                    id: techtest.id,
                    status: techtest.status,
                    late: techtest.late,
                    ai_score: techtest.ai_score,
                    ai_max_score: techtest.ai_max_score,
                    submitted_at: techtest.submitted_at,
                    overall_feedback: techtest.review.overall_feedback,
                    has_overall_evaluation: techtest.review.has_overall_evaluation,
                    grading_error: techtest.review.grading_error,
                    questions: techtest.review.questions,
                    recording_status: techtest.recording_status,
                    recording: techtest.review.recording,
                    transcript: techtest.review.transcript,
                    proctoring_flag: techtest.review.proctoring_flag,
                    proctoring_summary: techtest.review.proctoring_summary,
                    preflight_external_display: techtest.review.preflight_external_display,
                    events: techtest.review.events,
                    session_started_at: techtest.started_at,
                  }}
                />
              </SectionCard>
            ) : null}

            {!hasAssessments ? (
              <Text c="dimmed" size="sm">
                No assessment or recorded interview results yet.
              </Text>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="activity">
          <Group
            align="flex-start"
            gap="md"
            wrap="wrap"
            grow
            preventGrowOverflow={false}
            style={{ alignItems: 'stretch' }}
          >
            <Box style={{ flex: '2 1 0%', minWidth: 280, maxWidth: '100%' }}>
              <SectionCard title="Emails" description="Outbound messages for this application">
                {communications.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    No emails queued for this candidate yet.
                  </Text>
                ) : (
                  <CandidateEmailsSection communications={communications} onChanged={refresh} />
                )}
              </SectionCard>
            </Box>

            <Box style={{ flex: '3 1 0%', minWidth: 320, maxWidth: '100%' }}>
              <SectionCard title="Timeline" description="Stage changes and system events">
                <CandidateTimelineSection timeline={timeline} />
              </SectionCard>
            </Box>
          </Group>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
