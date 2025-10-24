import type { FixedIncomeHoldingPayload, FixedIncomeOfferPayload, PortfolioHoldingPayload, PortfolioUpdatePayload } from 'server/types/game-events'

export type HoldingPosition = PortfolioHoldingPayload

export type FixedIncomeHolding = FixedIncomeHoldingPayload

export type FixedIncomeOffer = FixedIncomeOfferPayload

export type PlayerState = PortfolioUpdatePayload
