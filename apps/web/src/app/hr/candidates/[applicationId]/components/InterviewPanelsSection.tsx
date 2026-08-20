'use client';

import { Accordion, Group, Paper, Text } from '@mantine/core';
import { ScheduleForm } from '@/app/hr/interviews/components/ScheduleForm';
import { inviteDeadlineShort } from '@/lib/format';
import { density, palette } from '@/theme';
import type { Interview, Stage } from '@/types/domain';
import { InterviewCompleteForm } from './InterviewCompleteForm';

const FINAL_INTERVIEW_PANEL_STAGES: Stage[] = [
  'FINAL_INTERVIEW_PENDING',
  'FINAL_INTERVIEW_SCHEDULED',
  'FINAL_INTERVIEW_COMPLETED',
  'SECOND_FINAL_INTERVIEW',
];

export function isFinalInterviewPanelStage(stage: Stage): boolean {
  return FINAL_INTERVIEW_PANEL_STAGES.includes(stage);
}

function activeRoundNo(stage: Stage): number {
  return stage === 'SECOND_FINAL_INTERVIEW' ? 2 : 1;
}

function scheduleSummary(interview: Interview | undefined): string {
  if (!interview || interview.status === 'CANCELLED') return 'Not scheduled';
  return `${inviteDeadlineShort(interview.scheduled_at)} — ${interview.interviewer_name?.trim() || '—'}`;
}

function completeSummary(interview: Interview | undefined): string | null {
  if (!interview || interview.status !== 'COMPLETED') return null;
  if (interview.score != null) return `Completed — ${interview.score}/10`;
  return 'Completed';
}

function defaultOpenPanel(stage: Stage, interview: Interview | undefined): string | null {
  if (stage === 'FINAL_INTERVIEW_PENDING' || stage === 'SECOND_FINAL_INTERVIEW') {
    return 'schedule';
  }
  if (
    stage === 'FINAL_INTERVIEW_SCHEDULED' &&
    interview?.status === 'SCHEDULED' &&
    new Date(interview.scheduled_at).getTime() <= Date.now()
  ) {
    return 'complete';
  }
  return null;
}

export function InterviewPanelsSection({
  applicationId,
  stage,
  interviews,
  onMutate,
}: {
  applicationId: string;
  stage: Stage;
  interviews: Interview[];
  onMutate: () => void;
}) {
  const roundNo = activeRoundNo(stage);
  const roundInterview =
    interviews.find((i) => i.round_no === roundNo) ??
    [...interviews].sort((a, b) => b.round_no - a.round_no)[0];
  const openInterview =
    roundInterview?.status === 'SCHEDULED' ? roundInterview : undefined;
  const scheduleState = scheduleSummary(roundInterview);
  const completeState = completeSummary(roundInterview);
  const defaultOpen = defaultOpenPanel(stage, roundInterview);

  return (
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{ borderColor: `${palette.ink}14` }}
    >
      <Accordion
        key={`${stage}-${roundInterview?.id ?? 'none'}-${roundInterview?.scheduled_at ?? ''}`}
        variant="separated"
        radius={density.defaultRadius}
        chevronPosition="right"
        defaultValue={defaultOpen}
        styles={{
          item: { borderColor: `${palette.ink}14`, backgroundColor: palette.paper },
          control: { paddingTop: 10, paddingBottom: 10 },
          label: { fontWeight: 600, color: palette.ink },
          chevron: { color: palette.ink },
        }}
      >
        <Accordion.Item value="schedule">
          <Accordion.Control aria-label="Schedule interview panel">
            <Group justify="space-between" wrap="nowrap" gap="sm" pr="xs">
              <Text fw={600} size="sm" c="ink">
                Schedule interview
              </Text>
              <Text size="sm" c="dimmed" ta="right">
                {scheduleState}
              </Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <ScheduleForm
              applicationId={applicationId}
              roundNo={roundNo}
              existing={roundInterview?.status === 'SCHEDULED' ? roundInterview : null}
              onScheduled={onMutate}
            />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="complete">
          <Accordion.Control aria-label="Complete interview panel">
            <Group justify="space-between" wrap="nowrap" gap="sm" pr="xs">
              <Text fw={600} size="sm" c="ink">
                Complete interview
              </Text>
              {completeState ? (
                <Text size="sm" c="dimmed" ta="right">
                  {completeState}
                </Text>
              ) : null}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {openInterview ? (
              <InterviewCompleteForm interviewId={openInterview.id} onCompleted={onMutate} />
            ) : (
              <Text size="sm" c="dimmed">
                {roundInterview?.status === 'COMPLETED'
                  ? 'This interview is already marked complete.'
                  : 'Complete the interview after the scheduled time.'}
              </Text>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}
