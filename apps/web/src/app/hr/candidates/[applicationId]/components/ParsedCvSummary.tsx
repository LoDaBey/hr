'use client';

import { useState } from 'react';
import {
  Anchor,
  Badge,
  Collapse,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { palette } from '@/theme';

type WorkEntry = {
  company?: string;
  title?: string;
  role?: string;
  position?: string;
  start?: string;
  start_date?: string;
  end?: string;
  end_date?: string;
  duration?: string;
  [key: string]: unknown;
};

type EducationEntry = {
  institution?: string;
  school?: string;
  degree?: string;
  field?: string;
  year?: string | number;
  end_year?: string | number;
  [key: string]: unknown;
};

type ProjectEntry = {
  name?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
};

type CertEntry = {
  name?: string;
  title?: string;
  issuer?: string;
  year?: string | number;
  [key: string]: unknown;
};

export type ParsedCv = {
  full_name?: string;
  years_experience?: number;
  skills?: unknown[];
  technologies?: unknown[];
  work_experience?: unknown[];
  education?: unknown[];
  languages?: Record<string, unknown> | unknown[];
  certifications?: unknown[];
  projects?: unknown[];
  [key: string]: unknown;
};

const MAX_SKILLS = 12;

function toStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && 'name' in v) return String((v as { name: unknown }).name);
  return '';
}

function workDate(entry: WorkEntry): string {
  const start = entry.start ?? entry.start_date ?? '';
  const end = entry.end ?? entry.end_date ?? 'Present';
  if (!start && !end) return entry.duration ?? '';
  if (!start) return String(end);
  return `${start} – ${end}`;
}

function workTitle(entry: WorkEntry): string {
  return entry.title ?? entry.role ?? entry.position ?? '';
}

function educationLine(entry: EducationEntry): string {
  const parts: string[] = [];
  const deg = entry.degree ?? '';
  const field = entry.field ?? '';
  const inst = entry.institution ?? entry.school ?? '';
  const year = entry.year ?? entry.end_year ?? '';
  if (deg && field) parts.push(`${deg} in ${field}`);
  else if (deg) parts.push(deg);
  else if (field) parts.push(field);
  if (inst) parts.push(inst);
  if (year) parts.push(String(year));
  return parts.join(' · ');
}

function certLine(c: CertEntry): string {
  const name = c.name ?? c.title ?? '';
  const issuer = c.issuer ?? '';
  const year = c.year ?? '';
  const parts = [name, issuer, year ? String(year) : ''].filter(Boolean);
  return parts.join(' · ');
}

function langLines(languages: Record<string, unknown> | unknown[] | undefined): string[] {
  if (!languages) return [];
  if (Array.isArray(languages)) {
    return languages.map((l) => {
      if (typeof l === 'string') return l;
      if (l && typeof l === 'object') {
        const o = l as Record<string, unknown>;
        const name = o.language ?? o.name ?? '';
        const level = o.level ?? o.proficiency ?? '';
        return [name, level].filter(Boolean).join(': ');
      }
      return '';
    }).filter(Boolean);
  }
  return Object.entries(languages)
    .map(([lang, level]) => `${lang}: ${level}`)
    .filter(([l]) => Boolean(l));
}

export function ParsedCvSummary({
  parsed,
  raw,
}: {
  parsed: ParsedCv;
  raw: unknown;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  const allSkills: string[] = [
    ...(Array.isArray(parsed.skills) ? parsed.skills.map(toStr).filter(Boolean) : []),
    ...(Array.isArray(parsed.technologies) ? parsed.technologies.map(toStr).filter(Boolean) : []),
  ];
  const uniqueSkills = [...new Set(allSkills)];
  const visibleSkills = uniqueSkills.slice(0, MAX_SKILLS);
  const hiddenSkillCount = uniqueSkills.length - MAX_SKILLS;

  const workEntries: WorkEntry[] = Array.isArray(parsed.work_experience)
    ? (parsed.work_experience as WorkEntry[]).slice().reverse()
    : [];

  const eduEntries: EducationEntry[] = Array.isArray(parsed.education)
    ? (parsed.education as EducationEntry[])
    : [];

  const certs: CertEntry[] = Array.isArray(parsed.certifications)
    ? (parsed.certifications as CertEntry[])
    : [];

  const projects: ProjectEntry[] = Array.isArray(parsed.projects)
    ? (parsed.projects as ProjectEntry[])
    : [];

  const langs = langLines(parsed.languages as Record<string, unknown> | unknown[] | undefined);

  const yearsExp = parsed.years_experience;

  return (
    <Stack gap="sm">
      {yearsExp != null && (
        <Group gap="xs">
          <Text fw={700} size="lg" style={{ color: palette.accent }}>
            {yearsExp} {yearsExp === 1 ? 'year' : 'years'} experience
          </Text>
        </Group>
      )}

      {uniqueSkills.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={6}>Skills &amp; technologies</Text>
          <Group gap={6} wrap="wrap">
            {visibleSkills.map((s) => (
              <Badge key={s} variant="light" color="accent" size="sm">
                {s}
              </Badge>
            ))}
            {hiddenSkillCount > 0 && (
              <Badge variant="outline" color="ink" size="sm">
                +{hiddenSkillCount} more
              </Badge>
            )}
          </Group>
        </div>
      )}

      {workEntries.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={6}>Work history</Text>
          <Stack gap={8}>
            {workEntries.map((entry, i) => {
              const company = entry.company ?? '';
              const title = workTitle(entry);
              const dates = workDate(entry);
              return (
                <div key={i}>
                  <Group gap={4} wrap="wrap">
                    {company && <Text size="sm" fw={600}>{company}</Text>}
                    {company && title && <Text size="sm" c="dimmed">·</Text>}
                    {title && <Text size="sm">{title}</Text>}
                  </Group>
                  {dates && (
                    <Text size="xs" c="dimmed">{dates}</Text>
                  )}
                </div>
              );
            })}
          </Stack>
        </div>
      )}

      {eduEntries.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={6}>Education</Text>
          <Stack gap={4}>
            {eduEntries.map((e, i) => (
              <Text key={i} size="sm">{educationLine(e)}</Text>
            ))}
          </Stack>
        </div>
      )}

      {langs.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={4}>Languages</Text>
          <Group gap="xs" wrap="wrap">
            {langs.map((l, i) => (
              <Text key={i} size="sm">{l}</Text>
            ))}
          </Group>
        </div>
      )}

      {certs.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={4}>Certifications</Text>
          <Stack gap={4}>
            {certs.map((c, i) => (
              <Text key={i} size="sm">{certLine(c)}</Text>
            ))}
          </Stack>
        </div>
      )}

      {projects.length > 0 && (
        <div>
          <Anchor
            component="button"
            size="sm"
            onClick={() => setShowProjects((p) => !p)}
            style={{ color: palette.accent }}
          >
            {showProjects ? `Hide projects` : `Show ${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </Anchor>
          <Collapse opened={showProjects}>
            <Stack gap={8} mt={8}>
              {projects.map((p, i) => {
                const name = p.name ?? p.title ?? `Project ${i + 1}`;
                const desc = p.description ?? '';
                return (
                  <div key={i}>
                    <Text size="sm" fw={600}>{name}</Text>
                    {desc && <Text size="sm" c="dimmed">{desc}</Text>}
                  </div>
                );
              })}
            </Stack>
          </Collapse>
        </div>
      )}

      <Divider style={{ borderColor: `${palette.ink}14` }} />

      <Anchor
        component="button"
        size="xs"
        c="dimmed"
        onClick={() => setShowRaw((s) => !s)}
      >
        {showRaw ? 'Hide raw' : 'View raw'}
      </Anchor>

      <Collapse opened={showRaw}>
        <Text
          size="xs"
          ff="monospace"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            background: `${palette.ink}08`,
            padding: '8px 12px',
            borderRadius: 6,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {JSON.stringify(raw, null, 2)}
        </Text>
      </Collapse>
    </Stack>
  );
}
