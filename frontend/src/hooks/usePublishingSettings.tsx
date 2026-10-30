import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { invokeBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/utils';

export interface PublishingSettings {
  id: string;
  user_id: string;
  auto_publish_enabled: boolean;
  publish_time: string;
  created_at: string;
  updated_at: string;
}

type PublishingContextValue = {
  settings: PublishingSettings | null;
  loading: boolean;
  updateSettings: (data: Partial<PublishingSettings>) => Promise<PublishingSettings | null | undefined>;
};

const PublishingSettingsContext = createContext<PublishingContextValue | null>(null);

function usePublishingSettingsController(): PublishingContextValue {
  const [settings, setSettings] = useState<PublishingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    invokeBackend<PublishingSettings>('publishing-settings', undefined, { method: 'GET' })
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((error: unknown) => {
        console.error('Error fetching settings:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const updateSettings = async (data: Partial<PublishingSettings>) => {
    try {
      const updated = await invokeBackend<PublishingSettings>('publishing-settings', data, { method: 'PUT' });
      setSettings(updated);
      toast({
        title: 'Settings Updated',
        description: 'Your publishing settings have been saved.',
      });
      return updated;
    } catch (error: unknown) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: errorMessage(error, 'Failed to save publishing settings'),
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

export function PublishingSettingsProvider({ children }: { children: ReactNode }) {
  const value = usePublishingSettingsController();
  return <PublishingSettingsContext.Provider value={value}>{children}</PublishingSettingsContext.Provider>;
}

export function usePublishingSettings() {
  const context = useContext(PublishingSettingsContext);
  if (!context) {
    throw new Error('usePublishingSettings must be used within PublishingSettingsProvider');
  }
  return context;
}
