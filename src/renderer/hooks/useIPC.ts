/**
 * Type-safe IPC Hook
 * Provides convenient wrapper around electronAPI.invoke
 */

import { useState, useCallback } from 'react';
import { IPCChannel } from '../../shared/types/ipc.types';

interface IPCState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useIPC<T = unknown>() {
  const [state, setState] = useState<IPCState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const invoke = useCallback(async (channel: IPCChannel, data?: unknown): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });

    try {
      const result = await window.electronAPI.invoke<T>(channel, data);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState({ data: null, loading: false, error: err });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    invoke,
    reset,
  };
}
