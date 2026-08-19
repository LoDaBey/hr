-- Migration 006: fix hard_requirements using == with array values (military status)
UPDATE HRSYSTEM_jobs
SET hard_requirements = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN elem->>'op' = '=='
          AND jsonb_typeof(elem->'value') = 'array'
        THEN jsonb_set(elem, '{op}', '"in"'::jsonb)
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(hard_requirements) AS elem
)
WHERE hard_requirements IS NOT NULL
  AND jsonb_typeof(hard_requirements) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(hard_requirements) AS elem
    WHERE elem->>'op' = '=='
      AND jsonb_typeof(elem->'value') = 'array'
  );
