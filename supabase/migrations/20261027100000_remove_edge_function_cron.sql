-- Stop Postgres from calling deleted Edge Functions.
-- Scheduled publishing now runs in the local Express backend (node-cron).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) AND EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'publish-scheduled-content'
  ) THEN
    PERFORM cron.unschedule('publish-scheduled-content');
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_function THEN
    NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_scheduled_publishing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE NOTICE 'Scheduled publishing is handled by the local backend on port 8081, not by Supabase Edge Functions.';
END;
$$;

COMMENT ON FUNCTION public.trigger_scheduled_publishing() IS
'Deprecated no-op. Scheduled publishing is handled by the Express backend cron, not Edge Functions.';
