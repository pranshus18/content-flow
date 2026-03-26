import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface BrandingSettings {
  id: string;
  company_logo_url: string | null;
  company_website_url: string | null;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  watermark_enabled: boolean;
  watermark_position: string;
  end_card_enabled: boolean;
  end_card_duration: number;
  created_at: string;
  updated_at: string;
}

const BRANDING_SETTINGS_STORAGE_KEY = 'contentflow_branding_settings';

// Helper functions for localStorage persistence
const saveSettingsToStorage = (settings: BrandingSettings | null) => {
  try {
    if (settings) {
      localStorage.setItem(BRANDING_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } else {
      localStorage.removeItem(BRANDING_SETTINGS_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to save branding settings to localStorage:', error);
  }
};

const loadSettingsFromStorage = (): BrandingSettings | null => {
  try {
    const stored = localStorage.getItem(BRANDING_SETTINGS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load branding settings from localStorage:', error);
  }
  return null;
};

export function useBrandingSettings() {
  // Load from localStorage first for instant display
  const [settings, setSettings] = useState<BrandingSettings | null>(() => loadSettingsFromStorage());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .maybeSingle();

      if (error) {
        // If error is RLS related, just set to null (user might not be admin)
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          console.warn('Access denied to branding settings (user may not be admin)');
          // Keep localStorage settings even if database access is denied
          const storedSettings = loadSettingsFromStorage();
          setSettings(storedSettings);
          setLoading(false);
          return;
        }
        throw error;
      }
      
      // Update state and localStorage with database settings
      setSettings(data);
      saveSettingsToStorage(data);
    } catch (error: any) {
      console.error('Error fetching branding settings:', error);
      // On error, try to use localStorage as fallback
      const storedSettings = loadSettingsFromStorage();
      setSettings(storedSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Refetch settings when user becomes available (in case of auth delay)
  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user, fetchSettings]);

  const updateSettings = async (data: Partial<BrandingSettings>, showToast: boolean = true) => {
    if (!settings) {
      // Create if doesn't exist
      try {
        const { data: newSettings, error: createError } = await supabase
          .from('branding_settings')
          .insert({
            ...data,
            watermark_enabled: data.watermark_enabled ?? true,
            watermark_position: data.watermark_position ?? 'bottom-right',
            end_card_enabled: data.end_card_enabled ?? true,
            end_card_duration: data.end_card_duration ?? 5,
          })
          .select()
          .single();

        if (createError) throw createError;
        
        // Update state and localStorage
        setSettings(newSettings);
        saveSettingsToStorage(newSettings);
        
        if (showToast) {
          toast({
            title: 'Settings Updated',
            description: 'Branding settings have been saved and will persist across page refreshes.',
          });
        }
        return newSettings;
      } catch (error: any) {
        console.error('Error creating branding settings:', error);
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
        return null;
      }
    }

    try {
      const { data: updated, error } = await supabase
        .from('branding_settings')
        .update(data)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;

      // Update state and localStorage
      setSettings(updated);
      saveSettingsToStorage(updated);
      
      if (showToast) {
        toast({
          title: 'Settings Updated',
          description: 'Branding settings have been saved and will persist across page refreshes.',
        });
      }
      return updated;
    } catch (error: any) {
      console.error('Error updating branding settings:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  // Function to get branding settings (for use in video processing)
  const getBrandingSettings = async (): Promise<BrandingSettings | null> => {
    try {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching branding settings:', error);
      return null;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    getBrandingSettings,
  };
}
