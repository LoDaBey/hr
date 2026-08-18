'use client';

import { useState } from 'react';
import { Group, Modal, Stack, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { useDeleteHrCandidate } from '@/hooks/useHrCandidates';
import { ApiError } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';

export function CandidateRowActions({
  applicationId,
  fullName,
  onDeleted,
}: {
  applicationId: string;
  fullName: string;
  onDeleted: () => void;
}) {
  const deleteCandidate = useDeleteHrCandidate();
  const [opened, setOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteCandidate(applicationId);
      toastSuccess(
        result.candidate_deleted
          ? 'Candidate and application deleted'
          : 'Application deleted',
      );
      setOpened(false);
      onDeleted();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not delete candidate';
      toastError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <MotionButton
        className="cursor-pointer rounded-lg"
        aria-label={`Delete candidate ${fullName}`}
        size="compact-sm"
        color="danger"
        variant="light"
        onClick={() => setOpened(true)}
      >
        Delete
      </MotionButton>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Delete candidate?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Delete <strong>{fullName}</strong> and this application? Screening, assessments,
            interviews, and emails for this application are removed. If they have no other
            applications, the candidate record is removed too.
          </Text>
          <Group justify="flex-end">
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Cancel delete candidate"
              variant="default"
              disabled={deleting}
              onClick={() => setOpened(false)}
            >
              Cancel
            </MotionButton>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label={`Confirm delete candidate ${fullName}`}
              color="danger"
              loading={deleting}
              onClick={() => void handleDelete()}
            >
              Delete
            </MotionButton>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
