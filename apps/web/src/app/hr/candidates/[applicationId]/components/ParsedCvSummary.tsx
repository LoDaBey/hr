'use client';

import {
  Badge,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { formatWorkDateRange } from '@/lib/format';
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
  summary?: string;
  description?: string;
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

function toStr(v: unknown): string {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed.toLowerCase() === 'null' ? '' : trimmed;
  }
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && 'name' in v) {
    return toStr((v as { name: unknown }).name);
  }
  return '';
}

function workTitle(entry: WorkEntry): string {
  return entry.title ?? entry.role ?? entry.position ?? '';
}

function workSummary(entry: WorkEntry): string {
  const text = entry.summary ?? entry.description ?? '';
  return typeof text === 'string' ? text.trim() : '';
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
    return languages
      .map((l) => {
        if (typeof l === 'string') return l;
        if (l && typeof l === 'object') {
          const o = l as Record<string, unknown>;
          const name = o.language ?? o.name ?? '';
          const level = o.level ?? o.proficiency ?? '';
          return [name, level].filter(Boolean).join(': ');
        }
        return '';
      })
      .filter(Boolean);
  }
  return Object.entries(languages)
    .map(([lang, level]) => `${lang}: ${level}`)
    .filter(([l]) => Boolean(l));
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function SkillChips({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <Text size="sm" fw={600} mb={6}>
        {label}
      </Text>
      <Group gap={6} wrap="wrap">
        {items.map((s) => (
          <Badge key={s} variant="light" color="accent" size="sm">
            {s}
          </Badge>
        ))}
      </Group>
    </div>
  );
}

export function ParsedCvSummary({ parsed }: { parsed: ParsedCv }) {
  const skills = sortedUnique(
    Array.isArray(parsed.skills) ? parsed.skills.map(toStr).filter(Boolean) : [],
  );
  const technologies = sortedUnique(
    Array.isArray(parsed.technologies) ? parsed.technologies.map(toStr).filter(Boolean) : [],
  );

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
        <Text fw={700} size="lg" style={{ color: palette.accent }}>
          {yearsExp} {yearsExp === 1 ? 'year' : 'years'} experience
        </Text>
      )}

      <SkillChips label="Skills" items={skills} />
      <SkillChips label="Technologies" items={technologies} />

      {workEntries.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={6}>
            Work history
          </Text>
          <Stack gap={12}>
            {workEntries.map((entry, i) => {
              const company = entry.company ?? '';
              const title = workTitle(entry);
              const dates = formatWorkDateRange(
                entry.start ?? entry.start_date,
                entry.end ?? entry.end_date,
              );
              const summary = workSummary(entry);
              return (
                <div key={i}>
                  <Group gap={4} wrap="wrap">
                    {company ? (
                      <Text size="sm" fw={600}>
                        {company}
                      </Text>
                    ) : null}
                    {company && title ? (
                      <Text size="sm" c="dimmed">
                        ·
                      </Text>
                    ) : null}
                    {title ? <Text size="sm">{title}</Text> : null}
                  </Group>
                  {dates ? (
                    <Text size="xs" c="dimmed">
                      {dates}
                    </Text>
                  ) : null}
                  {summary ? (
                    <Text size="sm" mt={4}>
                      {summary}
                    </Text>
                  ) : null}
                </div>
              );
            })}
          </Stack>
        </div>
      )}

      {eduEntries.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={6}>
            Education
          </Text>
          <Stack gap={4}>
            {eduEntries.map((e, i) => (
              <Text key={i} size="sm">
                {educationLine(e)}
              </Text>
            ))}
          </Stack>
        </div>
      )}

      {langs.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={4}>
            Languages
          </Text>
          <Group gap="xs" wrap="wrap">
            {langs.map((l, i) => (
              <Text key={i} size="sm">
                {l}
              </Text>
            ))}
          </Group>
        </div>
      )}

      {certs.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={4}>
            Certifications
          </Text>
          <Stack gap={4}>
            {certs.map((c, i) => (
              <Text key={i} size="sm">
                {certLine(c)}
              </Text>
            ))}
          </Stack>
        </div>
      )}

      {projects.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={6}>
            Projects
          </Text>
          <Stack gap={8}>
            {projects.map((p, i) => {
              const name = p.name ?? p.title ?? `Project ${i + 1}`;
              const desc = p.description ?? '';
              return (
                <div key={i}>
                  <Text size="sm" fw={600}>
                    {name}
                  </Text>
                  {desc ? <Text size="sm" c="dimmed">{desc}</Text> : null}
                </div>
              );
            })}
          </Stack>
        </div>
      )}
    </Stack>
  );
}
