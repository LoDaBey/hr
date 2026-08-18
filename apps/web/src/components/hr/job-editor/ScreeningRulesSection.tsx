'use client';

import { Button, Group, NumberInput, Select, Stack, Textarea, Title } from '@mantine/core';
import type { HardDraft, SoftDraft } from '@/types/job-editor';
import { HARD_OP_OPTIONS, ON_FAIL_OPTIONS } from '@/types/job-editor';
import { DEFAULT_HARD_FAIL } from '@/lib/labels';
import type { HardRequirement } from '@/types/domain';

export function ScreeningRulesSection({
  hardRows,
  softRows,
  fieldOptions,
  onHardChange,
  onSoftChange,
  onDirty,
}: {
  hardRows: HardDraft[];
  softRows: SoftDraft[];
  fieldOptions: Array<{ value: string; label: string }>;
  onHardChange: (rows: HardDraft[]) => void;
  onSoftChange: (rows: SoftDraft[]) => void;
  onDirty: () => void;
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Title order={4}>Must have</Title>
        <Button
          className="cursor-pointer rounded-lg"
          aria-label="Add must-have rule"
          variant="default"
          size="compact-sm"
          onClick={() => {
            onHardChange([
              ...hardRows,
              {
                fieldKey: fieldOptions[0]?.value ?? 'years_experience',
                op: '>=',
                value: '',
                on_fail: DEFAULT_HARD_FAIL,
              },
            ]);
            onDirty();
          }}
        >
          Add must-have
        </Button>
      </Group>

      {hardRows.map((row, index) => (
        <Stack key={`hard-${index}`} gap="xs">
          <Group align="flex-end" wrap="wrap">
            <Select
              className="rounded outline-none"
              label="Field"
              aria-label={`Must-have field ${index + 1}`}
              data={fieldOptions}
              value={row.fieldKey}
              onChange={(value) => {
                if (!value) return;
                const next = [...hardRows];
                next[index] = { ...row, fieldKey: value };
                onHardChange(next);
                onDirty();
              }}
            />
            <Select
              className="rounded outline-none"
              label="Condition"
              aria-label={`Must-have condition ${index + 1}`}
              data={HARD_OP_OPTIONS}
              value={row.op}
              onChange={(value) => {
                if (!value) return;
                const next = [...hardRows];
                next[index] = { ...row, op: value as HardRequirement['op'] };
                onHardChange(next);
                onDirty();
              }}
            />
            <Select
              className="rounded outline-none"
              label="If not met"
              aria-label={`Must-have if not met ${index + 1}`}
              data={ON_FAIL_OPTIONS}
              value={row.on_fail}
              onChange={(value) => {
                if (!value) return;
                const next = [...hardRows];
                next[index] = { ...row, on_fail: value as HardRequirement['on_fail'] };
                onHardChange(next);
                onDirty();
              }}
            />
            <Button
              className="cursor-pointer rounded-lg"
              aria-label={`Remove must-have rule ${index + 1}`}
              variant="subtle"
              color="danger"
              onClick={() => {
                onHardChange(hardRows.filter((_, i) => i !== index));
                onDirty();
              }}
            >
              Remove
            </Button>
          </Group>
          {row.op !== 'truthy' ? (
            <Textarea
              className="rounded outline-none"
              label="Value"
              aria-label={`Must-have value ${index + 1}`}
              minRows={3}
              autosize
              value={row.value}
              onChange={(e) => {
                const next = [...hardRows];
                next[index] = { ...row, value: e.currentTarget.value };
                onHardChange(next);
                onDirty();
              }}
            />
          ) : null}
        </Stack>
      ))}

      <Group justify="space-between" align="center" mt="md">
        <Title order={4}>Nice to have</Title>
        <Button
          className="cursor-pointer rounded-lg"
          aria-label="Add nice-to-have rule"
          variant="default"
          size="compact-sm"
          onClick={() => {
            onSoftChange([
              ...softRows,
              {
                fieldKey: fieldOptions[0]?.value ?? 'years_experience',
                weight: 5,
              },
            ]);
            onDirty();
          }}
        >
          Add nice-to-have
        </Button>
      </Group>

      {softRows.map((row, index) => (
        <Group key={`soft-${index}`} align="flex-end" wrap="wrap">
          <Select
            className="rounded outline-none"
            label="Field"
            aria-label={`Nice-to-have field ${index + 1}`}
            data={fieldOptions}
            value={row.fieldKey}
            onChange={(value) => {
              if (!value) return;
              const next = [...softRows];
              next[index] = { ...row, fieldKey: value };
              onSoftChange(next);
              onDirty();
            }}
            style={{ flex: 1, minWidth: 220 }}
          />
          <NumberInput
            className="rounded outline-none"
            label="Points"
            aria-label={`Nice-to-have points ${index + 1}`}
            description="How much this adds to the score"
            min={1}
            max={20}
            value={row.weight}
            onChange={(value) => {
              const next = [...softRows];
              next[index] = { ...row, weight: Number(value) || 5 };
              onSoftChange(next);
              onDirty();
            }}
          />
          <Button
            className="cursor-pointer rounded-lg"
            aria-label={`Remove nice-to-have rule ${index + 1}`}
            variant="subtle"
            color="danger"
            onClick={() => {
              onSoftChange(softRows.filter((_, i) => i !== index));
              onDirty();
            }}
          >
            Remove
          </Button>
        </Group>
      ))}
    </Stack>
  );
}
