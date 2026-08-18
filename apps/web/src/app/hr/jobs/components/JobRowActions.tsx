'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Group, Modal, Stack, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { useDeleteHrJob } from '@/hooks/useHrJobs';
import { ApiError } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';

export function JobRowActions({
  jobId,
  title,
  onDeleted,
}: {
  jobId: string;
  title: string;
  onDeleted: () => void;
}) {
  const deleteJob = useDeleteHrJob();
  const [opened, setOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteJob(jobId);
      toastSuccess('Job deleted');
      setOpened(false);
      onDeleted();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not delete job';
      toastError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Group gap="xs" wrap="nowrap">
        <MotionButton
          component={Link}
          href={`/hr/jobs/${jobId}`}
          className="cursor-pointer rounded-lg"
          aria-label={`Edit job ${title}`}
          size="compact-sm"
          variant="light"
        >
          Edit
        </MotionButton>
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label={`Delete job ${title}`}
          size="compact-sm"
          color="danger"
          variant="light"
          onClick={() => setOpened(true)}
        >
          Delete
        </MotionButton>
      </Group>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Delete job?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Delete <strong>{title}</strong>? This also removes applications and assessments for
            this job.
          </Text>
          <Group justify="flex-end">
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Cancel delete job"
              variant="default"
              disabled={deleting}
              onClick={() => setOpened(false)}
            >
              Cancel
            </MotionButton>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label={`Confirm delete job ${title}`}
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
