-- Migration 011: free-text AI screening criteria (replaces must-have / nice-to-have builders)
ALTER TABLE HRSYSTEM_jobs
  ADD COLUMN IF NOT EXISTS screening_criteria text;

-- Convert legacy builder rules into readable prose. Demographic hard rules (age,
-- military_status) stay in hard_requirements and are excluded from this text.
UPDATE HRSYSTEM_jobs j
SET screening_criteria = src.prose
FROM (
  SELECT
    id,
    NULLIF(
      trim(both E'\n' FROM concat_ws(
        E'\n',
        (
          SELECT string_agg(line, E'\n' ORDER BY ord)
          FROM (
            SELECT
              ord,
              CASE
                WHEN h->>'key' = 'years_experience' AND h->>'op' = '>=' THEN
                  'At least ' || coalesce(h->>'value', '') || ' years of experience.'
                WHEN h->>'key' = 'years_experience' AND h->>'op' = '<=' THEN
                  'At most ' || coalesce(h->>'value', '') || ' years of experience.'
                WHEN h->>'op' = '>=' THEN
                  'At least ' || coalesce(h->>'value', '') || ' for '
                    || coalesce(nullif(h->>'label', ''), h->>'key', 'this requirement') || '.'
                WHEN h->>'op' = '<=' THEN
                  'At most ' || coalesce(h->>'value', '') || ' for '
                    || coalesce(nullif(h->>'label', ''), h->>'key', 'this requirement') || '.'
                WHEN h->>'op' = '==' THEN
                  coalesce(nullif(h->>'label', ''), h->>'key', 'This')
                    || ' must be ' || coalesce(h->>'value', '') || '.'
                WHEN h->>'op' = 'in' THEN
                  coalesce(nullif(h->>'label', ''), h->>'key', 'This')
                    || ' must be one of: '
                    || coalesce(
                      (
                        SELECT string_agg(trim(both '"' FROM v::text), ', ')
                        FROM jsonb_array_elements_text(
                          CASE
                            WHEN jsonb_typeof(h->'value') = 'array' THEN h->'value'
                            ELSE '[]'::jsonb
                          END
                        ) AS v
                      ),
                      coalesce(h->>'value', '')
                    )
                    || '.'
                WHEN h->>'op' = 'truthy' THEN
                  coalesce(nullif(h->>'label', ''), h->>'key', 'This requirement') || ' is required.'
                ELSE
                  coalesce(nullif(h->>'label', ''), h->>'key') || '.'
              END AS line
            FROM jsonb_array_elements(coalesce(j.hard_requirements, '[]'::jsonb))
              WITH ORDINALITY AS t(h, ord)
            WHERE coalesce(h->>'key', '') NOT IN ('age', 'military_status')
          ) hard_lines
          WHERE line IS NOT NULL AND trim(line) <> '' AND trim(line) <> '.'
        ),
        (
          SELECT string_agg(line, E'\n' ORDER BY ord)
          FROM (
            SELECT
              ord,
              'Nice to have: '
                || coalesce(nullif(s->>'label', ''), s->>'key', 'this')
                || CASE
                     WHEN s ? 'weight' THEN ' (up to ' || coalesce(s->>'weight', '0') || ' points).'
                     ELSE '.'
                   END AS line
            FROM jsonb_array_elements(coalesce(j.soft_requirements, '[]'::jsonb))
              WITH ORDINALITY AS t(s, ord)
          ) soft_lines
          WHERE line IS NOT NULL AND trim(line) <> ''
        )
      )),
      ''
    ) AS prose
  FROM HRSYSTEM_jobs j
) src
WHERE j.id = src.id
  AND j.screening_criteria IS NULL
  AND src.prose IS NOT NULL;
