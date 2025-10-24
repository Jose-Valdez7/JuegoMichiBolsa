import { useEffect } from 'react';
import { usePlayerPortfolio } from '../store/usePlayerPortfolio';
import { PlayerState } from '../types/game';
import { useGameSocket } from './useGameSocket';
import type { PortfolioUpdatePayload } from 'server/types/game-events';

interface UsePortfolioSyncOptions {
  socketDebug?: boolean;
}

export function usePortfolioSync(options: UsePortfolioSyncOptions = {}) {
  const { syncFromServer } = usePlayerPortfolio.getState();

  type PortfolioUpdateListener = {
    event: 'portfolioUpdate';
    handler: (payload: PortfolioUpdatePayload) => void;
  };

  const listeners: PortfolioUpdateListener[] = [
    {
      event: 'portfolioUpdate',
      handler: (payload: PlayerState) => {
        syncFromServer(payload);
      },
    },
  ];

  const socket = useGameSocket({
    listeners,
    onEvent: options.socketDebug
      ? (eventName) => {
          console.debug('[usePortfolioSync] event:', eventName);
        }
      : undefined,
  });

  useEffect(() => {
    return () => {
      usePlayerPortfolio.getState().reset();
    };
  }, []);

  return socket;
}
