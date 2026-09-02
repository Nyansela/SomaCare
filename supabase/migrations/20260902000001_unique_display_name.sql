-- PART A: Prevent duplicate display_name values
-- First, deduplicate existing display_name values by appending a numeric suffix
-- to any duplicates, keeping the earliest-created profile's name intact.

WITH ranked AS (
  SELECT id,
         display_name,
         ROW_NUMBER() OVER (
           PARTITION BY display_name
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.profiles
  WHERE display_name IS NOT NULL AND display_name != ''
)
UPDATE public.profiles p
SET display_name = p.display_name || '-' || (r.rn)
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- Now add the UNIQUE constraint (NULLs are allowed — multiple users can have no name)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_unique UNIQUE (display_name);

-- Add a helper function to check username availability (returns true if available)
CREATE OR REPLACE FUNCTION public.check_display_name_available(name_to_check text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE display_name = name_to_check
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_display_name_available(text) TO authenticated;
