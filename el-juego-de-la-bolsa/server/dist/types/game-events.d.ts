export type GameStatus = 'waiting' | 'ready' | 'starting' | 'playing' | 'finished';
export type RoundPhase = 'news' | 'trading' | 'playing';
export interface RoundNewsItemPayload {
    type: 'POSITIVE' | 'NEGATIVE';
    title: string;
    effect: string;
}
export interface RoundNewsPayload {
    positive: RoundNewsItemPayload;
    negative: RoundNewsItemPayload;
}
export interface FixedIncomeOfferPayload {
    id: string;
    issuer: string;
    name: string;
    unitPrice: number;
    interestRate: number;
    termMonths: number;
    remainingUnits: number;
}
export interface FixedIncomePayoutPayload {
    offerId: string;
    issuer: string;
    name: string;
    principal: number;
    interest: number;
}
export interface PriceChangePayload {
    oldPrice: number;
    newPrice: number;
    change: number;
    eventType: string;
    message?: string;
}
export type PriceChangesPayloadMap = Record<number | string, PriceChangePayload>;
export interface PortfolioHoldingPayload {
    stockId: number;
    symbol: string;
    name: string;
    quantity: number;
    currentPrice: number;
    totalValue: number;
}
export interface FixedIncomeHoldingPayload {
    offerId: string;
    issuer: string;
    name: string;
    unitPrice: number;
    interestRate: number;
    remainingMonths: number;
    quantity: number;
    currentValue: number;
}
export interface PortfolioUpdatePayload {
    cash: number;
    holdings: PortfolioHoldingPayload[];
    fixedIncomeHoldings: FixedIncomeHoldingPayload[];
    portfolioValue: number;
    fixedIncomeValue: number;
    totalValue: number;
    stage: number;
}
export interface RoundStatePayload {
    status: GameStatus;
    round: number;
    timer: number;
    news: RoundNewsPayload | null;
    phase: RoundPhase;
    fixedIncomeOffers: FixedIncomeOfferPayload[];
    totalElapsedSeconds?: number;
}
export interface RoundStartedPayload {
    round: number;
    news: RoundNewsPayload | null;
    timer: number;
    fixedIncomeOffers: FixedIncomeOfferPayload[];
    totalElapsedSeconds?: number;
}
export interface RoundEndedPayload {
    round: number;
    priceChanges: PriceChangesPayloadMap;
}
export interface StocksUpdatePayload {
    [companyId: number]: number;
}
