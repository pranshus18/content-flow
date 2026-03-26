-- Create a configuration table to store Supabase project settings
CREATE TABLE IF NOT EXISTS public.cron_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage cron config
CREATE POLICY "Admins can manage cron config"
ON public.cron_config
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Insert placeholder values (these need to be updated with actual values)
-- Users should update these values in the Supabase Dashboard
INSERT INTO public.cron_config (key, value, description)
VALUES 
  ('supabase_url', 'https://YOUR_PROJECT_REF.supabase.co', 'Your Supabase project URL (replace YOUR_PROJECT_REF with your actual project reference)'),
  ('service_role_key', 'YOUR_SERVICE_ROLE_KEY', 'Your Supabase service role key (found in Settings > API)')
ON CONFLICT (key) DO NOTHING;

-- Create a function to call the publish-content edge function
CREATE OR REPLACE FUNCTION public.trigger_scheduled_publishing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  function_url TEXT;
  http_response_id BIGINT;
BEGIN
  -- Get configuration from cron_config table
  SELECT value INTO supabase_url FROM public.cron_config WHERE key = 'supabase_url';
  SELECT value INTO service_role_key FROM public.cron_config WHERE key = 'service_role_key';
  
  -- Validate configuration
  IF supabase_url IS NULL OR supabase_url = '' OR supabase_url LIKE '%YOUR_PROJECT_REF%' THEN
    RAISE EXCEPTION 'Supabase URL not configured. Please update cron_config table with your project URL.';
  END IF;
  
  IF service_role_key IS NULL OR service_role_key = '' OR service_role_key = 'YOUR_SERVICE_ROLE_KEY' THEN
    RAISE EXCEPTION 'Service role key not configured. Please update cron_config table with your service role key.';
  END IF;
  
  -- Construct the edge function URL
  function_url := supabase_url || '/functions/v1/publish-content';
  
  -- Check if pg_net extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    -- Make HTTP POST request to the edge function using pg_net
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    ) INTO http_response_id;
    
    RAISE NOTICE 'Triggered scheduled publishing check at %. HTTP request ID: %', now(), http_response_id;
  ELSE
    RAISE EXCEPTION 'pg_net extension is not enabled. Please enable it in Supabase Dashboard > Database > Extensions';
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_scheduled_publishing() TO postgres, service_role;

COMMENT ON FUNCTION public.trigger_scheduled_publishing() IS 
'Function to trigger the publish-content edge function via HTTP.
This function is called by pg_cron every minute to check for scheduled posts.
Requires pg_net extension and cron_config table to be configured.';

-- Note: The following requires pg_cron extension to be enabled
-- Enable pg_cron extension (may require superuser - enable manually if this fails)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron extension requires superuser privileges. Please enable it manually in Supabase Dashboard > Database > Extensions';
  WHEN duplicate_object THEN
    RAISE NOTICE 'pg_cron extension already exists';
END
$$;

-- Enable pg_net extension (may require superuser - enable manually if this fails)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_net extension requires superuser privileges. Please enable it manually in Supabase Dashboard > Database > Extensions';
  WHEN duplicate_object THEN
    RAISE NOTICE 'pg_net extension already exists';
END
$$;

-- Create the cron job to run every minute
-- Note: This will only work if pg_cron is enabled
DO $$
DECLARE
  job_command TEXT;
BEGIN
  -- Remove existing job if it exists
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publish-scheduled-content') THEN
    PERFORM cron.unschedule('publish-scheduled-content');
  END IF;
  
  -- Build the command as a text string (using single quotes to avoid dollar-quote conflicts)
  job_command := 'SELECT public.trigger_scheduled_publishing();';
  
  -- Schedule new job to run every minute
  PERFORM cron.schedule(
    'publish-scheduled-content',
    '* * * * *', -- Every minute (cron format: minute hour day month weekday)
    job_command
  );
  
  RAISE NOTICE 'Cron job "publish-scheduled-content" scheduled successfully to run every minute';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension is not enabled. Please enable it in Supabase Dashboard > Database > Extensions, then run: SELECT cron.schedule(''publish-scheduled-content'', ''* * * * *'', ''SELECT public.trigger_scheduled_publishing();'');';
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to schedule cron job. Error: %. You may need to set it up manually.', SQLERRM;
END
$$;
