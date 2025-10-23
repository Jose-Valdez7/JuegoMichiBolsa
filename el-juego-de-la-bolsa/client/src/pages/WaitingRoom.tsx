import { useEffect, useState } from 'react'
import { useGame } from '../store/useGame'
import { useAuth } from '../store/useAuth'
import { useSocket } from '../hooks/useSocket'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Player {
  id: number
  name: string
  isReady: boolean
  avatar?: string
}

export default function WaitingRoom() {
  const { startGame } = useGame()
  const { user } = useAuth()
  const socket = useSocket()
  const [players, setPlayers] = useState<Player[]>([])
  const [gameTimer, setGameTimer] = useState(0)
  const [isGameStarting, setIsGameStarting] = useState(false)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'ready' | 'starting'>('waiting')
  const nav = useNavigate()

  useEffect(() => {
    if (!socket) return

    // El usuario ya debería estar en una sala desde el lobby
    console.log('WaitingRoom mounted, user should already be in a room')
    
    // Verificar si estamos en una sala
    socket.emit('checkRoomStatus')
    
    // Si se reconecta, verificar estado de la sala
    socket.on('connect', () => {
      console.log('Socket reconnected, checking room status')
      socket.emit('checkRoomStatus')
    })

    // Escuchar eventos del socket
    socket.on('playersUpdate', (playersList: Player[]) => {
      setPlayers(playersList)
      if (playersList.length === 5) {
        setGameStatus('ready')
      } else {
        setGameStatus('waiting')
      }
    })

    socket.on('gameStartCountdown', (seconds: number) => {
      setGameTimer(seconds)
      if (seconds > 0) {
        setGameStatus('starting')
        setIsGameStarting(true)
      }
    })

    socket.on('gameStarted', () => {
      nav('/game')
    })

    socket.on('roomStatus', (data: any) => {
      if (!data.inRoom) {
        nav('/')
      } else {
        // Actualizar lista de jugadores
        if (data.playersList) {
          setPlayers(data.playersList)
          if (data.playersList.length === 5) {
            setGameStatus('ready')
          } else {
            setGameStatus('waiting')
          }
        }
        // Si ya estamos en una sala, solicitar el estado actual
        socket.emit('requestRoundState')
      }
    })

    socket.on('playerJoined', (data: any) => {
      setPlayers(data.players)
      if (data.players.length === 5) {
        setGameStatus('ready')
      } else {
        setGameStatus('waiting')
      }
    })

    return () => {
      socket.off('playersUpdate')
      socket.off('gameStartCountdown')
      socket.off('gameStarted')
      socket.off('roomStatus')
      socket.off('playerJoined')
      socket.off('connect')
    }
  }, [socket, user, nav])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPlayerSlots = () => {
    const slots = []
    for (let i = 0; i < 5; i++) {
      const player = players[i]
      slots.push(
        <motion.div
          key={i}
          className={`p-4 rounded-lg border-2 transition-all ${
            player 
              ? 'bg-green-900/30 border-green-500 text-green-300'
              : 'bg-slate-700/30 border-slate-600 text-slate-400'
          }`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              player ? 'bg-green-500' : 'bg-slate-600'
            }`}>
              {player ? '👤' : '⏳'}
            </div>
            <div>
              <div className="font-semibold">
                {player ? player.name : `Esperando jugador ${i + 1}...`}
              </div>
              <div className="text-xs opacity-70">
                {player ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
          </div>
        </motion.div>
      )
    }
    return slots
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="text-2xl">🏦</div>
          <div>
            <h1 className="text-2xl font-bold text-white">El Juego de la Bolsa</h1>
            <p className="text-slate-400">Sala de Espera</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm text-slate-400">Jugadores conectados</div>
            <div className="text-xl font-bold text-white">{players.length}/5</div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Game Status */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {gameStatus === 'waiting' && (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-yellow-400">
                Esperando jugadores...
              </div>
              <div className="text-slate-300">
                Se necesitan {5 - players.length} jugadores más para comenzar
              </div>
            </div>
          )}
          
          {gameStatus === 'ready' && !isGameStarting && (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-400">
                ¡Todos los jugadores conectados!
              </div>
              <div className="text-slate-300">
                El juego comenzará automáticamente en breve...
              </div>
            </div>
          )}
          
          {gameStatus === 'starting' && (
            <div className="space-y-4">
              <div className="text-4xl font-bold text-blue-400">
                ¡Iniciando en {gameTimer}!
              </div>
              <div className="text-slate-300">
                Prepárate para el campanazo de inicio 🔔
              </div>
              <motion.div 
                className="w-32 h-32 mx-auto bg-blue-500 rounded-full flex items-center justify-center text-4xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🔔
              </motion.div>
            </div>
          )}
        </motion.div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {getPlayerSlots()}
        </div>

        {/* Instructions */}
        <motion.div 
          className="bg-slate-800/50 p-6 rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-white mb-4">📋 Instrucciones del Juego</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <ul className="space-y-2">
              <li>• <strong>5 jugadores</strong> compiten simultáneamente</li>
              <li>• <strong>$10,000</strong> iniciales para invertir</li>
              <li>• <strong>5 rondas</strong> de 1 minuto cada una</li>
              <li>• Observa las <strong>noticias</strong> antes de cada ronda</li>
            </ul>
            <ul className="space-y-2">
              <li>• Compra y vende <strong>acciones</strong> estratégicamente</li>
              <li>• Las noticias <strong>afectan los precios</strong></li>
              <li>• Gana quien tenga el <strong>mayor portafolio</strong></li>
              <li>• Recibe un <strong>certificado</strong> al finalizar</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
