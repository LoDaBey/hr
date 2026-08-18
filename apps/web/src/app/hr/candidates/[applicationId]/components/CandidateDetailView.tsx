'use client';

import {
  Alert,
  Badge,
  Code,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core';
import { AssessmentInviteBar } from '@/components/hr/AssessmentInviteBar';
import { AssessmentReview } from '@/components/hr/AssessmentReview';
import { DecisionBar } from '@/components/hr/DecisionBar';
import { TechTestInviteBar } from '@/components/hr/TechTestInviteBar';
import { TechTestReview } from '@/components/hr/TechTestReview';
import { useRouter } from 'next/navigation';
import { CandidateRowActions } from '../../components/CandidateRowActions';
import { FinalDecisionBar } from './FinalDecisionBar';
import { InterviewCompleteForm } from './InterviewCompleteForm';
import { ScheduleForm } from '@/app/hr/interviews/components/ScheduleForm';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { StageRail } from '@/components/StageRail';
import { api } from '@/lib/api';
import { datetime } from '@/lib/format';
import {
  COMM_STATUS,
  HR_DECISION,
  PARSE_STATUS,
  RECOMMENDATION,
  STATUS,
  labelOf,
  stageLabel,
} from '@/lib/labels';
import { useHrCandidate } from '@/hooks/useHrCandidate';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { CommStatus, Recommendation, Stage, Status } from '@/types/domain';

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

function answerDisplay(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

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

export function CandidateDetailView({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useHrCandidate(applicationId);

  async function openCv() {
    if (!data?.cv) return;
    try {
      const refreshed = await mutate();
      const url = refreshed?.cv?.signed_url ?? data.cv.signed_url;
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        toastError('Popup blocked — allow popups and try again');
      }
    } catch {
      toastError('Could not open CV — refreshing signed URL failed');
      await mutate();
    }
  }

  async function retryEmail(communicationId: string) {
    try {
      await api(`/api/hr/emails/${communicationId}/retry`, { method: 'POST' });
      toastSuccess('Email queued for retry');
      await mutate();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

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

  const { candidate, application, job, answers, cv, screening, assessment, techtest, interviews, communications, timeline } =
    data;
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
        {answers.length === 0 ? (
          <Text c="dimmed">No answers recorded. Ask the candidate to re-apply if this looks wrong.</Text>
        ) : (
          answers.map((a) => (
            <Group key={a.question_key} align="flex-start" wrap="nowrap">
              <Text fw={600} w={220}>
                {a.label}
              </Text>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{answerDisplay(a.answer)}</Text>
            </Group>
          ))
        )}
        <Group gap="lg">
          <Text size="sm">Experience: {application.years_experience ?? '—'} years</Text>
          <Text size="sm">Expected salary: {application.expected_salary ?? '—'}</Text>
          <Text size="sm">Notice: {application.notice_period_days ?? '—'} days</Text>
        </Group>
      </Section>

      <Section title="CV">
        {cv ? (
          <>
            <Group>
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Open signed CV URL"
                onClick={() => void openCv()}
              >
                Open CV ({cv.original_name})
              </MotionButton>
              <Badge color="ink" variant="light">
                {labelOf(PARSE_STATUS, cv.parse_status)}
              </Badge>
              <Text size="sm" c="dimmed">
                Link expires in {cv.expires_in}s
              </Text>
            </Group>
            <Text fw={600}>Extracted from CV</Text>
            {cv.parsed ? (
              <Code block style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(cv.parsed, null, 2)}
              </Code>
            ) : (
              <Text c="dimmed">No parsed summary yet.</Text>
            )}
          </>
        ) : (
          <Text c="dimmed">No CV uploaded. Request one if this role requires it.</Text>
        )}
      </Section>

      <Section title="AI recommendation — not a decision">
        {screening ? (
          <>
            <Group>
              <Text>Score: {screening.score ?? '—'}</Text>
              <Badge color="accent" variant="light">
                {labelOf(RECOMMENDATION, screening.recommendation as Recommendation | null)}
              </Badge>
              <Text size="sm">Confidence: {screening.confidence ?? '—'}</Text>
              {screening.hr_decision ? (
                <Badge color="accent">HR: {labelOf(HR_DECISION, screening.hr_decision)}</Badge>
              ) : null}
            </Group>
            {screening.reasoning_summary ? <Text>{screening.reasoning_summary}</Text> : null}
            <Text size="sm">Strengths: {answerDisplay(screening.strengths)}</Text>
            <Text size="sm">Weaknesses: {answerDisplay(screening.weaknesses)}</Text>
            <Text size="sm">Missing: {answerDisplay(screening.missing_requirements)}</Text>
          </>
        ) : (
          <Alert color="ink" variant="light">
            Screening has not completed yet. Refresh shortly, or review the CV manually.
          </Alert>
        )}
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
        {communications.length === 0 ? (
          <Text c="dimmed">No emails queued for this candidate yet.</Text>
        ) : (
          communications.map((c) => (
            <Group key={c.id} justify="space-between">
              <div>
                <Text fw={500}>
                  {c.template_key} · {labelOf(COMM_STATUS, c.status as CommStatus)}
                </Text>
                <Text size="sm" c="dimmed">
                  {c.to_email} · {datetime(c.created_at)}
                  {c.last_error ? ` · ${c.last_error}` : ''}
                </Text>
              </div>
              {c.status === 'FAILED' ? (
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label={`Retry email ${c.template_key}`}
                  size="xs"
                  color="danger"
                  variant="light"
                  onClick={() => void retryEmail(c.id)}
                >
                  Retry
                </MotionButton>
              ) : null}
            </Group>
          ))
        )}
      </Section>

      <Section title="Timeline">
        {timeline.length === 0 ? (
          <Text c="dimmed">No events yet.</Text>
        ) : (
          <Timeline active={timeline.length - 1} bulletSize={18} lineWidth={2} color="accent">
            {timeline.map((event) => (
              <Timeline.Item key={event.id} title={event.event_type} bullet={<span aria-hidden />}>
                <Text size="sm" c="dimmed">
                  {datetime(event.created_at)}
                  {event.actor_label ? ` · ${event.actor_label}` : ''}
                  {event.from_stage || event.to_stage
                    ? ` · ${event.from_stage ? stageLabel(event.from_stage as Stage) : '—'} → ${
                        event.to_stage ? stageLabel(event.to_stage as Stage) : '—'
                      }`
                    : ''}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Section>
    </Stack>
  );
}
