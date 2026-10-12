import { useEffect } from 'react';
import { AppState } from 'react-native';

import { processUploadQueue } from '@/lib/activityUpload';
import { useSessionStore } from '@/stores/sessionStore';

/** Oturum açıkken uygulama açılınca ve öne gelince bekleyen aktivite yüklemelerini dener. */
export function useUploadQueue(): void {
  const userId = useSessionStore((s) => s.session?.user.id);

  useEffect(() => {
    if (!userId) return;
    void processUploadQueue(userId);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void processUploadQueue(userId);
    });
    return () => sub.remove();
  }, [userId]);
}
