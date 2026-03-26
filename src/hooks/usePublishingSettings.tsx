import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface PublishingSettings {
  id: string;
  user_id: string;
  auto_publish_enabled: boolean;
  publish_time: string;
  created_at: string;
  updated_at: string;
}

export function usePublishingSettings() {
  const [settings, setSettings] = useState<PublishingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('publishing_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        // Create default settings
        const { data: newSettings, error: createError } = await supabase
          .from('publishing_settings')
          .insert({ user_id: user.id })
          .select()
          .single();
        
        if (createError) throw createError;
        setSettings(newSettings);
      } else {
        setSettings(data);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setSettings(null);
      setLoading(false);
    }
  }, [user]);

  const updateSettings = async (data: Partial<PublishingSettings>) => {
    if (!settings) return;

    try {
      const { data: updated, error } = await supabase
        .from('publishing_settings')
        .update(data)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;

      setSettings(updated);
      toast({
        title: 'Settings Updated',
        description: 'Your publishing settings have been saved.',
      });
      return updated;
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
  };
}
