export interface HoldingPosition {
  stockId: number
  symbol?: string
  name?: string
  quantity: number
  buyPrice?: number
  currentPrice: number
  totalValue: number
}

export interface FixedIncomeHolding {
  offerId: string
  issuer: string
  name: string
  unitPrice: number
  interestRate: number
  remainingMonths: number
  quantity: number
  currentValue: number
}

export interface FixedIncomeOffer {
  id: string
  issuer: string
  name: string
  unitPrice: number
  interestRate: number
  termMonths: number
  remainingUnits: number
}

export interface PlayerState {
  cash: number
  holdings: HoldingPosition[]
  fixedIncomeHoldings?: FixedIncomeHolding[]
  portfolioValue: number
  stage: number
  fixedIncomeValue?: number
  totalValue: number
}
