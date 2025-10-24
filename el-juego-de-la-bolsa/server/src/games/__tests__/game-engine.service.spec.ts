import {
  GameEngineService,
  TradeValidationContext,
  FixedIncomeHoldingInternal,
  TradeAction,
  PriceEngineContext,
  PriceChangesMap,
} from '../game-engine.service';

describe('GameEngineService', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  describe('generateRoundNews', () => {
    it('should return positive and negative news items', () => {
      const news = service.generateRoundNews();

      expect(news).toHaveProperty('positive');
      expect(news).toHaveProperty('negative');
      expect(news.positive).toHaveProperty('type', 'POSITIVE');
      expect(news.negative).toHaveProperty('type', 'NEGATIVE');
    });
  });

  describe('determineSpecialEvent', () => {
    it('should return a known event or null', () => {
      const possible = new Set<string | null>();
      for (let i = 0; i < 1000; i++) {
        possible.add(service.determineSpecialEvent());
      }

      // Ensure at least null appears
      expect(possible.has(null)).toBe(true);

      // All non-null values must be within the allowed set
      const allowed = new Set(['boom', 'crash', 'split', 'contraplit']);
      possible.forEach((value) => {
        if (value !== null) {
          expect(allowed.has(value)).toBe(true);
        }
      });
    });
  });

  describe('processFixedIncomePayouts', () => {
    it('should pay out matured holdings and reduce remaining months otherwise', () => {
      const playerFixedIncome = new Map<string, FixedIncomeHoldingInternal[]>([
        [
          'socket-1',
          [
            {
              offerId: 'offer-1',
              issuer: 'Issuer',
              name: 'Bond',
              unitPrice: 100,
              interestRate: 0.1,
              remainingMonths: 1,
              quantity: 2,
            },
            {
              offerId: 'offer-2',
              issuer: 'Issuer',
              name: 'Bond Long',
              unitPrice: 50,
              interestRate: 0.08,
              remainingMonths: 2,
              quantity: 1,
            },
          ],
        ],
      ]);

      const playerPortfolios = new Map<string, ReturnType<typeof service.createInitialPortfolio>>([
        ['socket-1', { cash: 500, stocks: new Map() }],
      ]);

      const result = service.processFixedIncomePayouts(playerFixedIncome, playerPortfolios);

      // Check payouts emitted for matured bond
      expect(result.payouts).toHaveLength(1);
      expect(result.payouts[0]).toMatchObject({
        socketId: 'socket-1',
        offerId: 'offer-1',
        principal: 200,
        interest: 20,
      });

      // Check updated cash for the player
      const portfolio = playerPortfolios.get('socket-1');
      expect(portfolio?.cash).toBeCloseTo(720); // 500 + 200 principal + 20 interest

      // Remaining holding should have remainingMonths reduced by 1
      const updatedHoldings = result.updatedHoldings.get('socket-1');
      expect(updatedHoldings).toHaveLength(1);
      expect(updatedHoldings?.[0]).toMatchObject({
        offerId: 'offer-2',
        remainingMonths: 1,
        quantity: 1,
      });
    });
  });

  describe('buildFixedIncomeOffers', () => {
    it('should create offers with default remaining units', () => {
      const offers = service.buildFixedIncomeOffers();
      expect(offers.length).toBeGreaterThan(0);
      offers.forEach((offer) => {
        expect(offer.remainingUnits).toBe(200);
      });
    });
  });

  describe('createInitialPortfolio', () => {
    it('should create a portfolio with default cash and empty stocks', () => {
      const portfolio = service.createInitialPortfolio();
      expect(portfolio.cash).toBe(10000);
      expect(portfolio.stocks.size).toBe(0);
    });
  });

  describe('applySingleTrade', () => {
    const baseContext = (): TradeValidationContext => {
      const roomStores = {
        playerPortfolios: new Map<string, ReturnType<typeof service.createInitialPortfolio>>(),
        companyStocks: new Map<number, number>(),
        playerFixedIncome: new Map<string, FixedIncomeHoldingInternal[]>(),
      };

      const portfolio = service.createInitialPortfolio(1000);
      roomStores.playerPortfolios.set('socket-1', portfolio);
      roomStores.companyStocks.set(1, 100);

      return {
        roomId: 'room-1',
        stage: 1,
        roomStores,
        priceLookup: () => 100,
        companyNameLookup: () => 'MichiTech',
        companySymbolLookup: () => 'MTC',
      };
    };

    it('should buy stocks when enough cash and availability exists', () => {
      const context = baseContext();
      const action: TradeAction = { type: 'BUY', companyId: 1, quantity: 5 };

      const outcome = service.applySingleTrade('socket-1', action, context);

      expect(outcome.result).toMatchObject({ success: true, type: 'BUY', companyId: 1, quantity: 5 });
      const portfolio = context.roomStores.playerPortfolios.get('socket-1');
      expect(portfolio?.cash).toBe(1000 - 5 * 100);
      expect(portfolio?.stocks.get(1)).toBe(5);
      expect(context.roomStores.companyStocks.get(1)).toBe(95);
    });

    it('should reject buy when insufficient cash', () => {
      const context = baseContext();
      context.roomStores.playerPortfolios.get('socket-1')!.cash = 100;
      const action: TradeAction = { type: 'BUY', companyId: 1, quantity: 5 };

      const outcome = service.applySingleTrade('socket-1', action, context);

      expect(outcome.result).toMatchObject({ success: false, error: 'Fondos insuficientes' });
    });

    it('should sell stocks when holdings exist', () => {
      const context = baseContext();
      const portfolio = context.roomStores.playerPortfolios.get('socket-1');
      portfolio!.stocks.set(1, 10);

      const action: TradeAction = { type: 'SELL', companyId: 1, quantity: 4 };
      const outcome = service.applySingleTrade('socket-1', action, context);

      expect(outcome.result).toMatchObject({ success: true, type: 'SELL', companyId: 1, quantity: 4 });
      expect(portfolio!.cash).toBe(1000 + 4 * 100);
      expect(portfolio!.stocks.get(1)).toBe(6);
      expect(context.roomStores.companyStocks.get(1)).toBe(104);
    });

    it('should reject sell when not enough stocks', () => {
      const context = baseContext();
      const action: TradeAction = { type: 'SELL', companyId: 1, quantity: 1 };

      const outcome = service.applySingleTrade('socket-1', action, context);

      expect(outcome.result).toMatchObject({ success: false, error: 'No tienes suficientes acciones para vender' });
    });
  });

  describe('generatePriceChanges', () => {
    const companyIds = [1, 2, 3];

    const createContext = (options?: { specialEvent?: string | null }) => {
      const prices = new Map<number, number>([
        [1, 100],
        [2, 80],
        [3, 120],
      ]);

      const emittedUpdates: Record<number, number> = {};

      const context: PriceEngineContext = {
        priceLookup: (companyId) => prices.get(companyId) ?? 0,
        updatePrice: (companyId, newPrice) => {
          emittedUpdates[companyId] = newPrice;
          prices.set(companyId, newPrice);
        },
        getSpecialEvent: options?.specialEvent !== undefined ? () => options.specialEvent! : undefined,
      };

      return { context, emittedUpdates, prices };
    };

    it('should apply special event changes when provided', () => {
      const { context, emittedUpdates } = createContext({ specialEvent: 'split' });

      const result = service.generatePriceChanges(context, companyIds);

      companyIds.forEach((companyId) => {
        expect(result[companyId].eventType).toBe('split');
        expect(result[companyId].newPrice).toBeCloseTo(result[companyId].oldPrice * 0.5);
        expect(emittedUpdates[companyId]).toBeCloseTo(result[companyId].newPrice);
      });
    });

    it('should update prices with normal changes when no event occurs', () => {
      const { context, emittedUpdates, prices } = createContext({ specialEvent: null });

      const result: PriceChangesMap = service.generatePriceChanges(context, companyIds);

      companyIds.forEach((companyId) => {
        expect(result[companyId].eventType).toBe('normal');
        const changeRatio = (result[companyId].newPrice - result[companyId].oldPrice) / result[companyId].oldPrice;
        expect(changeRatio).toBeGreaterThanOrEqual(-0.1);
        expect(changeRatio).toBeLessThanOrEqual(0.1);
        expect(emittedUpdates[companyId]).toBe(result[companyId].newPrice);
      });
    });
  });
});
