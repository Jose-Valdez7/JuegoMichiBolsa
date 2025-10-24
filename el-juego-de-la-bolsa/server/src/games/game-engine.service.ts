import { Injectable } from '@nestjs/common';
import { FixedIncomeOfferPayload } from '../types/game-events';

export type TradeType = 'BUY' | 'SELL';

export interface TradeAction {
  type: TradeType;
  companyId: number;
  quantity: number;
}

export interface TradeResultSuccess {
  success: true;
  type: TradeType;
  companyId: number;
  quantity: number;
  companyName: string;
  companySymbol: string;
  priceAtMoment: number;
}

export interface TradeResultError {
  success: false;
  type: TradeType;
  companyId: number;
  quantity: number;
  error: string;
  companyName?: string;
  companySymbol?: string;
  priceAtMoment?: number;
}

export type TradeResult = TradeResultSuccess | TradeResultError;

export interface PlayerPortfolioInternal {
  cash: number;
  stocks: Map<number, number>;
}

export interface FixedIncomeHoldingInternal {
  offerId: string;
  issuer: string;
  name: string;
  unitPrice: number;
  interestRate: number;
  remainingMonths: number;
  quantity: number;
}

export interface PlayerPortfolioSnapshotHolding {
  stockId: number;
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number;
  totalValue: number;
}

export interface PlayerPortfolioSnapshotFixedIncome {
  offerId: string;
  issuer: string;
  name: string;
  unitPrice: number;
  interestRate: number;
  remainingMonths: number;
  quantity: number;
  currentValue: number;
}

export interface PlayerPortfolioSnapshot {
  cash: number;
  holdings: PlayerPortfolioSnapshotHolding[];
  fixedIncomeHoldings: PlayerPortfolioSnapshotFixedIncome[];
  portfolioValue: number;
  fixedIncomeValue: number;
  totalValue: number;
  stage: number;
}

export interface RoomStores {
  playerPortfolios: Map<string, PlayerPortfolioInternal>;
  companyStocks: Map<number, number>;
  playerFixedIncome: Map<string, FixedIncomeHoldingInternal[]>;
}

export interface TradeValidationContext {
  roomId: string;
  stage: number;
  roomStores: RoomStores;
  priceLookup: (companyId: number) => number;
  companyNameLookup: (companyId: number) => string;
  companySymbolLookup: (companyId: number) => string;
}

export interface BulkTradeOutcome {
  results: TradeResult[];
  stocksChanges: Record<number, number>;
  portfolioSnapshot?: PlayerPortfolioSnapshot;
}

export interface PriceChangeEntry {
  oldPrice: number;
  newPrice: number;
  change: number;
  eventType: string;
  message?: string;
}

export type PriceChangesMap = Record<number, PriceChangeEntry>;

export interface PriceEngineContext {
  priceLookup: (companyId: number) => number;
  updatePrice: (companyId: number, newPrice: number) => void;
  getSpecialEvent?: () => string | null;
}

export interface FixedIncomeHoldingSnapshot extends FixedIncomeHoldingInternal {
  currentValue: number;
}

export interface FixedIncomeProcessingResult {
  payouts: Array<{
    socketId: string;
    offerId: string;
    issuer: string;
    name: string;
    principal: number;
    interest: number;
  }>;
  updatedHoldings: Map<string, FixedIncomeHoldingInternal[]>;
}

export interface RoundNewsItem {
  type: 'POSITIVE' | 'NEGATIVE';
  title: string;
  effect: string;
}

export interface RoundNews {
  positive: RoundNewsItem;
  negative: RoundNewsItem;
}

export interface FinalResultEntry {
  playerId: number;
  playerName: string;
  cash: number;
  portfolioValue: number;
  finalValue: number;
  rank: number;
}

export type FixedIncomeOffer = FixedIncomeOfferPayload;

@Injectable()
export class GameEngineService {
  private readonly fixedIncomeTemplates: Array<Omit<FixedIncomeOffer, 'remainingUnits'>> = [
    {
      id: 'ZAIMELLA',
      issuer: 'ZAIMELLA',
      name: 'ZAIMELLA OBLIGACIONES',
      unitPrice: 50,
      interestRate: 0.075,
      termMonths: 3,
    },
    {
      id: 'PRONACA',
      issuer: 'PRONACA',
      name: 'PRONACA OBLIGACIONES',
      unitPrice: 55,
      interestRate: 0.068,
      termMonths: 4,
    },
    {
      id: 'BANQ',
      issuer: 'BANQ',
      name: 'BANQ BONOS CORPORATIVOS',
      unitPrice: 45,
      interestRate: 0.06,
      termMonths: 2,
    },
    {
      id: 'ALIMENTAR',
      issuer: 'ALIMENTAR',
      name: 'ALIMENTAR CERT. DE DEPÓSITO',
      unitPrice: 40,
      interestRate: 0.052,
      termMonths: 1,
    },
    {
      id: 'INFRA',
      issuer: 'INFRA',
      name: 'INFRA BONOS PROYECTO',
      unitPrice: 60,
      interestRate: 0.082,
      termMonths: 5,
    },
  ];

  applySingleTrade(
    socketId: string,
    action: TradeAction,
    context: TradeValidationContext
  ): { result: TradeResult; stocksUpdate?: Record<number, number>; portfolioSnapshot?: PlayerPortfolioSnapshot } {
    const { companyId, quantity, type } = action;
    const q = Number(quantity) || 0;

    if (!companyId || (type !== 'BUY' && type !== 'SELL') || q <= 0) {
      return {
        result: {
          success: false,
          type: type ?? 'BUY',
          companyId: companyId ?? 0,
          quantity: q,
          error: 'Solicitud inválida',
        },
      };
    }

    const { roomStores, priceLookup, companyNameLookup, companySymbolLookup, roomId } = context;
    const portfolioStore = roomStores.playerPortfolios.get(socketId);
    if (!portfolioStore) {
      return {
        result: {
          success: false,
          type,
          companyId,
          quantity: q,
          error: 'Portafolio no inicializado',
        },
      };
    }

    if (!roomStores.companyStocks.has(companyId)) {
      roomStores.companyStocks.set(companyId, 999);
    }

    const price = priceLookup(companyId);
    const companyName = companyNameLookup(companyId);
    const companySymbol = companySymbolLookup(companyId);

    if (type === 'BUY') {
      const available = roomStores.companyStocks.get(companyId) ?? 0;
      const totalCost = price * q;

      if (available < q) {
        return {
          result: {
            success: false,
            type,
            companyId,
            quantity: q,
            error: 'No hay suficientes acciones disponibles',
            companyName,
            companySymbol,
            priceAtMoment: price,
          },
        };
      }

      if (portfolioStore.cash < totalCost) {
        return {
          result: {
            success: false,
            type,
            companyId,
            quantity: q,
            error: 'Fondos insuficientes',
            companyName,
            companySymbol,
            priceAtMoment: price,
          },
        };
      }

      portfolioStore.cash -= totalCost;
      const currentQty = portfolioStore.stocks.get(companyId) ?? 0;
      portfolioStore.stocks.set(companyId, currentQty + q);
      roomStores.companyStocks.set(companyId, available - q);

      return {
        result: {
          success: true,
          type,
          companyId,
          quantity: q,
          companyName,
          companySymbol,
          priceAtMoment: price,
        },
        stocksUpdate: { [companyId]: roomStores.companyStocks.get(companyId) ?? 0 },
        portfolioSnapshot: this.buildPortfolioSnapshot(socketId, roomId, context),
      };
    }

    // SELL
    const holdingQty = portfolioStore.stocks.get(companyId) ?? 0;
    if (holdingQty < q) {
      return {
        result: {
          success: false,
          type,
          companyId,
          quantity: q,
          error: 'No tienes suficientes acciones para vender',
          companyName,
          companySymbol,
          priceAtMoment: price,
        },
      };
    }

    const proceeds = price * q;
    portfolioStore.cash += proceeds;
    const newQty = holdingQty - q;
    if (newQty > 0) {
      portfolioStore.stocks.set(companyId, newQty);
    } else {
      portfolioStore.stocks.delete(companyId);
    }

    const available = roomStores.companyStocks.get(companyId) ?? 0;
    roomStores.companyStocks.set(companyId, available + q);

    return {
      result: {
        success: true,
        type,
        companyId,
        quantity: q,
        companyName,
        companySymbol,
        priceAtMoment: price,
      },
      stocksUpdate: { [companyId]: roomStores.companyStocks.get(companyId) ?? 0 },
      portfolioSnapshot: this.buildPortfolioSnapshot(socketId, roomId, context),
    };
  }

  applyBulkTrade(
    socketId: string,
    actions: TradeAction[],
    context: TradeValidationContext
  ): BulkTradeOutcome {
    const stocksChanges: Record<number, number> = {};
    const results: TradeResult[] = [];

    for (const action of actions) {
      const outcome = this.applySingleTrade(socketId, action, context);
      results.push(outcome.result);

      if (outcome.stocksUpdate) {
        for (const [companyIdStr, value] of Object.entries(outcome.stocksUpdate)) {
          const companyId = Number(companyIdStr);
          stocksChanges[companyId] = value;
        }
      }
    }

    return {
      results,
      stocksChanges,
      portfolioSnapshot: this.buildPortfolioSnapshot(socketId, context.roomId, context),
    };
  }

  buildPortfolioSnapshot(
    socketId: string,
    roomId: string,
    context: TradeValidationContext
  ): PlayerPortfolioSnapshot | undefined {
    const { roomStores, priceLookup, companyNameLookup, companySymbolLookup } = context;
    const portfolioStore = roomStores.playerPortfolios.get(socketId);
    if (!portfolioStore) {
      return undefined;
    }

    const holdings: PlayerPortfolioSnapshotHolding[] = Array.from(portfolioStore.stocks.entries()).map(
      ([companyId, quantity]) => {
        const currentPrice = priceLookup(companyId);
        return {
          stockId: companyId,
          symbol: companySymbolLookup(companyId),
          name: companyNameLookup(companyId),
          quantity,
          currentPrice,
          totalValue: currentPrice * quantity,
        };
      }
    );

    const fixedIncomeHoldings: PlayerPortfolioSnapshotFixedIncome[] = (
      roomStores.playerFixedIncome.get(socketId) ?? []
    ).map((holding) => ({
      ...holding,
      currentValue: holding.unitPrice * holding.quantity,
    }));

    const portfolioValue = holdings.reduce((total, holding) => total + holding.totalValue, 0);
    const fixedIncomeValue = fixedIncomeHoldings.reduce((total, holding) => total + holding.currentValue, 0);

    return {
      cash: portfolioStore.cash,
      holdings,
      fixedIncomeHoldings,
      portfolioValue,
      fixedIncomeValue,
      totalValue: portfolioStore.cash + portfolioValue + fixedIncomeValue,
      stage: context.stage,
    };
  }

  generatePriceChanges(context: PriceEngineContext, companyIds: number[]): PriceChangesMap {
    const changes: PriceChangesMap = {};
    const specialEvent = context.getSpecialEvent ? context.getSpecialEvent() : this.determineSpecialEvent();

    if (specialEvent) {
      companyIds.forEach((companyId) => {
        const oldPrice = context.priceLookup(companyId);
        let newPrice = oldPrice;
        let message: string | undefined;
        let change = 0;

        switch (specialEvent) {
          case 'boom':
            newPrice = oldPrice * (1 + (Math.random() * 0.1 + 0.15));
            change = (newPrice - oldPrice) / oldPrice;
            message = '🚀 BOOM! Todos los precios suben!';
            break;
          case 'crash':
            newPrice = oldPrice * (1 - (Math.random() * 0.1 + 0.15));
            change = (newPrice - oldPrice) / oldPrice;
            message = '💥 CRASH! Todos los precios bajan!';
            break;
          case 'split':
            newPrice = oldPrice * 0.5;
            change = -0.5;
            message = '📈 SPLIT! Precio reducido a la mitad';
            break;
          case 'contraplit':
            newPrice = oldPrice * 2;
            change = 1.0;
            message = '📉 CONTRA-SPLIT! Precio duplicado';
            break;
        }

        context.updatePrice(companyId, newPrice);
        changes[companyId] = { oldPrice, newPrice, change, eventType: specialEvent, message };
      });

      return changes;
    }

    companyIds.forEach((companyId) => {
      const change = (Math.random() - 0.5) * 0.2; // -10% a +10%
      const oldPrice = context.priceLookup(companyId);
      const newPrice = oldPrice * (1 + change);
      context.updatePrice(companyId, newPrice);
      changes[companyId] = { oldPrice, newPrice, change, eventType: 'normal' };
    });

    return changes;
  }

  processFixedIncomePayouts(
    playerFixedIncome: Map<string, FixedIncomeHoldingInternal[]>,
    playerPortfolios: Map<string, PlayerPortfolioInternal>
  ): FixedIncomeProcessingResult {
    const payouts: FixedIncomeProcessingResult['payouts'] = [];
    const updatedHoldings: Map<string, FixedIncomeHoldingInternal[]> = new Map();

    for (const [socketId, holdings] of playerFixedIncome.entries()) {
      const portfolio = playerPortfolios.get(socketId);
      if (!portfolio) {
        updatedHoldings.set(socketId, holdings);
        continue;
      }

      const remaining: FixedIncomeHoldingInternal[] = [];

      for (const holding of holdings) {
        const nextHolding = { ...holding, remainingMonths: holding.remainingMonths - 1 };

        if (nextHolding.remainingMonths <= 0) {
          const principal = holding.unitPrice * holding.quantity;
          const interest = principal * holding.interestRate;
          portfolio.cash += principal + interest;
          payouts.push({
            socketId,
            offerId: holding.offerId,
            issuer: holding.issuer,
            name: holding.name,
            principal,
            interest,
          });
        } else {
          remaining.push(nextHolding);
        }
      }

      updatedHoldings.set(socketId, remaining);
    }

    return { payouts, updatedHoldings };
  }

  determineSpecialEvent(): string | null {
    const random = Math.random();
    if (random < 0.01) return 'boom';
    if (random < 0.02) return 'crash';
    if (random < 0.03) return 'split';
    if (random < 0.04) return 'contraplit';
    return null;
  }

  generateRoundNews(): RoundNews {
    const positiveNews: RoundNewsItem[] = [
      { type: 'POSITIVE', title: 'Sector tecnológico muestra crecimiento sostenido', effect: 'Incremento en acciones tech' },
      { type: 'POSITIVE', title: 'Nuevas inversiones en energía renovable', effect: 'Alza en sector energético' },
      { type: 'POSITIVE', title: 'Bachilleres se preparan para exámenes universitarios', effect: 'Sector educativo en alza' },
    ];

    const negativeNews: RoundNewsItem[] = [
      { type: 'NEGATIVE', title: 'Incertidumbre en mercados financieros', effect: 'Caída en sector bancario' },
      { type: 'NEGATIVE', title: 'Construcción del metro afecta el centro de la ciudad', effect: 'Baja en sector construcción' },
      { type: 'NEGATIVE', title: 'Cierre de carreteras por fenómeno del niño', effect: 'Impacto en transporte' },
    ];

    return {
      positive: positiveNews[Math.floor(Math.random() * positiveNews.length)],
      negative: negativeNews[Math.floor(Math.random() * negativeNews.length)],
    };
  }

  calculateFinalResults(
    players: Array<{ id: number; name: string; socketId: string }>,
    context: TradeValidationContext
  ): FinalResultEntry[] {
    const roundToTwo = (value: number) => Math.round(value * 100) / 100;

    const results = players.map((player) => {
      const snapshot = this.buildPortfolioSnapshot(player.socketId, context.roomId, context);

      const cash = roundToTwo(snapshot?.cash ?? 0);
      const portfolioValue = roundToTwo(snapshot?.portfolioValue ?? 0);
      const totalValue = roundToTwo(snapshot?.totalValue ?? cash + portfolioValue);

      return {
        playerId: player.id,
        playerName: player.name,
        cash,
        portfolioValue,
        finalValue: totalValue,
        rank: 0,
      };
    });

    return results
      .sort((a, b) => b.finalValue - a.finalValue)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  buildFixedIncomeOffers(defaultRemainingUnits = 200): FixedIncomeOffer[] {
    return this.fixedIncomeTemplates.map((template) => ({
      ...template,
      remainingUnits: defaultRemainingUnits,
    }));
  }

  createInitialStocks(companyIds: number[], defaultQuantity: number): Map<number, number> {
    const stocks = new Map<number, number>();
    companyIds.forEach((companyId) => {
      stocks.set(companyId, defaultQuantity);
    });
    return stocks;
  }

  createInitialPortfolio(initialCash = 10000): PlayerPortfolioInternal {
    return {
      cash: initialCash,
      stocks: new Map<number, number>(),
    };
  }
}
