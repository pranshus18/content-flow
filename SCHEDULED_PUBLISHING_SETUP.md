# Scheduled Publishing Setup Guide

## Current Status

✅ **Code is ready**: The `publish-content` edge function can automatically publish scheduled posts.

⚠️ **Requires configuration**: You need to set up a cron job in Supabase to trigger the function.

## How It Works

1. **Scheduling**: When you schedule a post, it's saved with `status = 'scheduled'` and a `scheduled_date` timestamp
2. **Auto-publish setting**: Users can enable/disable auto-publishing in Settings → Automated Publishing
3. **Cron job**: A scheduled task runs periodically (e.g., every minute) to check for posts ready to publish
4. **Processing**: The edge function finds all scheduled posts where `scheduled_date <= now()` and publishes them to social media

## Setup Instructions

### Step 1: Configure Cron Job in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **Cron Jobs**
3. Click **Create a new cron job**
4. Configure:
   - **Name**: `auto-publish-scheduled-content`
   - **Schedule**: `* * * * *` (every minute) or `*/5 * * * *` (every 5 minutes)
   - **Function**: `publish-content`
   - **Method**: `POST`
   - **Body**: Leave empty (the function handles cron-triggered requests)

### Step 2: Enable Auto-Publish in Settings

1. Go to **Settings** page in your app
2. Enable **"Enable Auto-Publish"** toggle
3. Set your preferred **Default Publish Time** (optional - currently not used, posts publish at their exact scheduled time)

### Step 3: Schedule Your Posts

1. Create or edit content
2. Set a **scheduled_date** (date and time)
3. The post will automatically publish at that time (if auto-publish is enabled)

## Important Notes

- **Auto-publish must be enabled**: Posts will only auto-publish if the user has `auto_publish_enabled = true` in their publishing settings
- **Exact time publishing**: Posts publish at their exact `scheduled_date` time (not at the default publish time)
- **Platform support**: Works with Instagram, Facebook, and LinkedIn (if configured)
- **Manual publishing**: You can still manually publish posts anytime, regardless of auto-publish settings

## Testing

To test without waiting:

1. Schedule a post for a time 1-2 minutes in the future
2. Wait for the cron job to run
3. Check the Edge Functions logs in Supabase Dashboard to see if it published

Or manually trigger the function:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/publish-content \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Troubleshooting

- **Posts not publishing**: Check that auto-publish is enabled in Settings
- **Cron not running**: Verify the cron job is configured in Supabase Dashboard
- **Function errors**: Check Edge Functions logs in Supabase Dashboard
- **Platform errors**: Check that social media tokens are configured correctly
