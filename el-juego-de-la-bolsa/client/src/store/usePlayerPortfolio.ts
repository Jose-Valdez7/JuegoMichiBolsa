import { create, type StateCreator } from 'zustand'
import { FixedIncomeHolding, HoldingPosition, PlayerState } from '../types/game'

export interface PlayerPortfolioStore {
  state: PlayerState
  syncFromServer: (payload: PlayerState) => void
  updateStage: (stage: number) => void
  applyPriceMap: (prices: Record<number, number>) => void
  reset: () => void
}

const defaultState: PlayerState = {
  cash: 10000,
  holdings: [],
  fixedIncomeHoldings: [],
  portfolioValue: 0,
  stage: 1,
  fixedIncomeValue: 0,
  totalValue: 10000
}

const recalc = (state: PlayerState): PlayerState => {
  const portfolioValue = state.holdings.reduce<number>((accumulator, position) => {
    return accumulator + position.quantity * position.currentPrice
  }, 0)

  const fixedIncomeHoldings: FixedIncomeHolding[] = state.fixedIncomeHoldings?.map((bond) => ({
    ...bond,
    currentValue: bond.currentValue ?? bond.unitPrice * bond.quantity
  })) ?? []

  const fixedIncomeValue = fixedIncomeHoldings.reduce<number>((accumulator, bond) => {
    return accumulator + bond.currentValue
  }, 0)

  return {
    ...state,
    holdings: state.holdings.map((holding) => ({
      ...holding,
      totalValue: holding.totalValue ?? holding.quantity * holding.currentPrice
    })),
    fixedIncomeHoldings,
    portfolioValue,
    fixedIncomeValue,
    totalValue: portfolioValue + fixedIncomeValue + state.cash
  }
}

const createPlayerPortfolioStore: StateCreator<PlayerPortfolioStore> = (set) => ({
  state: defaultState,

  syncFromServer: (payload: PlayerState) => {
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
