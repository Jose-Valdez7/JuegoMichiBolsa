import { useEffect, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from './useSocket';

interface UseGameSocketProps {
  socket?: Socket | null;
  onEvent?: (event: string, ...args: any[]) => void;
  listeners: Array<{
    event: string;
    handler: (...args: any[]) => void;
  }>;
}

export function useGameSocket({ listeners, onEvent, socket: providedSocket }: UseGameSocketProps) {
  const internalSocket = useSocket();
  const socket = providedSocket ?? internalSocket;
  const stableListeners = useMemo(() => listeners, [listeners]);

  useEffect(() => {
    if (!socket) return;

    if (onEvent) {
      socket.onAny(onEvent);
    }

    stableListeners.forEach(({ event, handler }) => {
      socket.on(event, handler);
    });

    return () => {
      if (onEvent) {
        socket.offAny(onEvent);
      }
      stableListeners.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    };
  }, [socket, onEvent, stableListeners]);

  return socket as Socket | null;
}
