import { useEffect, useState } from 'react'
import { useGame } from '../store/useGame'
import { useSocket } from '../hooks/useSocket'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../utils/api'
import StockChart from '../components/StockChart'
import TransactionHistory from '../components/TransactionHistory'
import TradingInterface from '../components/TradingInterface'
import GameHeader from '../components/GameHeader'
import GameNotifications, { useNotifications } from '../components/GameNotifications'
import NewsReview from '../components/NewsReview'

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
  const [roundTimer, setRoundTimer] = useState(60)
  const [currentRound, setCurrentRound] = useState(1)
  const [gamePhase, setGamePhase] = useState<'playing' | 'news' | 'trading' | 'results'>('playing')
  const [isRoundActive, setIsRoundActive] = useState(true)
  const [showTradingInterface, setShowTradingInterface] = useState(false)
  const [showNewsReview, setShowNewsReview] = useState(false)
  const [currentNews, setCurrentNews] = useState<any[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  const socket = useSocket()
  const nav = useNavigate()
  const {
    notifications,
    removeNotification,
    showSystemNotification,
    showDirectorMessage,
    showRentaFijaAlert,
    showTransactionConfirmation,
    showTransactionError,
    showSpecialEventNotification
  } = useNotifications()

  useEffect(() => {
    console.log('GameBoard mounted, loading initial data...')
    fetchNews()
    loadCompanies()
    loadPortfolio()
    startGame()
  }, [])

  useEffect(() => {
    if (!socket) {
      console.log('Socket not available yet')
      return
    }

    console.log('Setting up socket listeners...')

    // Debug: Escuchar todos los eventos del socket
    socket.onAny((eventName, ...args) => {
      console.log(`Socket event received: ${eventName}`, args)
    })

    // Manejar inicio del juego desde la sala de espera
    socket.on('gameStarted', () => {
      console.log('Game started! Redirecting to game...')
      console.log('Setting game phase to playing and round active to true')
      // El juego ya comenzó, mantener en GameBoard
      setGamePhase('playing')
      setIsRoundActive(true)
    })

    socket.on('playersUpdate', (players: any[]) => {
      console.log('Players update received:', players)
    })

    socket.on('gameStartCountdown', (seconds: number) => {
      console.log('Game start countdown:', seconds)
    })

    socket.on('roomStatus', (data: any) => {
      console.log('Room status:', data)
      if (!data.inRoom) {
        console.log('Not in any room, redirecting to lobby')
        navigate('/')
      }
    })

    // El cliente ya debería estar en una sala desde el lobby
    console.log('GameBoard mounted, socket connected')

    // Verificar si estamos en una sala, si no, intentar unirse
    socket.emit('checkRoomStatus')
    
    // Solicitar el estado actual de la ronda al entrar
    console.log('Requesting round state...')
    socket.emit('requestRoundState')

    socket.on('roundState', (data: { status: string; round: number; timer: number; news: any; phase: 'news' | 'trading' | 'playing' }) => {
      console.log('Received round state:', data)
      setCurrentRound(data.round || 1)
      setRoundTimer(data.timer || 0)
      setCurrentNews(data.news || [])

      if (data.status === 'playing' || data.status === 'starting') {
        if (data.phase === 'news') {
          setGamePhase('news')
          setShowTradingInterface(false)
          setIsRoundActive(true)
        } else if (data.phase === 'trading') {
          setGamePhase('trading')
          setShowTradingInterface(true)
          setIsRoundActive(true)
        } else {
          setGamePhase('playing')
          setShowTradingInterface(false)
        }
      }
    })

    socket.on('priceUpdate', (data: { companyId: number; price: number }) => {
      setCompanies(prev => prev.map(c => 
        c.id === data.companyId ? { ...c, currentPrice: data.price } : c
      ))
    })

    socket.on('roundTimer', (seconds: number) => {
      console.log('Received round timer:', seconds)
      setRoundTimer(seconds)
    })

    socket.on('roundStarted', (data: { round: number; news: any; timer: number }) => {
      console.log('Round started:', data)
      setCurrentRound(data.round)
      setRoundTimer(data.timer)
      setGamePhase('news')
      setIsRoundActive(true)
      setCurrentNews(data.news || [])
      
      // Mostrar alerta de renta fija en la primera jugada
      if (data.round === 1) {
        showRentaFijaAlert(['ZAIMELLA', 'PRONACA'])
      }
      
      // Actualizar noticias del juego
      fetchNews()
      
      // Mostrar noticias por 10 segundos, luego cambiar a trading
      setTimeout(() => {
        setGamePhase('trading')
        setShowTradingInterface(true)
        showSystemNotification('Fase de Trading iniciada. ¡Realiza tus transacciones!')
      }, 10000)
    })

    socket.on('roundEnded', (data: { round: number; priceChanges: any }) => {
      console.log('Round ended:', data)
      setGamePhase('results')
      setIsRoundActive(false)
      setShowTradingInterface(false)
      
      // Detectar eventos especiales
      const specialEvents = Object.values(data.priceChanges).filter((change: any) => 
        change.eventType && change.eventType !== 'normal'
      )
      
      if (specialEvents.length > 0) {
        const event = specialEvents[0] as any
        showSpecialEventNotification(event.eventType, event.message)
      } else {
        showSystemNotification('Ronda finalizada. Calculando fluctuaciones de precios...')
      }
      
      // Actualizar precios basado en las fluctuaciones
      Object.keys(data.priceChanges).forEach(symbol => {
        const change = data.priceChanges[symbol]
        setCompanies(prev => prev.map(c => 
          c.symbol === symbol ? { ...c, currentPrice: change.newPrice } : c
        ))
      })
      
      // Recalcular portfolio después de cambios de precios
      setTimeout(() => {
        loadPortfolio()
        showSystemNotification('Portfolio actualizado con nuevos precios')
      }, 2000)
      
      // Mostrar resultados por 5 segundos
      setTimeout(() => {
        setGamePhase('playing')
      }, 5000)
    })

    socket.on('gameFinished', (results: any) => {
      console.log('Game finished:', results)
      showSystemNotification('¡Juego terminado! Calculando resultados finales...')
      setTimeout(() => {
        nav('/results')
      }, 2000)
    })

    socket.on('transactionProcessed', (data: any) => {
      if (data.success) {
        showTransactionConfirmation(data.type, data.companyName, data.quantity)
        showDirectorMessage(`Transacción procesada exitosamente: ${data.type} ${data.quantity} acciones de ${data.companyName}`)
      } else {
        showTransactionError(data.error || 'No se pudo procesar la transacción')
        showDirectorMessage(`Transacción no procesada: ${data.error}`, false)
      }
    })

    return () => {
      console.log('Cleaning up socket listeners...')
      socket.off('priceUpdate')
      socket.off('roundTimer')
      socket.off('roundStarted')
      socket.off('roundEnded')
      socket.off('gameFinished')
      socket.off('roundState')
      socket.off('gameStarted')
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

  const executeTransaction = async (type: 'BUY' | 'SELL', companyId: number, transactionQuantity: number) => {
    try {
      console.log('Attempting transaction:', { type, companyId, quantity: transactionQuantity })
      
      // Emitir transacción via Socket.IO para sincronización en tiempo real
      if (socket) {
        console.log('Socket available, emitting transaction')
        socket.emit('gameTransaction', {
          userId: 1, // TODO: obtener del auth
          companyId,
          type,
          quantity: transactionQuantity
        })
      } else {
        console.error('Socket not available for transaction')
        alert('Error: No hay conexión con el servidor')
      }
    } catch (error) {
      console.error('Transaction error:', error)
      alert('Error al procesar la transacción')
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

  const handleLogout = () => {
    nav('/login')
  }

  const handleToggleSound = () => {
    setSoundEnabled(!soundEnabled)
    showSystemNotification(soundEnabled ? 'Sonido desactivado' : 'Sonido activado')
  }

  const handleShowHelp = () => {
    showSystemNotification('Panel de ayuda - Consulta las reglas del juego')
  }

  // Debug: Mostrar estado del temporizador
  useEffect(() => {
    console.log('Timer state updated:', { roundTimer, currentRound, gamePhase })
  }, [roundTimer, currentRound, gamePhase])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Nuevo Header del Juego */}
      <GameHeader
        currentRound={currentRound}
        totalRounds={5}
        roundTimer={roundTimer}
        gamePhase={gamePhase}
        onLogout={handleLogout}
        onToggleSound={handleToggleSound}
        onShowHelp={handleShowHelp}
      />

      {/* Sistema de Notificaciones */}
      <GameNotifications
        notifications={notifications}
        onRemoveNotification={removeNotification}
      />

      {/* Modal de Revisión de Noticias */}
      <NewsReview
        currentNews={currentNews}
        isVisible={showNewsReview}
        onClose={() => setShowNewsReview(false)}
      />

      <div className="p-4">

      <div className="grid grid-cols-12 gap-4">
        {/* Left Panel - Fixed Income */}
        <div className="col-span-3">
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">VALORES DE RENTA FIJA QUE SALEN A LA VENTA</h3>
            <div className="space-y-3">
              <div className="bg-slate-700 p-3 rounded flex items-center space-x-3">
                <div className="w-12 h-8 bg-red-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">ZAIMELLA</span>
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">ZAIMELLA OBLIGACIONES</div>
                  <div className="text-xs text-slate-400">Valor unitario: $ 50.00</div>
                  <div className="text-xs text-slate-400">Interés: 7.50 %</div>
                  <div className="text-xs text-slate-400">Plazo/Vigencia: 1/7</div>
                </div>
              </div>
              <div className="bg-slate-700 p-3 rounded flex items-center space-x-3">
                <div className="w-12 h-8 bg-orange-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">PRONACA</span>
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">PRONACA OBLIGACIONES</div>
                  <div className="text-xs text-slate-400">Valor unitario: $ 51.50</div>
                  <div className="text-xs text-slate-400">Interés: 8.00 %</div>
                  <div className="text-xs text-slate-400">Plazo/Vigencia: 1/8</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Stock Chart */}
        <div className="col-span-6">
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">TÍTULOS RENTA VARIABLE</h3>
              <div className="text-sm text-slate-400">
                Jugada {currentRound} - {gamePhase === 'news' ? 'Nuevas noticias del mercado de valores' : 
                gamePhase === 'trading' ? 'Tiempo de negociación' : 
                gamePhase === 'results' ? 'Cambios de precios en acciones' : 'Esperando...'}
              </div>
            </div>
            <StockChart 
              companies={companies} 
              onCompanySelect={setSelectedCompany}
            />
          </div>
        </div>

        {/* Right Panel - News or Price Changes */}
        <div className="col-span-3">
          {gamePhase === 'news' && (
            <div className="space-y-4">
              <div className="bg-green-900/30 border border-green-500 p-4 rounded-lg">
                <h4 className="text-green-400 font-semibold mb-2">NOTICIA POSITIVA</h4>
                <div className="mb-2">
                  <img src="/api/placeholder/200/120" alt="Positive news" className="w-full h-24 object-cover rounded" />
                </div>
                <p className="text-white text-sm">
                  BACHILLERES SE PREPARAN PARA LOS EXÁMENES DE INGRESO A LAS UNIVERSIDADES. LAS VACACIONES INCENTIVAN AL DEPORTE.
                </p>
              </div>
              <div className="bg-red-900/30 border border-red-500 p-4 rounded-lg">
                <h4 className="text-red-400 font-semibold mb-2">NOTICIA NEGATIVA</h4>
                <div className="mb-2">
                  <img src="/api/placeholder/200/120" alt="Negative news" className="w-full h-24 object-cover rounded" />
                </div>
                <p className="text-white text-sm">
                  LA CONSTRUCCIÓN DEL METRO DE QUITO AFECTA AL CENTRO DE LA CIUDAD. SE RETRASA EL INICIO DEL AÑO ESCOLAR EN COSTA POR EL FENÓMENO DEL NIÑO.
                </p>
              </div>
            </div>
          )}

          {gamePhase === 'results' && (
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h4 className="text-white font-semibold mb-4">VARIACIÓN DE PRECIOS X JUGADAS</h4>
              <div className="space-y-2">
                {companies.slice(0, 4).map((company) => (
                  <div key={company.id} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                        <span className="text-white text-xs">↗</span>
                      </div>
                      <span className="text-white text-sm">{company.symbol}</span>
                    </div>
                    <div className="text-green-400 font-semibold">$ {company.currentPrice.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trading Interface - Only show during trading phase */}
      {showTradingInterface && gamePhase === 'trading' && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TradingInterface
            companies={companies.map(c => ({ ...c, availableShares: 999 }))}
            onTransaction={executeTransaction}
            isRoundActive={isRoundActive}
            roundTimer={roundTimer}
          />
        </motion.div>
      )}

      {/* Transaction History - Always at bottom */}
      <div className="mt-6 bg-slate-800/50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Historial de Transacciones</h3>
          <button className="text-blue-400 hover:text-blue-300 text-sm">
            📰 Ver Noticias
          </button>
        </div>
        <TransactionHistory />
      </div>

      {/* Portfolio Summary - Fixed at bottom right */}
      {portfolio && (
        <div className="fixed bottom-4 right-4 bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-700">
          <h4 className="text-sm font-semibold text-white mb-2">Mi Portfolio</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Efectivo:</span>
              <span className="text-green-400 font-semibold">
                ${portfolio.cashBalance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Acciones:</span>
              <span className="text-white font-semibold">
                ${portfolio.totalValue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-600 pt-1">
              <span className="text-white font-semibold">Total:</span>
              <span className="text-blue-400 font-bold">
                ${(portfolio.cashBalance + portfolio.totalValue).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Botón para Revisar Noticias */}
      {(gamePhase === 'trading' || gamePhase === 'results') && currentNews.length > 0 && (
        <motion.button
          onClick={() => setShowNewsReview(true)}
          className="fixed bottom-4 left-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Revisar Noticias de la Ronda"
        >
          📰
        </motion.button>
      )}

      {/* Game Phase Notifications */}
      {gamePhase === 'news' && (
        <motion.div
          className="fixed top-20 right-4 bg-blue-900 border border-blue-500 p-4 rounded-lg shadow-lg"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="text-blue-300 font-semibold">
            Jugada {currentRound}. Alerta de las nuevas emisiones de renta fija.
          </div>
          <div className="text-sm text-slate-300 mt-1">
            Analiza las noticias antes de negociar
          </div>
        </motion.div>
      )}

      {gamePhase === 'trading' && (
        <motion.div
          className="fixed top-20 right-4 bg-green-900 border border-green-500 p-4 rounded-lg shadow-lg"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="text-green-300 font-semibold">
            ¡Tiempo de negociación!
          </div>
          <div className="text-sm text-slate-300 mt-1">
            Realiza tus transacciones ahora
          </div>
        </motion.div>
      )}

      {gamePhase === 'results' && (
        <motion.div
          className="fixed top-20 right-4 bg-yellow-900 border border-yellow-500 p-4 rounded-lg shadow-lg"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="text-yellow-300 font-semibold">
            Fluctuación de precios
          </div>
          <div className="text-sm text-slate-300 mt-1">
            Revisa los cambios en el mercado
          </div>
        </motion.div>
      )}
      </div>
    </div>
  )
}
