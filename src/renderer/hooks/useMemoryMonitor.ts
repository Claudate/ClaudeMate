/**
 * Memory Monitor Hook
 * Listens to memory events from main process and handles cleanup
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';

interface MemoryWarning {
  level: 'warning' | 'critical' | 'emergency';
  usage: number;
  threshold: number;
}

export function useMemoryMonitor() {
  const addEvent = useAppStore((state) => state.addEvent);

  const handleMemoryWarning = useCallback(
    (warning: MemoryWarning) => {
      console.warn('Memory warning:', warning);

      addEvent({
        type: 'MEMORY_WARNING',
        payload: { usage: warning.usage, limit: warning.threshold },
      });

      // Show user notification for critical/emergency
      if (warning.level === 'critical' || warning.level === 'emergency') {
        // You can integrate a toast notification here
        console.error(`${warning.level.toUpperCase()}: Memory usage at ${warning.usage.toFixed(1)} MB`);
      }
    },
    [addEvent]
  );

  const handleForceCleanup = useCallback(() => {
    console.warn('Force cleanup requested by main process');

    // Clear any large caches in renderer
    // For example: clear message history, close unused tabs, etc.

    // Force React to cleanup unused components
    // This is automatic with React 18+ concurrent features

    // Clear localStorage cache if applicable
    try {
      const keysToKeep = ['user-preferences', 'auth-token'];
      Object.keys(localStorage).forEach((key) => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }, []);

  useEffect(() => {
    // Check if electronAPI is available
    if (!window.electronAPI?.on) {
      console.warn('[useMemoryMonitor] electronAPI not available, skipping memory monitoring');
      return;
    }

    // Subscribe to memory events
    const unsubscribeWarning = window.electronAPI.on('memory:warning', handleMemoryWarning);
    const unsubscribeCritical = window.electronAPI.on('memory:critical', handleMemoryWarning);
    const unsubscribeEmergency = window.electronAPI.on('memory:emergency', handleMemoryWarning);
    const unsubscribeCleanup = window.electronAPI.on('memory:force-cleanup', handleForceCleanup);

    return () => {
      unsubscribeWarning?.();
      unsubscribeCritical?.();
      unsubscribeEmergency?.();
      unsubscribeCleanup?.();
    };
  }, [handleMemoryWarning, handleForceCleanup]);
}
