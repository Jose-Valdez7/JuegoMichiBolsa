import { useEffect, useState } from 'react'
import { useGame } from '../store/useGame'
import { useSocket } from '../hooks/useSocket'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../utils/api'
import StockChart from '../components/StockChart'
import TransactionHistory from '../components/TransactionHistory'

interface Company {
  id: number
  name: string
  symbol: string
  currentPrice: number
  basePrice: number
  sector: string
}

interface Portfolio {
  cashBalance: number
  totalValue: number
  positions: Array<{
    company: Company
    quantity: number
  }>
}

export default function GameBoard() {
  const { news, fetchNews, startGame } = useGame()
  const [companies, setCompanies] = useState<Company[]>([])
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [roundTimer, setRoundTimer] = useState(0)
  
  const socket = useSocket()
  const nav = useNavigate()

  useEffect(() => {
    fetchNews()
    loadCompanies()
    loadPortfolio()
    startGame()
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('priceUpdate', (data: { companyId: number; price: number }) => {
      setCompanies(prev => prev.map(c => 
        c.id === data.companyId ? { ...c, currentPrice: data.price } : c
      ))
    })

    socket.on('roundTimer', (seconds: number) => {
      setRoundTimer(seconds)
    })

    socket.on('roundStarted', (data: { round: number; news: any; timer: number }) => {
      console.log('Round started:', data)
      setRoundTimer(data.timer)
      // Actualizar noticias del juego
      fetchNews()
    })

    socket.on('roundEnded', (data: { round: number; priceChanges: any }) => {
      console.log('Round ended:', data)
      // Actualizar precios basado en las fluctuaciones
      Object.keys(data.priceChanges).forEach(symbol => {
        const change = data.priceChanges[symbol]
        setCompanies(prev => prev.map(c => 
          c.symbol === symbol ? { ...c, currentPrice: change.newPrice } : c
        ))
      })
    })

    socket.on('gameFinished', (results: any) => {
      console.log('Game finished:', results)
      // Redirigir a página de resultados
      nav('/results')
    })

    return () => {
      socket.off('priceUpdate')
      socket.off('roundTimer')
      socket.off('roundStarted')
      socket.off('roundEnded')
      socket.off('gameFinished')
    }
  }, [socket, fetchNews, nav])

  const loadCompanies = async () => {
    try {
      const response = await api.get('/api/companies')
      setCompanies(response.data)
    } catch (error) {
      console.error('Error loading companies:', error)
      // Fallback data para testing
      setCompanies([
        { id: 1, name: 'TechNova', symbol: 'TNV', currentPrice: 105.50, basePrice: 100, sector: 'Tech' },
        { id: 2, name: 'GreenEnergy Corp', symbol: 'GEC', currentPrice: 87.25, basePrice: 90, sector: 'Energy' },
        { id: 3, name: 'HealthPlus Inc', symbol: 'HPI', currentPrice: 142.80, basePrice: 130, sector: 'Health' },
        { id: 4, name: 'RetailMax', symbol: 'RTM', currentPrice: 78.90, basePrice: 85, sector: 'Retail' },
        { id: 5, name: 'FinanceFirst', symbol: 'FF', currentPrice: 95.60, basePrice: 95, sector: 'Finance' },
        { id: 6, name: 'AutoDrive Ltd', symbol: 'ADL', currentPrice: 112.30, basePrice: 110, sector: 'Tech' }
      ])
    }
  }

  const loadPortfolio = async () => {
    try {
      const response = await api.get('/api/portfolio')
      setPortfolio(response.data)
    } catch (error) {
      console.error('Error loading portfolio:', error)
      // Fallback data para testing
      setPortfolio({
        cashBalance: 10000,
        totalValue: 0,
        positions: []
      })
    }
  }

  const executeTransaction = async (type: 'BUY' | 'SELL') => {
    if (!selectedCompany) return
    
    try {
      const response = await fetch('/game/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1, // TODO: get from auth
          companyId: selectedCompany.id,
          type,
          quantity
        })
      })
      
      if (response.ok) {
        loadPortfolio()
        setSelectedCompany(null)
        setQuantity(1)
      }
    } catch (error) {
      console.error('Transaction error:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPositionQuantity = (companyId: number) => {
    return portfolio?.positions.find(p => p.company.id === companyId)?.quantity || 0
  }

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tablero de Juego</h1>
        <div className="flex items-center gap-4">
          <div className="text-lg font-mono">
            Tiempo: {formatTime(roundTimer)}
          </div>
          <Link className="text-accent underline" to="/transactions">
            Transacciones
          </Link>
        </div>
      </header>

      {/* Portfolio Summary */}
      {portfolio && (
        <section className="bg-slate-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Mi Portfolio</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm opacity-70">Efectivo</div>
              <div className="text-xl font-bold text-green-400">
                ${portfolio.cashBalance.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-70">Valor Total</div>
              <div className="text-xl font-bold">
                ${(portfolio.totalValue + portfolio.cashBalance).toFixed(2)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stock Chart */}
      <section>
        <StockChart 
          companies={companies} 
          onCompanySelect={setSelectedCompany}
        />
      </section>

      {/* Transaction Panel */}
      {selectedCompany && (
        <motion.section 
          className="bg-slate-800 p-4 rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-semibold mb-4">
            Transacción: {selectedCompany.symbol}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-2">Cantidad</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full p-2 rounded bg-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Precio por acción</label>
              <div className="p-2 bg-slate-700 rounded">
                ${selectedCompany.currentPrice.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-2">Total</label>
              <div className="p-2 bg-slate-700 rounded font-bold">
                ${(selectedCompany.currentPrice * quantity).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => executeTransaction('BUY')}
              className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded font-semibold"
              disabled={!portfolio || portfolio.cashBalance < selectedCompany.currentPrice * quantity}
            >
              Comprar
            </button>
            <button
              onClick={() => executeTransaction('SELL')}
              className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded font-semibold"
              disabled={getPositionQuantity(selectedCompany.id) < quantity}
            >
              Vender
            </button>
            <button
              onClick={() => setSelectedCompany(null)}
              className="px-4 bg-slate-600 hover:bg-slate-500 py-2 rounded"
            >
              Cancelar
            </button>
          </div>
        </motion.section>
      )}

      {/* News */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Noticias de la Ronda</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {news.map((n) => (
            <motion.div 
              key={n.id} 
              className="p-4 bg-slate-800 rounded"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className={`text-sm mb-1 ${
                n.type === 'POSITIVE' ? 'text-green-400' : 
                n.type === 'NEGATIVE' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {n.type}
              </div>
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm opacity-70 mt-1">{n.effect}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Transaction History */}
      <section>
        <TransactionHistory />
      </section>
    </div>
  )
}
