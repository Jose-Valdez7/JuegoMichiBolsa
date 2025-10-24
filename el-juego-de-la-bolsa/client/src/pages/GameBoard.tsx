import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGame } from '../store/useGame'
import { useGameSocket } from '../hooks/useGameSocket'
import { usePortfolioSync } from '../hooks/usePortfolioSync'
import { api } from '../utils/api'
import StockChart from '../components/StockChart'
import TransactionHistory from '../components/TransactionHistory'
import TradingInterface from '../components/TradingInterface'
import GameHeader from '../components/GameHeader'
import GameNotifications, { useNotifications } from '../components/GameNotifications'
import NewsReview from '../components/NewsReview'
import { usePlayerPortfolio } from '../store/usePlayerPortfolio'
import type { FixedIncomeOfferPayload, PriceChangePayload, PriceChangesPayloadMap, RoundEndedPayload, RoundNewsItemPayload, RoundStartedPayload, RoundStatePayload } from 'server/types/game-events'
import { FixedIncomeOffer, PlayerState } from '../types/game'

type SocketListener = {
  event: string
  handler: (...args: any[]) => void
}

const env: any = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {}
const isDevMode = env.MODE !== 'production'
const debugEnabled = env.VITE_DEBUG === 'true'

const debugLog = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args)
}

interface Company {
  id: number
  name: string
  symbol: string
  currentPrice: number
  basePrice: number
  sector: string
  availableStocks?: number
  availableShares?: number
}

export default function GameBoard() {
  const { news, fetchNews, startGame } = useGame()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [quantity, setQuantity] = useState(1)
  const TOTAL_ROUNDS = 5
  const [roundTimer, setRoundTimer] = useState(60)
  const totalElapsedSecondsRef = useRef(0)
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRound, setCurrentRound] = useState(1)
  const [gamePhase, setGamePhase] = useState<'playing' | 'news' | 'trading' | 'results'>('playing')
  const [isRoundActive, setIsRoundActive] = useState(true)
  const [showTradingInterface, setShowTradingInterface] = useState(false)
  const [showNewsReview, setShowNewsReview] = useState(false)
  const [currentNews, setCurrentNews] = useState<RoundNewsItemPayload[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [fixedIncomeOffers, setFixedIncomeOffers] = useState<FixedIncomeOffer[]>([])
  const [fixedIncomeOrders, setFixedIncomeOrders] = useState<Record<string, number>>({})
  const [isGameRunning, setIsGameRunning] = useState(false)

  const {
    state: playerState,
    syncFromServer,
    updateStage,
    applyPriceMap
  } = usePlayerPortfolio()

  const socket = usePortfolioSync({ socketDebug: isDevMode && debugEnabled })
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

  const hasShownFixedIncomeAlert = useRef(false)

  const updateFixedIncomeOffers = useCallback((offers: FixedIncomeOfferPayload[] = []) => {
    const normalized: FixedIncomeOffer[] = offers.map((offer) => ({
      id: offer.id,
      issuer: offer.issuer,
      name: offer.name,
      unitPrice: offer.unitPrice,
      interestRate: offer.interestRate,
      termMonths: offer.termMonths,
      remainingUnits: offer.remainingUnits
    }))

    setFixedIncomeOffers((current) => {
      const sameLength = current.length === normalized.length
      const isSame = sameLength && current.every((currentOffer) => {
        const next = normalized.find((offer) => offer.id === currentOffer.id)
        if (!next) {
          return false
        }
        return (
          next.unitPrice === currentOffer.unitPrice &&
          next.interestRate === currentOffer.interestRate &&
          next.termMonths === currentOffer.termMonths &&
          next.remainingUnits === currentOffer.remainingUnits
        )
      })

      if (isSame) {
        return current
      }

      return normalized
    })

    setFixedIncomeOrders((previous) => {
      const next: Record<string, number> = {}
      normalized.forEach((offer) => {
        next[offer.id] = previous[offer.id] ?? 0
      })

      const prevKeys = Object.keys(previous)
      const nextKeys = Object.keys(next)
      const sameKeys = prevKeys.length === nextKeys.length && nextKeys.every((key) => prevKeys.includes(key))
      if (sameKeys) {
        const sameValues = nextKeys.every((key) => previous[key] === next[key])
        if (sameValues) {
          return previous
        }
      }

      return next
    })
  }, [])

  const handleFixedIncomeInputChange = (offerId: string, value: number) => {
    const sanitized = Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value))
    setFixedIncomeOrders((previous) => ({
      ...previous,
      [offerId]: sanitized
    }))
  }

  const handleFixedIncomePurchase = (offerId: string) => {
    if (!socket) {
      showTransactionError('No hay conexión con el servidor')
      return
    }

    if (currentRound !== 1) {
      showTransactionError('La compra de renta fija solo está disponible en la jugada 1')
      return
    }

    const offer = fixedIncomeOffers.find((item) => item.id === offerId)
    if (!offer) {
      showTransactionError('Emisión no disponible')
      return
    }

    const quantity = fixedIncomeOrders[offerId] ?? 0
    if (quantity <= 0) {
      showTransactionError('Ingresa una cantidad mayor a cero')
      return
    }

    if (quantity > offer.remainingUnits) {
      showTransactionError('No hay suficientes títulos disponibles')
      return
    }

    socket.emit('purchaseFixedIncome', {
      offerId,
      quantity
    })
  }

  const formatCurrency = useCallback((value: number) => {
    return value.toLocaleString('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    })
  }, [])

  useEffect(() => {
    debugLog('GameBoard mounted, loading initial data...')
    fetchNews()
    loadCompanies()
    loadPortfolio()
    startGame()
  }, [])

  useEffect(() => {
    if (!socket) return
    debugLog('GameBoard mounted, requesting initial room and round state')
    socket.emit('checkRoomStatus')
    socket.emit('requestRoundState')
  }, [socket])

  const socketListeners: SocketListener[] = useMemo(() => [
    {
      event: 'gameStarted',
      handler: () => {
        debugLog('Game started! Redirecting to game...')
        setGamePhase('playing')
        setIsRoundActive(true)
        totalElapsedSecondsRef.current = 0
        setTotalElapsedSeconds(0)
        setIsGameRunning(true)
        hasShownFixedIncomeAlert.current = false
        updateFixedIncomeOffers([])
      }
    },
    {
      event: 'playersUpdate',
      handler: (players: any[]) => {
        debugLog(`Players update received. Count: ${players?.length ?? 0}`)
      }
    },
    {
      event: 'gameStartCountdown',
      handler: (seconds: number) => {
        debugLog('Game start countdown:', seconds)
      }
    },
    {
      event: 'roomStatus',
      handler: (data: any) => {
        debugLog('Room status:', data)
        if (!data.inRoom) {
          debugLog('Not in any room, redirecting to lobby')
          navigate('/')
        }
      }
    },
    {
      event: 'roundState',
      handler: (data: RoundStatePayload) => {
        debugLog(`Received round state. round=${data.round} phase=${data.phase} timer=${data.timer}`)
        setCurrentRound(data.round || 1)
        setRoundTimer(data.timer || 0)
        setCurrentNews((data.news ? [data.news.positive, data.news.negative] : []) as RoundNewsPayload[] | [])
        updateStage(data.round || 1)
        updateFixedIncomeOffers((data.fixedIncomeOffers as FixedIncomeOfferPayload[] | undefined) ?? [])

        if (data.status === 'playing' || data.status === 'starting') {
          debugLog('Game is active, setting phase to:', data.phase)
          setIsGameRunning(true)
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
        } else {
          console.log('Game not active, status:', data.status)
          setIsGameRunning(false)
        }
      }
    },
    {
      event: 'priceUpdate',
      handler: (data: { companyId: number; price: number }) => {
        setCompanies((prev) => prev.map((company) => (company.id === data.companyId ? { ...company, currentPrice: data.price } : company)))
      }
    },
    {
      event: 'roundTimer',
      handler: (seconds: number) => {
        debugLog('Received round timer:', seconds)
        setRoundTimer(seconds)

        if (seconds > 60) {
          setGamePhase('news')
          setShowTradingInterface(false)
        } else {
          setGamePhase('trading')
          setShowTradingInterface(true)
        }
      }
    },
    {
      event: 'gameTimer',
      handler: (secs: number) => {
        setTotalElapsedSeconds(secs)
        totalElapsedSecondsRef.current = secs
      }
    },
    {
      event: 'roundStarted',
      handler: (data: RoundStartedPayload) => {
        debugLog(`Round started. round=${data.round} offers=${data.fixedIncomeOffers?.length ?? 0}`)
        setCurrentRound(data.round)
        setRoundTimer(data.timer)
        setGamePhase('news')
        setIsRoundActive(true)
        const newsItems: RoundNewsItemPayload[] = data.news ? [data.news.positive, data.news.negative] : []
        setCurrentNews(newsItems)
        updateFixedIncomeOffers(data.fixedIncomeOffers ?? [])

        if (data.round === 1 && !hasShownFixedIncomeAlert.current && (data.fixedIncomeOffers?.length ?? 0) > 0) {
          showRentaFijaAlert((data.fixedIncomeOffers ?? []).map((offer: FixedIncomeOfferPayload) => offer.issuer))
          hasShownFixedIncomeAlert.current = true
        }

        fetchNews()

        setTimeout(() => {
          setGamePhase('trading')
          setShowTradingInterface(true)
          showSystemNotification('Fase de Trading iniciada. ¡Realiza tus transacciones!')
        }, 15000)
      }
    },
    {
      event: 'roundEnded',
      handler: (data: RoundEndedPayload) => {
        debugLog(`Round ended. round=${data.round} changes=${Object.keys(data.priceChanges || {}).length}`)
        setGamePhase('results')
        setIsRoundActive(false)
        setShowTradingInterface(false)

        const specialEvents = Object.values(data.priceChanges).filter((change: PriceChangePayload) => change.eventType && change.eventType !== 'normal')

        if (specialEvents.length > 0) {
          const event = specialEvents[0] as any
          showSpecialEventNotification(event.eventType, event.message)
        } else {
          showSystemNotification('Ronda finalizada. Calculando fluctuaciones de precios...')
        }

        const priceMap: Record<number, number> = {}
        Object.entries(data.priceChanges as PriceChangesPayloadMap).forEach(([key, change]) => {
          const payload: PriceChangePayload = change as PriceChangePayload
          const companyId = Number(key)
          priceMap[companyId] = payload.newPrice
        })

        setCompanies((prevCompanies) => prevCompanies.map((company) => {
          const price = priceMap[company.id]
          return price ? { ...company, currentPrice: price } : company
        }))

        applyPriceMap(priceMap)
        showSystemNotification('Portfolio actualizado con nuevos precios')

        setTimeout(() => {
          setGamePhase('playing')
        }, 5000)
      }
    },
    {
      event: 'fixedIncomeOffersUpdate',
      handler: (offers: FixedIncomeOfferPayload[]) => {
        debugLog(`Fixed income offers update. count=${offers?.length ?? 0}`)
        updateFixedIncomeOffers(offers)
      }
    },
    {
      event: 'fixedIncomePurchaseResult',
      handler: (result: { success: boolean; error?: string; offer?: { id: string; name: string }; quantity?: number }) => {
        if (result.success && result.offer && result.quantity) {
          showSystemNotification(`Compra de renta fija realizada: ${result.quantity} de ${result.offer.name}`)
          setFixedIncomeOrders((previous) => ({
            ...previous,
            [result.offer!.id]: 0
          }))
        } else if (result.error) {
          showTransactionError(result.error)
        }
      }
    },
    {
      event: 'fixedIncomePayout',
      handler: (payout: { offerId: string; issuer: string; name: string; principal: number; interest: number }) => {
        showSystemNotification(`Pago recibido de ${payout.name}: ${formatCurrency(payout.principal + payout.interest)}`)
      }
    },
    {
      event: 'gameFinished',
      handler: (results: any) => {
        debugLog('Game finished:', results)
        showSystemNotification('¡Juego terminado! Calculando resultados finales...')
        setIsGameRunning(false)
        setTimeout(() => {
          navigate('/results')
        }, 2000)
      }
    },
    {
      event: 'transactionProcessed',
      handler: (data: any) => {
        try {
          if (data.success) {
            showTransactionConfirmation(data.type, data.companyName, data.quantity)
            showDirectorMessage(`Transacción procesada exitosamente: ${data.type} ${data.quantity} acciones de ${data.companyName}`)
            setError(null)
          } else {
            showTransactionError(data.error || 'No se pudo procesar la transacción')
            showDirectorMessage(`Transacción no procesada: ${data.error}`, false)
            setError(data.error || 'No se pudo procesar la transacción')
          }
        } catch (err) {
          console.error('Error processing transaction result:', err)
          setError('Error al procesar resultado de transacción')
        }
      }
    },
    {
      event: 'bulkTransactionProcessed',
      handler: (payload: { success: boolean; results: Array<{ success: boolean; type: 'BUY' | 'SELL'; companyId: number; quantity: number; error?: string; companyName?: string; companySymbol?: string; priceAtMoment?: number }>; processed: number; total: number; serverProcessingMs?: number; clientTs?: number; error?: string }) => {
        try {
          setIsLoading(false)
          if (!payload) return
          if (payload.success) {
            payload.results.filter((r) => r.success).forEach((r) => {
              if (r.companyName && r.quantity) {
                showTransactionConfirmation(r.type as any, r.companyName, r.quantity)
              }
            })

            const failed = payload.results.filter((r) => !r.success)
            if (failed.length > 0) {
              failed.slice(0, 3).forEach((r) => {
                const label = r.companySymbol || r.companyName || `#${r.companyId}`
                showTransactionError(r.error || `No se pudo procesar ${label}`)
              })
              if (failed.length > 3) {
                showTransactionError(`Y ${failed.length - 3} errores más...`)
              }
            }
          } else {
            showTransactionError(payload.error || 'Error al procesar órdenes')
          }
        } catch (err) {
          console.error('Error processing bulk result:', err)
          setError('Error al procesar resultado de órdenes')
        } finally {
          setIsLoading(false)
        }
      }
    }
  ], [navigate, updateStage, updateFixedIncomeOffers, applyPriceMap, fetchNews, showRentaFijaAlert, showSystemNotification, showSpecialEventNotification, showTransactionConfirmation, showDirectorMessage, showTransactionError, formatCurrency])

  useGameSocket({
    socket,
    listeners: socketListeners,
    onEvent: isDevMode && debugEnabled ? (eventName) => debugLog(`Socket event received: ${eventName}`) : undefined
  })

  const loadCompanies = async () => {
    try {
      const response = await api.get('/api/companies')
      const bySymbolId: Record<string, number> = { MPA: 1, MHT: 2, MAG: 3, MTC: 4, MFL: 5, MHL: 6 }
      const normalized = (response.data as Company[]).map((c: any) => ({
        ...c,
        id: bySymbolId[c.symbol] ?? c.id
      })).sort((a: Company, b: Company) => a.id - b.id)
      setCompanies(normalized)
    } catch (error) {
      console.error('Error loading companies:', error)
      const fallbackCompanies = [
        { id: 1, name: 'MichiPapeles', symbol: 'MPA', currentPrice: 80, basePrice: 80, sector: 'Papelería' },
        { id: 2, name: 'MichiHotel', symbol: 'MHT', currentPrice: 100, basePrice: 100, sector: 'Turismo' },
        { id: 3, name: 'MichiAgro', symbol: 'MAG', currentPrice: 70, basePrice: 70, sector: 'Agricultura' },
        { id: 4, name: 'MichiTech', symbol: 'MTC', currentPrice: 90, basePrice: 90, sector: 'Tecnología' },
        { id: 5, name: 'MichiFuel', symbol: 'MFL', currentPrice: 110, basePrice: 110, sector: 'Energía' },
        { id: 6, name: 'MichiHealth', symbol: 'MHL', currentPrice: 85, basePrice: 85, sector: 'Salud' }
      ]
      setCompanies(fallbackCompanies)
    }
  }

  const loadPortfolio = async () => {
    try {
      const response = await api.get('/api/portfolio')
      syncFromServer(response.data as PlayerState)
    } catch (error) {
      console.error('Error loading portfolio. Keeping current client state:', error)
    }
  }

  const executeTransaction = async (type: 'BUY' | 'SELL', companyId: number, transactionQuantity: number) => {
    try {
      console.log('Attempting transaction:', { type, companyId, quantity: transactionQuantity })
      setIsLoading(true)
      setError(null)
      
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
        setError('No hay conexión con el servidor')
        alert('Error: No hay conexión con el servidor')
      }
    } catch (error) {
      console.error('Transaction error:', error)
      setError('Error al procesar la transacción')
      alert('Error al procesar la transacción')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkTransaction = (actions: Array<{ type: 'BUY' | 'SELL'; companyId: number; quantity: number }>) => {
    try {
      if (!socket) {
        showTransactionError('No hay conexión con el servidor')
        return
      }
      if (!actions || actions.length === 0) {
        showTransactionError('No hay órdenes para procesar')
        return
      }
      setIsLoading(true)
      setError(null)
      socket.emit('bulkGameTransactions', {
        userId: 1, // TODO: obtener del auth
        actions,
        clientTs: Date.now()
      })
    } catch (error) {
      console.error('Bulk transaction error:', error)
      setError('Error al procesar las órdenes')
    }
  }


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPositionQuantity = (companyId: number) => {
    return playerState.holdings.find((holding) => holding.stockId === companyId)?.quantity ?? 0
  }

  const handleLogout = () => {
    navigate('/login')
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
    debugLog('Timer state updated:', { roundTimer, currentRound, gamePhase })
  }, [roundTimer, currentRound, gamePhase])

  // Mostrar pantalla de error si hay un error crítico
  if (error && error.includes('Error al procesar')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-4">Error en el Juego</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError(null)
              window.location.reload()
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Reiniciar Juego
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Nuevo Header del Juego */}
      <GameHeader
        currentRound={currentRound}
        totalRounds={TOTAL_ROUNDS}
        roundTimer={roundTimer}
        totalElapsedSeconds={totalElapsedSeconds}
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
            <h3 className="text-lg font-semibold text-white mb-4">VALORES DE RENTA FIJA</h3>
            {currentRound === 1 && fixedIncomeOffers.length > 0 ? (
              <div className="space-y-3">
                {fixedIncomeOffers.map((offer) => (
                  <div key={offer.id} className="bg-slate-700 p-3 rounded flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold text-sm">{offer.name}</span>
                      <span className="text-xs text-amber-300">{offer.termMonths} mes(es)</span>
                    </div>
                    <div className="text-xs text-slate-400">Emisor: {offer.issuer}</div>
                    <div className="text-xs text-slate-400">Unidad: {formatCurrency(offer.unitPrice)}</div>
                    <div className="text-xs text-slate-400">Interés: {(offer.interestRate * 100).toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">Disponibles: {offer.remainingUnits.toLocaleString('es-EC')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                Las emisiones de renta fija solo están disponibles en la primera jugada.
              </div>
            )}
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
          {isLoading && (
            <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <span className="text-blue-300">Procesando transacción...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
          <TradingInterface
            companies={companies}
            onTransaction={executeTransaction}
            isRoundActive={isRoundActive}
            playerHoldings={playerState.holdings}
            fixedIncomeOffers={fixedIncomeOffers}
            fixedIncomeOrders={fixedIncomeOrders}
            onFixedIncomeQuantityChange={handleFixedIncomeInputChange}
            onFixedIncomePurchase={handleFixedIncomePurchase}
            canTradeFixedIncome={currentRound === 1}
            onBulkTransaction={handleBulkTransaction}
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
      {playerState && (
        <div className="fixed bottom-4 right-4 bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-700">
          <h4 className="text-sm font-semibold text-white mb-2">Mi Portfolio</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Efectivo:</span>
              <span className="text-green-400 font-semibold">
                ${playerState.cash.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Acciones:</span>
              <span className="text-white font-semibold">
                ${playerState.portfolioValue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Renta fija:</span>
              <span className="text-amber-300 font-semibold">
                ${(playerState.fixedIncomeValue ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-600 pt-1">
              <span className="text-white font-semibold">Total:</span>
              <span className="text-blue-400 font-bold">
                ${playerState.totalValue.toFixed(2)}
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
