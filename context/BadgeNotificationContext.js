import React, { createContext, useContext, useState, useCallback } from 'react';
import { BadgeToast } from '../components/common/BadgeSystem';

const BadgeNotificationContext = createContext(null);

/**
 * Wrap your app with <BadgeNotificationProvider>.
 * Then call `awardBadges(newly_awarded_array)` from anywhere in the app
 * to show animated badge unlock toasts one-by-one.
 */
export function BadgeNotificationProvider({ children }) {
  const [queue, setQueue] = useState([]);   // badges waiting to be shown
  const [current, setCurrent] = useState(null);  // badge currently displayed

  // Call this with the `newly_awarded` array from any API response
  const awardBadges = useCallback((badges) => {
    if (!badges || badges.length === 0) return;
    setQueue(prev => [...prev, ...badges]);
    setCurrent(prev => prev ?? badges[0]);
  }, []);

  const handleClose = useCallback(() => {
    setQueue(prev => {
      const next = prev.slice(1);
      setCurrent(next.length > 0 ? next[0] : null);
      return next;
    });
  }, []);

  return (
    <BadgeNotificationContext.Provider value={{ awardBadges }}>
      {children}
      {current && (
        <BadgeToast badge={current} onClose={handleClose} />
      )}
    </BadgeNotificationContext.Provider>
  );
}

export function useBadgeNotification() {
  const ctx = useContext(BadgeNotificationContext);
  if (!ctx) throw new Error('useBadgeNotification must be inside BadgeNotificationProvider');
  return ctx;
}