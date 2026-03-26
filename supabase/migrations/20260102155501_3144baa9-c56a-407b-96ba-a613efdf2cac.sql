-- Create content table
CREATE TABLE public.content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  status TEXT NOT NULL DEFAULT 'draft',
  media_url TEXT,
  enhanced_media_url TEXT,
  scheduled_date TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own content" 
ON public.content FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own content" 
ON public.content FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content" 
ON public.content FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content" 
ON public.content FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_content_updated_at
BEFORE UPDATE ON public.content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create publishing_settings table
CREATE TABLE public.publishing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  auto_publish_enabled BOOLEAN NOT NULL DEFAULT false,
  publish_time TIME DEFAULT '09:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.publishing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" 
ON public.publishing_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.publishing_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.publishing_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_publishing_settings_updated_at
BEFORE UPDATE ON public.publishing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public) VALUES ('content-media', 'content-media', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload media" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'content-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view media" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'content-media');

CREATE POLICY "Users can update their own media" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'content-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own media" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'content-media' AND auth.uid()::text = (storage.foldername(name))[1]);