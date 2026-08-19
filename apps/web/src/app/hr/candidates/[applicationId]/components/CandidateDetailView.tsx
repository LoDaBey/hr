'use client';

import {
  Alert,
  Badge,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { AssessmentInviteBar } from '@/components/hr/AssessmentInviteBar';
import { AssessmentReview } from '@/components/hr/AssessmentReview';
import { DecisionBar } from '@/components/hr/DecisionBar';
import { TechTestInviteBar } from '@/components/hr/TechTestInviteBar';
import { TechTestReview } from '@/components/hr/TechTestReview';
import { useRouter } from 'next/navigation';
import { CandidateRowActions } from '../../components/CandidateRowActions';
import { ApplicationAnswersSection } from './ApplicationAnswersSection';
import { CandidateEmailsSection } from './CandidateEmailsSection';
import { CandidateTimelineSection } from './CandidateTimelineSection';
import { FinalDecisionBar } from './FinalDecisionBar';
import { InterviewCompleteForm } from './InterviewCompleteForm';
import { ParsedCvSummary } from './ParsedCvSummary';
import { ScreeningResultSection } from './ScreeningResultSection';
import { ScheduleForm } from '@/app/hr/interviews/components/ScheduleForm';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { StageRail } from '@/components/StageRail';
import { datetime } from '@/lib/format';
import { labelOf, stageLabel, STATUS } from '@/lib/labels';
import { useHrCandidate } from '@/hooks/useHrCandidate';
import { density, palette } from '@/theme';
import type { Stage, Status } from '@/types/domain';

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{ borderColor: `${palette.ink}14` }}
    >
      <Stack gap="sm">
        <Title order={3}>{title}</Title>
        {children}
      </Stack>
    </Paper>
  );
}

function parseStatusMessage(status: string): string | null {
  if (status === 'DONE') return null;
  if (status === 'FAILED') return 'Could not read this CV — open the file';
  if (status === 'PENDING') return 'Reading CV…';
  if (status === 'MANUAL') return 'CV needs manual review';
  return null;
}

export function CandidateDetailView({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useHrCandidate(applicationId);

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader aria-label="Loading candidate" color="accent" />
      </Group>
    );
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
    assessment,
    techtest,
    interviews,
    communications,
    timeline,
  } = data;
  const showAssessmentInvite = ASSESSMENT_INVITE_STAGES.includes(application.stage);
  const showTechTestInvite = TECHTEST_INVITE_STAGES.includes(application.stage);
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
  const showSchedule =
    application.stage === 'FINAL_INTERVIEW_PENDING' ||
    application.stage === 'SECOND_FINAL_INTERVIEW';
  const showComplete =
    application.stage === 'FINAL_INTERVIEW_SCHEDULED' &&
    interviews.some((i) => i.status === 'SCHEDULED');
  const showFinalDecision = application.stage === 'FINAL_INTERVIEW_COMPLETED';
  const openInterview = interviews.find((i) => i.status === 'SCHEDULED');
  const cvStatusMessage = cv ? parseStatusMessage(cv.parse_status) : null;

  return (
    <Stack gap={density.sectionGap}>
      <Paper
        withBorder
        p="md"
        radius={density.defaultRadius}
        style={{ borderColor: `${palette.ink}14` }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              <Title order={1}>{candidate.full_name}</Title>
              <Text c="dimmed">
                {candidate.email}
                {candidate.phone ? ` · ${candidate.phone}` : ''}
              </Text>
              <Text size="sm">
                {job.title} · applied {datetime(application.created_at)}
              </Text>
            </div>
            <Group gap="sm" align="flex-start">
              <Badge variant="outline" color="ink">
                {labelOf(STATUS, application.status as Status)}
              </Badge>
              <CandidateRowActions
                applicationId={application.id}
                fullName={candidate.full_name}
                onDeleted={() => router.push('/hr/candidates')}
              />
            </Group>
          </Group>

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              {stageLabel(application.stage)}
            </Text>
            <StageRail stage={application.stage} size="lg" showLabels />
          </Stack>
        </Stack>
      </Paper>

      {showAssessmentInvite ? (
        <AssessmentInviteBar
          applicationId={application.id}
          stage={application.stage}
          assessment={assessment}
          communications={communications}
          jobHasAssessment={data.job_has_assessment}
          autoInviteSkipped={assessmentAutoSkipped}
          onInvited={() => void mutate()}
        />
      ) : showTechTestInvite ? (
        <TechTestInviteBar
          applicationId={application.id}
          stage={application.stage}
          techtest={techtest}
          communications={communications}
          jobHasTechTest={data.job_has_techtest}
          autoInviteSkipped={techtestAutoSkipped}
          onInvited={() => void mutate()}
        />
      ) : showFinalDecision ? (
        <FinalDecisionBar
          applicationId={application.id}
          candidateName={candidate.full_name}
          onDecided={() => void mutate()}
        />
      ) : showComplete && openInterview ? (
        <Paper
          withBorder
          p="md"
          radius={density.defaultRadius}
          style={{ borderColor: `${palette.ink}14` }}
        >
          <Stack gap="sm">
            <Text fw={600}>Complete interview</Text>
            <InterviewCompleteForm
              interviewId={openInterview.id}
              onCompleted={() => void mutate()}
            />
          </Stack>
        </Paper>
      ) : showSchedule ? (
        <Paper
          withBorder
          p="md"
          radius={density.defaultRadius}
          style={{ borderColor: `${palette.ink}14` }}
        >
          <Stack gap="sm">
            <Text fw={600}>Schedule final interview</Text>
            <ScheduleForm
              applicationId={application.id}
              roundNo={application.stage === 'SECOND_FINAL_INTERVIEW' ? 2 : 1}
              onScheduled={() => void mutate()}
            />
          </Stack>
        </Paper>
      ) : (
        <DecisionBar
          applicationId={application.id}
          stage={application.stage}
          onDecided={() => void mutate()}
        />
      )}

      <Section title="Application answers">
        <ApplicationAnswersSection answers={application_answers} />
      </Section>

      <Section title="CV">
        {cv ? (
          <>
            <Group>
              <MotionButton
                component="a"
                href={`/api/hr/candidates/${application.id}/cv`}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer rounded-lg"
                aria-label="Open CV"
              >
                Open CV
              </MotionButton>
              <Text size="sm" c="dimmed">
                {cv.original_name}
              </Text>
              {cvStatusMessage ? (
                <Badge color="warning" variant="light">
                  {cvStatusMessage}
                </Badge>
              ) : null}
            </Group>
            <Text fw={600}>Extracted from CV</Text>
            {cv.parsed ? (
              <ParsedCvSummary parsed={cv.parsed as import('./ParsedCvSummary').ParsedCv} />
            ) : (
              <Text c="dimmed">No parsed summary yet.</Text>
            )}
          </>
        ) : (
          <Text c="dimmed">No CV uploaded. Request one if this role requires it.</Text>
        )}
      </Section>

      <Section title="Screening result">
        <ScreeningResultSection screening={screening} />
      </Section>

      {assessment?.review ? (
        <Section title="Technical assessment review">
          <AssessmentReview
            review={{
              id: assessment.id,
              late: assessment.late,
              ai_score: assessment.ai_score,
              ai_max_score: assessment.ai_max_score,
              submitted_at: assessment.submitted_at,
              overall_feedback: assessment.review.overall_feedback,
              questions: assessment.review.questions,
            }}
          />
        </Section>
      ) : null}

      {techtest?.review ? (
        <Section title="Recorded technical interview">
          <TechTestReview
            review={{
              id: techtest.id,
              late: techtest.late,
              ai_score: techtest.ai_score,
              ai_max_score: techtest.ai_max_score,
              submitted_at: techtest.submitted_at,
              overall_feedback: techtest.review.overall_feedback,
              questions: techtest.review.questions,
              recording_status: techtest.recording_status,
              recording: techtest.review.recording,
              proctoring_flag: techtest.review.proctoring_flag,
              proctoring_summary: techtest.review.proctoring_summary,
              events: techtest.review.events,
              session_started_at: techtest.started_at,
            }}
          />
        </Section>
      ) : null}

      <Section title="Emails">
        <CandidateEmailsSection
          communications={communications}
          onChanged={() => void mutate()}
        />
      </Section>

      <Section title="Timeline">
        <CandidateTimelineSection timeline={timeline} />
      </Section>
    </Stack>
  );
}
