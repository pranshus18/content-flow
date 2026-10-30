import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { invokeBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';

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
  intro_card_enabled?: boolean;
  intro_card_duration?: number;
  intro_frame_url?: string | null;
  outro_frame_url?: string | null;
  company_tagline?: string | null;
  intro_headline?: string | null;
  intro_features?: string | null;
  executor_name?: string | null;
  cta_text?: string | null;
  vendor_logo_url?: string | null;
  follow_cta_enabled?: boolean;
  follow_cta_text?: string | null;
  follow_cta_start_seconds?: number | null;
  follow_cta_duration?: number | null;
  created_at: string;
  updated_at: string;
}

const BRANDING_SETTINGS_STORAGE_KEY = 'contentflow_branding_settings';

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

type BrandingContextValue = {
  settings: BrandingSettings | null;
  loading: boolean;
  updateSettings: (data: Partial<BrandingSettings>, showToast?: boolean) => Promise<BrandingSettings | null>;
  getBrandingSettings: () => Promise<BrandingSettings | null>;
};

const BrandingSettingsContext = createContext<BrandingContextValue | null>(null);

function useBrandingSettingsController(): BrandingContextValue {
  const [settings, setSettings] = useState<BrandingSettings | null>(() => loadSettingsFromStorage());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const data = await invokeBackend<BrandingSettings | null>('branding', undefined, { method: 'GET' });
      setSettings(data);
      saveSettingsToStorage(data);
    } catch (error: unknown) {
      console.error('Error fetching branding settings:', error);
      setSettings(loadSettingsFromStorage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setSettings(loadSettingsFromStorage());
      setLoading(false);
    }
  }, [user?.id, fetchSettings]);

  const updateSettings = async (data: Partial<BrandingSettings>, showToast: boolean = true) => {
    try {
      const updated = await invokeBackend<BrandingSettings>('branding', data, { method: 'PUT' });
      setSettings(updated);
      saveSettingsToStorage(updated);
      if (showToast) {
        toast({
          title: 'Settings Updated',
          description: 'Branding settings have been saved and will persist across page refreshes.',
        });
      }
      return updated;
    } catch (error: unknown) {
      console.error('Error updating branding settings:', error);
      toast({
        title: 'Error',
        description: errorMessage(error, 'Failed to save branding settings'),
        variant: 'destructive',
      });
      return null;
    }
  };

  const getBrandingSettings = async (): Promise<BrandingSettings | null> => {
    try {
      return await invokeBackend<BrandingSettings | null>('branding', undefined, { method: 'GET' });
    } catch (error: unknown) {
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

export function BrandingSettingsProvider({ children }: { children: ReactNode }) {
  const value = useBrandingSettingsController();
  return <BrandingSettingsContext.Provider value={value}>{children}</BrandingSettingsContext.Provider>;
}

export function useBrandingSettings() {
  const context = useContext(BrandingSettingsContext);
  if (!context) {
    throw new Error('useBrandingSettings must be used within BrandingSettingsProvider');
  }
  return context;
}
