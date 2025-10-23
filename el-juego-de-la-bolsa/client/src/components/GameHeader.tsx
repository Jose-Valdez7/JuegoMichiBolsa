import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../store/useAuth'

interface GameHeaderProps {
  currentRound: number
  totalRounds: number
  roundTimer: number
  totalElapsedSeconds: number
  gamePhase: 'playing' | 'news' | 'trading' | 'results'
  onLogout?: () => void
  onToggleSound?: () => void
  onShowHelp?: () => void
}

export default function GameHeader({
  currentRound,
  totalRounds,
  roundTimer,
  totalElapsedSeconds,
  gamePhase,
  onLogout,
  onToggleSound,
  onShowHelp
}: GameHeaderProps) {
  const { user } = useAuth()
  const [soundEnabled, setSoundEnabled] = useState(true)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getPhaseText = () => {
    switch (gamePhase) {
      case 'news': return 'Fase de Noticias'
      case 'trading': return 'Fase de Trading'
      case 'results': return 'Fluctuación de Precios'
      default: return 'En Juego'
    }
  }

  const handleSoundToggle = () => {
    setSoundEnabled(!soundEnabled)
    onToggleSound?.()
  }

  return (
    <motion.header 
      className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-6 py-4 shadow-lg"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex justify-between items-center">
        {/* Lado Izquierdo - Información del Usuario y Evento */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
              🏦
            </div>
            <h1 className="text-xl font-bold">El Juego de la Bolsa - BVO Tech1</h1>
          </div>
          
          <div className="text-sm opacity-90">
            <div className="font-medium">{user?.name || 'Jugador'}</div>
            <div className="text-xs">Evento: Simulación Bursátil</div>
          </div>
        </div>

        {/* Centro - Información del Juego */}
        <div className="flex items-center space-x-8 text-center">
          <div className="bg-white/10 rounded-lg px-4 py-2">
            <div className="text-xs opacity-75">Ronda</div>
            <div className="text-lg font-bold">{currentRound}/{totalRounds}</div>
          </div>

          <div className="bg-white/10 rounded-lg px-4 py-2">
            <div className="text-xs opacity-75">Fase</div>
            <div className="text-sm font-medium">{getPhaseText()}</div>
          </div>

          <div className="bg-white/10 rounded-lg px-4 py-2">
            <div className="text-xs opacity-75">Tiempo Restante</div>
            <div className="text-xl font-mono font-bold text-yellow-300">
              {formatTime(roundTimer)}
            </div>
          </div>

          <div className="bg-white/10 rounded-lg px-4 py-2">
            <div className="text-xs opacity-75">Tiempo Total</div>
            <div className="text-sm font-medium">{formatTime(totalElapsedSeconds)}</div>
          </div>
        </div>

        {/* Lado Derecho - Controles e Iconos de Ayuda */}
        <div className="flex items-center space-x-3">
          {/* Icono Azul - Configuración/Evento */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogout}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors"
            title="Configuración / Cerrar Sesión"
          >
            ⚙️
          </motion.button>

          {/* Icono Verde - Sonido */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSoundToggle}
            className={`w-10 h-10 ${soundEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} rounded-full flex items-center justify-center transition-colors`}
            title="Activar/Desactivar Narración"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </motion.button>

          {/* Icono Rojo - Ayuda */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onShowHelp}
            className="w-10 h-10 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
            title="Ayuda"
          >
            ❓
          </motion.button>
        </div>
      </div>

      {/* Barra de Progreso del Tiempo */}
      {roundTimer > 0 && (
        <div className="mt-3">
          <div className="w-full bg-white/20 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: `${(roundTimer / 60) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
        </div>
      )}
    </motion.header>
  )
}
