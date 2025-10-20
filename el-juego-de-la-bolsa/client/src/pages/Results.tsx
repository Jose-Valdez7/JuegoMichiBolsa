import { useEffect, useState } from 'react'
import { useAuth } from '../store/useAuth'
import { useSocket } from '../hooks/useSocket'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../utils/api'

interface PlayerResult {
  playerId: number
  playerName: string
  finalValue: number
  rank: number
  cashBalance?: number
  portfolioValue?: number
}

export default function Results() {
  const { user } = useAuth()
  const socket = useSocket()
  const [results, setResults] = useState<PlayerResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [gameStats, setGameStats] = useState({
    totalRounds: 5,
    duration: '5:00',
    participants: 5
  })

  useEffect(() => {
    loadResults()
    
    if (socket) {
      socket.on('gameFinished', (gameResults: PlayerResult[]) => {
        setResults(gameResults)
        setIsLoading(false)
      })
    }
  }, [socket])

  const loadResults = async () => {
    try {
      const { data } = await api.get('/game/results')
      setResults(data)
    } catch (error) {
      console.error('Error loading results:', error)
      // Datos de fallback para testing
      setResults([
        { playerId: 1, playerName: 'Jugador 1', finalValue: 15420.50, rank: 1 },
        { playerId: 2, playerName: 'Jugador 2', finalValue: 14890.25, rank: 2 },
        { playerId: 3, playerName: 'Jugador 3', finalValue: 13750.80, rank: 3 },
        { playerId: 4, playerName: 'Jugador 4', finalValue: 12100.40, rank: 4 },
        { playerId: 5, playerName: 'Jugador 5', finalValue: 11200.15, rank: 5 }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return '🏅'
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-yellow-400 to-yellow-600'
      case 2: return 'from-gray-300 to-gray-500'
      case 3: return 'from-orange-400 to-orange-600'
      default: return 'from-slate-400 to-slate-600'
    }
  }

  const isCurrentUser = (playerId: number) => {
    return user?.id === playerId
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">Calculando resultados finales...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      {/* Header */}
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-white mb-2">
          🏆 Resultados Finales
        </h1>
        <p className="text-slate-300">El Juego de la Bolsa - BVO Tech1</p>
        <div className="flex justify-center space-x-6 mt-4 text-sm text-slate-400">
          <div>Rondas: {gameStats.totalRounds}</div>
          <div>Duración: {gameStats.duration}</div>
          <div>Participantes: {gameStats.participants}</div>
        </div>
      </motion.div>

      <div className="max-w-4xl mx-auto">
        {/* Podium for top 3 */}
        <motion.div 
          className="flex justify-center items-end mb-8 space-x-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          {results.slice(0, 3).map((player, index) => {
            const heights = ['h-32', 'h-40', 'h-24'] // 2nd, 1st, 3rd
            const orders = [1, 0, 2] // Reorder for podium display
            const actualIndex = orders[index]
            const actualPlayer = results[actualIndex]
            
            return (
              <motion.div
                key={actualPlayer.playerId}
                className={`${heights[index]} w-24 bg-gradient-to-t ${getRankColor(actualPlayer.rank)} rounded-t-lg flex flex-col items-center justify-end p-2 relative`}
                initial={{ height: 0 }}
                animate={{ height: heights[index] }}
                transition={{ delay: 0.5 + index * 0.2 }}
              >
                <div className="text-2xl mb-1">{getRankIcon(actualPlayer.rank)}</div>
                <div className="text-white text-xs font-bold text-center">
                  {actualPlayer.playerName}
                </div>
                <div className="text-white text-xs">
                  ${actualPlayer.finalValue.toFixed(0)}
                </div>
                <div className="absolute -bottom-6 text-white font-bold">
                  #{actualPlayer.rank}
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Full Rankings */}
        <motion.div 
          className="bg-slate-800/50 rounded-lg p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-xl font-bold text-white mb-4">Ranking Completo</h2>
          <div className="space-y-3">
            {results.map((player, index) => (
              <motion.div
                key={player.playerId}
                className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                  isCurrentUser(player.playerId) 
                    ? 'bg-blue-900/50 border-2 border-blue-500' 
                    : 'bg-slate-700/50'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + index * 0.1 }}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{getRankIcon(player.rank)}</div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">
                        #{player.rank} {player.playerName}
                      </span>
                      {isCurrentUser(player.playerId) && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                          TÚ
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">
                      Portafolio Final
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    ${player.finalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-slate-400">
                    {player.finalValue > 10000 ? '+' : ''}
                    {((player.finalValue - 10000) / 10000 * 100).toFixed(1)}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Certificate and Actions */}
        <motion.div 
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          <div className="bg-slate-800/50 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4">
              🎓 Certificado de Participación
            </h3>
            <p className="text-slate-300 mb-4">
              Felicidades por completar El Juego de la Bolsa. 
              Descarga tu certificado de participación.
            </p>
            <a 
              href={`/certificate/${user?.id}`}
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📄 Descargar Certificado
            </a>
          </div>

          <div className="flex justify-center space-x-4">
            <Link 
              to="/"
              className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition-colors"
            >
              🏠 Volver al Inicio
            </Link>
            <button 
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg transition-colors"
            >
              🔄 Jugar de Nuevo
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
