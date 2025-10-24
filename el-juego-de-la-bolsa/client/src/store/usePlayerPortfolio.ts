import { create, type StateCreator } from 'zustand'
import type { FixedIncomeHoldingPayload, PortfolioHoldingPayload, PortfolioUpdatePayload } from 'server/types/game-events'

type NormalizedHolding = PortfolioHoldingPayload & { totalValue: number }
type NormalizedFixedIncomeHolding = FixedIncomeHoldingPayload & { currentValue: number }

export interface PlayerPortfolioStore {
  state: PortfolioUpdatePayload & {
    holdings: NormalizedHolding[]
    fixedIncomeHoldings: NormalizedFixedIncomeHolding[]
    fixedIncomeValue: number
    totalValue: number
  }
  syncFromServer: (payload: PortfolioUpdatePayload) => void
  updateStage: (stage: number) => void
  applyPriceMap: (prices: Record<number, number>) => void
  reset: () => void
}

const defaultState: PlayerPortfolioStore['state'] = {
  cash: 10000,
  holdings: [],
  fixedIncomeHoldings: [],
  portfolioValue: 0,
  stage: 1,
  fixedIncomeValue: 0,
  totalValue: 10000
}

const normalizeHoldings = (holdings: PortfolioHoldingPayload[] = []): NormalizedHolding[] =>
  holdings.map((holding) => {
    const currentPrice = holding.currentPrice ?? 0
    const totalValue = holding.totalValue ?? holding.quantity * currentPrice
    return {
      ...holding,
      currentPrice,
      totalValue
    }
  })

const normalizeFixedIncome = (bonds: FixedIncomeHoldingPayload[] = []): NormalizedFixedIncomeHolding[] =>
  bonds.map((bond) => {
    const currentValue = bond.currentValue ?? bond.unitPrice * bond.quantity
    return {
      ...bond,
      currentValue
    }
  })

const recalc = (state: PortfolioUpdatePayload): PlayerPortfolioStore['state'] => {
  const normalizedHoldings = normalizeHoldings(state.holdings)
  const portfolioValue = normalizedHoldings.reduce<number>((accumulator, position) => {
    return accumulator + position.quantity * position.currentPrice
  }, 0)

  const fixedIncomeHoldings = normalizeFixedIncome(state.fixedIncomeHoldings)

  const fixedIncomeValue = fixedIncomeHoldings.reduce<number>((accumulator, bond) => {
    return accumulator + bond.currentValue
  }, 0)

  return {
    ...state,
    holdings: normalizedHoldings,
    fixedIncomeHoldings,
    portfolioValue,
    fixedIncomeValue,
    totalValue: portfolioValue + fixedIncomeValue + state.cash
  }
}

const createPlayerPortfolioStore: StateCreator<PlayerPortfolioStore> = (set) => ({
  state: defaultState,

  syncFromServer: (payload: PortfolioUpdatePayload) => {
    set(() => ({
      state: recalc({
        cash: payload.cash,
        holdings: payload.holdings,
        fixedIncomeHoldings: payload.fixedIncomeHoldings ?? [],
        portfolioValue: payload.portfolioValue,
        stage: payload.stage,
        fixedIncomeValue: payload.fixedIncomeValue ?? 0,
        totalValue: payload.totalValue
      })
    }))
  },

  updateStage: (stage: number) => {
    set((current: PlayerPortfolioStore) => ({
      state: recalc({
        ...current.state,
        stage
      })
    }))
  },

  applyPriceMap: (prices: Record<number, number>) => {
    set((current: PlayerPortfolioStore) => {
      const updatedHoldings: HoldingPosition[] = current.state.holdings.map((holding: HoldingPosition) => {
        const currentPrice = prices[holding.stockId] ?? holding.currentPrice
        return {
          ...holding,
          currentPrice,
          totalValue: currentPrice * holding.quantity
        }
      })

      return {
        state: recalc({
          ...current.state,
          holdings: updatedHoldings
        })
      }
    })
  },

  reset: () => set(() => ({ state: defaultState }))
})

export const usePlayerPortfolio = create<PlayerPortfolioStore>(createPlayerPortfolioStore)
