import { memo, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FixedIncomeOffer } from '../types/game'

interface Company {
  id: number
  name: string
  symbol: string
  currentPrice: number
  basePrice: number
  sector: string
  availableShares?: number
}

const TradingInterface = memo(TradingInterfaceComponent)

export default TradingInterface

interface TradingInterfaceProps {
  companies: Company[]
  onTransaction: (type: 'BUY' | 'SELL', companyId: number, quantity: number) => void
  isRoundActive: boolean
  roundTimer: number
  playerHoldings?: Array<{
    stockId: number
    quantity: number
  }>
  fixedIncomeOffers?: FixedIncomeOffer[]
  fixedIncomeOrders?: Record<string, number>
  onFixedIncomeQuantityChange?: (offerId: string, quantity: number) => void
  onFixedIncomePurchase?: (offerId: string) => void
  canTradeFixedIncome?: boolean
}

interface TradeOrder {
  companyId: number
  buyQuantity: number
  sellQuantity: number
}

function TradingInterfaceComponent({ 
  companies, 
  onTransaction, 
  isRoundActive, 
  roundTimer,
  playerHoldings = [],
  fixedIncomeOffers = [],
  fixedIncomeOrders = {},
  onFixedIncomeQuantityChange,
  onFixedIncomePurchase,
  canTradeFixedIncome = false
}: TradingInterfaceProps) {
  const initialOrders = useMemo(
    () => companies.map(c => ({ companyId: c.id, buyQuantity: 0, sellQuantity: 0 })),
    [companies]
  )

  const [orders, setOrders] = useState<TradeOrder[]>(initialOrders)

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  const updateOrder = (companyId: number, type: 'buy' | 'sell', quantity: number) => {
    setOrders(prev => prev.map(order => 
      order.companyId === companyId 
        ? { 
            ...order, 
            [type === 'buy' ? 'buyQuantity' : 'sellQuantity']: Math.max(0, quantity)
          }
        : order
    ))
  }

  const getOrder = (companyId: number) => {
    return orders.find(o => o.companyId === companyId) || { buyQuantity: 0, sellQuantity: 0 }
  }

  const getPlayerHoldings = (companyId: number) => {
    const holding = playerHoldings.find(h => h.stockId === companyId)
    return holding ? holding.quantity : 0
  }

  const formatNumber = (value: number) => value.toLocaleString('es-EC', { maximumFractionDigits: 0 })
  const formatCurrency = (value: number) => value.toLocaleString('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`

  const executeOrders = () => {
    try {
      console.log('Executing orders:', orders)
      
      orders.forEach(order => {
        if (order.buyQuantity > 0) {
          console.log('Executing BUY order:', order)
          onTransaction('BUY', order.companyId, order.buyQuantity)
        }
        if (order.sellQuantity > 0) {
          console.log('Executing SELL order:', order)
          onTransaction('SELL', order.companyId, order.sellQuantity)
        }
      })
      
      // Limpiar órdenes después de ejecutar
      setOrders(initialOrders)
    } catch (error) {
      console.error('Error executing orders:', error)
    }
  }

  const cancelOrders = () => {
    setOrders(initialOrders)
  }

  const getSectorIcon = (sector: string) => {
    switch (sector.toLowerCase()) {
      case 'tech': return '💻'
      case 'finance': return '🏦'
      case 'energy': return '⚡'
      case 'health': return '🏥'
      case 'retail': return '🛍️'
      default: return '🏢'
    }
  }

  const getSectorColor = (sector: string) => {
    switch (sector.toLowerCase()) {
      case 'tech': return 'bg-blue-600'
      case 'finance': return 'bg-green-600'
      case 'energy': return 'bg-yellow-600'
      case 'health': return 'bg-red-600'
      case 'retail': return 'bg-purple-600'
      default: return 'bg-gray-600'
    }
  }

  const shouldShowFixedIncome = canTradeFixedIncome && fixedIncomeOffers.length > 0

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Panel de Transacciones</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-slate-400">
            Tiempo restante: <span className="text-white font-bold">{Math.floor(roundTimer / 60)}:{(roundTimer % 60).toString().padStart(2, '0')}</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
            isRoundActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>
            {isRoundActive ? 'ACTIVO' : 'INACTIVO'}
          </div>
        </div>
      </div>

      {/* Trading Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 p-4 bg-slate-700 text-xs uppercase tracking-wide font-semibold text-slate-300">
          <div>Renta Variable</div>
          <div className="text-center"># Acciones</div>
          <div className="text-center">Precio</div>
          <div className="text-center"># Acc Poseidas</div>
          <div className="text-center">Comprar</div>
          <div className="text-center">Vender</div>
        </div>

        {/* Company Rows */}
        <div className="divide-y divide-slate-700">
          {companies.map((company, index) => {
            const order = getOrder(company.id)
            const priceChange = ((company.currentPrice - company.basePrice) / company.basePrice) * 100
            const holdingQuantity = getPlayerHoldings(company.id)
            
            return (
              <motion.div
                key={company.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 p-4 hover:bg-slate-750 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Company Info */}
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded ${getSectorColor(company.sector)} flex items-center justify-center text-white text-sm`}>
                    {getSectorIcon(company.sector)}
                  </div>
                  <div>
                    <div className="font-bold text-white">{company.symbol}</div>
                    <div className="text-xs text-slate-400">{company.name}</div>
                  </div>
                </div>

                {/* Available Shares */}
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-white font-semibold">{formatNumber(company.availableShares || 0)}</div>
                    <div className="text-xs text-slate-400">disponibles</div>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-white font-bold text-lg">
                      {formatCurrency(company.currentPrice)}
                    </div>
                    <div className={`text-xs ${
                      priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Player Holdings */}
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-white font-semibold">{formatNumber(holdingQuantity)}</div>
                    <div className="text-xs text-slate-400">Posesión</div>
                  </div>
                </div>

                {/* Buy Input */}
                <div className="flex items-center justify-center">
                  <input
                    type="number"
                    min="0"
                    value={order.buyQuantity || ''}
                    onChange={(e) => updateOrder(company.id, 'buy', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-700 text-white text-center py-2 px-3 rounded border border-slate-600 focus:border-green-500 focus:outline-none"
                    placeholder="0"
                    disabled={!isRoundActive}
                  />
                </div>

                {/* Sell Input */}
                <div className="flex items-center justify-center">
                  <input
                    type="number"
                    min="0"
                    value={order.sellQuantity || ''}
                    onChange={(e) => updateOrder(company.id, 'sell', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-700 text-white text-center py-2 px-3 rounded border border-slate-600 focus:border-red-500 focus:outline-none"
                    placeholder="0"
                    disabled={!isRoundActive}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Fixed Income Section */}
      {shouldShowFixedIncome && (
        <div className="mt-6 bg-slate-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">RENTA FIJA</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {fixedIncomeOffers.map((offer) => {
              const currentQuantity = fixedIncomeOrders[offer.id] ?? 0
              return (
                <div key={offer.id} className="flex flex-col space-y-3 p-4 bg-slate-700 rounded border border-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">{offer.name}</div>
                      <div className="text-xs text-slate-300">{offer.issuer}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-300">Unidad: {formatCurrency(offer.unitPrice)}</div>
                      <div className="text-xs text-slate-400">Interés: {formatPercentage(offer.interestRate)}</div>
                      <div className="text-xs text-slate-400">Plazo: {offer.termMonths} mes(es)</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Títulos disponibles</span>
                    <span className="text-white font-semibold">{formatNumber(offer.remainingUnits)}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      min="0"
                      value={currentQuantity || ''}
                      onChange={(event) => onFixedIncomeQuantityChange?.(offer.id, parseInt(event.target.value) || 0)}
                      className="w-24 bg-slate-600 text-white text-center py-1 px-2 rounded border border-slate-500 focus:border-amber-400 focus:outline-none"
                      placeholder="0"
                      disabled={!isRoundActive || !canTradeFixedIncome}
                    />
                    <button
                      onClick={() => onFixedIncomePurchase?.(offer.id)}
                      disabled={!isRoundActive || !canTradeFixedIncome}
                      className={`flex-1 py-2 rounded font-semibold transition-colors ${
                        isRoundActive && canTradeFixedIncome
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                          : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Comprar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 mt-6">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            try {
              console.log('Button clicked, executing orders...')
              executeOrders()
            } catch (error) {
              console.error('Error in button click:', error)
              alert('Error al procesar la transacción')
            }
          }}
          disabled={!isRoundActive}
          className={`px-8 py-3 rounded-lg font-semibold transition-all ${
            isRoundActive
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-slate-600 text-slate-400 cursor-not-allowed'
          }`}
        >
          ENVIAR
        </button>
        <button
          onClick={cancelOrders}
          disabled={!isRoundActive}
          className={`px-8 py-3 rounded-lg font-semibold transition-all ${
            isRoundActive
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-slate-600 text-slate-400 cursor-not-allowed'
          }`}
        >
          CANCELAR
        </button>
      </div>

      {/* Order Summary */}
      {orders.some(o => o.buyQuantity > 0 || o.sellQuantity > 0) && (
        <motion.div
          className="mt-4 p-4 bg-blue-900/30 border border-blue-500 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h4 className="text-blue-300 font-semibold mb-2">Órdenes Pendientes:</h4>
          <div className="space-y-1 text-sm">
            {orders.filter(o => o.buyQuantity > 0 || o.sellQuantity > 0).map(order => {
              const company = companies.find(c => c.id === order.companyId)
              return (
                <div key={order.companyId} className="text-slate-300">
                  <span className="font-semibold">{company?.symbol}</span>:
                  {order.buyQuantity > 0 && (
                    <span className="text-green-400 ml-2">Comprar {order.buyQuantity}</span>
                  )}
                  {order.sellQuantity > 0 && (
                    <span className="text-red-400 ml-2">Vender {order.sellQuantity}</span>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
