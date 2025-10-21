import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'

const CHARACTERS = [
  { id: 1, name: 'Ana', avatar: '👩‍💼', color: 'bg-pink-500' },
  { id: 2, name: 'Carlos', avatar: '👨‍💻', color: 'bg-blue-500' },
  { id: 3, name: 'María', avatar: '👩‍🔬', color: 'bg-green-500' },
  { id: 4, name: 'Luis', avatar: '👨‍🎓', color: 'bg-purple-500' },
  { id: 5, name: 'Sofia', avatar: '👩‍🚀', color: 'bg-orange-500' }
]

export default function Lobby() {
  const [gameMode, setGameMode] = useState<'create' | 'join' | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [takenCharacters, setTakenCharacters] = useState<number[]>([])
  
  const socket = useSocket()
  const navigate = useNavigate()

  useEffect(() => {
    if (!socket) return

    // Escuchar eventos del socket
    socket.on('roomCreated', (data: any) => {
      console.log('Room created:', data)
      setGeneratedCode(data.roomCode)
      setError('')
    })

    socket.on('roomError', (data: any) => {
      console.log('Room error:', data)
      setError(data.message)
      setIsLoading(false)
    })

    socket.on('playerJoined', (data: any) => {
      console.log('Player joined:', data)
      setError('')
      
      // Actualizar personajes tomados
      const taken = data.players.map((p: any) => p.characterId).filter((id: number) => id !== undefined)
      setTakenCharacters(taken)
    })

    socket.on('gameStartCountdown', (seconds: number) => {
      console.log('Game starting in:', seconds)
      navigate('/waiting')
    })

    socket.on('gameStarted', () => {
      console.log('Game started!')
      navigate('/game')
    })

    return () => {
      socket.off('roomCreated')
      socket.off('roomError')
      socket.off('playerJoined')
      socket.off('gameStartCountdown')
      socket.off('gameStarted')
    }
  }, [socket, navigate])

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError('Por favor ingresa tu nombre')
      return
    }

    if (selectedCharacter === null) {
      setError('Por favor selecciona un personaje')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Generar código único de 6 caracteres
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      if (socket) {
        socket.emit('createRoom', { 
          playerName: playerName.trim(),
          roomCode: code,
          characterId: selectedCharacter
        })
        setGeneratedCode(code)
      }
    } catch (err) {
      setError('Error al crear la partida')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinGame = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      setError('Por favor completa todos los campos')
      return
    }

    if (selectedCharacter === null) {
      setError('Por favor selecciona un personaje')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      if (socket) {
        socket.emit('joinRoom', { 
          playerName: playerName.trim(),
          roomCode: roomCode.trim().toUpperCase(),
          characterId: selectedCharacter
        })
      }
    } catch (err) {
      setError('Error al unirse a la partida')
    } finally {
      setIsLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode)
    setError('Código copiado al portapapeles')
  }

  const resetForm = () => {
    setGameMode(null)
    setRoomCode('')
    setPlayerName('')
    setSelectedCharacter(null)
    setError('')
    setGeneratedCode('')
    setTakenCharacters([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <motion.div
        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full border border-slate-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            🏦
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">El Juego de la Bolsa</h1>
          <p className="text-slate-400">Simulación Bursátil BVO Tech1</p>
        </div>

        {!gameMode && (
          <div className="space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setGameMode('create')}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-lg font-semibold transition-colors"
            >
              🎮 Crear Partida
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setGameMode('join')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg font-semibold transition-colors"
            >
              🔗 Unirse a Partida
            </motion.button>
          </div>
        )}

        {gameMode === 'create' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-white font-medium mb-2">Tu Nombre</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ingresa tu nombre"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-white font-medium mb-3">Selecciona tu Personaje</label>
              <div className="grid grid-cols-5 gap-2">
                {CHARACTERS.map((character) => {
                  const isTaken = takenCharacters.includes(character.id)
                  const isSelected = selectedCharacter === character.id
                  
                  return (
                    <motion.button
                      key={character.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => !isTaken && setSelectedCharacter(character.id)}
                      disabled={isTaken}
                      className={`
                        p-3 rounded-lg border-2 transition-all
                        ${isSelected 
                          ? 'border-blue-400 bg-blue-500/20' 
                          : isTaken 
                            ? 'border-red-400 bg-red-500/20 opacity-50 cursor-not-allowed'
                            : 'border-slate-600 bg-slate-700 hover:border-blue-400 hover:bg-slate-600'
                        }
                      `}
                    >
                      <div className="text-2xl mb-1">{character.avatar}</div>
                      <div className="text-xs text-white font-medium">{character.name}</div>
                      {isTaken && (
                        <div className="text-xs text-red-400 mt-1">Ocupado</div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {generatedCode && (
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-4">
                <h3 className="text-green-400 font-semibold mb-2">¡Partida Creada!</h3>
                <p className="text-white text-sm mb-3">Comparte este código con otros jugadores:</p>
                <div className="flex items-center space-x-2">
                  <div className="bg-slate-700 px-4 py-2 rounded font-mono text-lg font-bold text-white">
                    {generatedCode}
                  </div>
                  <button
                    onClick={copyCode}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                  >
                    📋 Copiar
                  </button>
                </div>
                <p className="text-slate-400 text-xs mt-2">
                  Esperando a que se unan 4 jugadores más...
                </p>
              </div>
            )}

            {!generatedCode && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateGame}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
              >
                {isLoading ? '⏳ Creando...' : '🎮 Crear Partida'}
              </motion.button>
            )}

            <button
              onClick={resetForm}
              className="w-full text-slate-400 hover:text-white py-2 text-sm transition-colors"
            >
              ← Volver
            </button>
          </motion.div>
        )}

        {gameMode === 'join' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-white font-medium mb-2">Tu Nombre</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ingresa tu nombre"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Código de la Partida</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Ingresa el código"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none font-mono text-center text-lg"
                maxLength={6}
              />
            </div>

            <div>
              <label className="block text-white font-medium mb-3">Selecciona tu Personaje</label>
              <div className="grid grid-cols-5 gap-2">
                {CHARACTERS.map((character) => {
                  const isTaken = takenCharacters.includes(character.id)
                  const isSelected = selectedCharacter === character.id
                  
                  return (
                    <motion.button
                      key={character.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => !isTaken && setSelectedCharacter(character.id)}
                      disabled={isTaken}
                      className={`
                        p-3 rounded-lg border-2 transition-all
                        ${isSelected 
                          ? 'border-blue-400 bg-blue-500/20' 
                          : isTaken 
                            ? 'border-red-400 bg-red-500/20 opacity-50 cursor-not-allowed'
                            : 'border-slate-600 bg-slate-700 hover:border-blue-400 hover:bg-slate-600'
                        }
                      `}
                    >
                      <div className="text-2xl mb-1">{character.avatar}</div>
                      <div className="text-xs text-white font-medium">{character.name}</div>
                      {isTaken && (
                        <div className="text-xs text-red-400 mt-1">Ocupado</div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleJoinGame}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
            >
              {isLoading ? '⏳ Uniéndose...' : '🔗 Unirse a Partida'}
            </motion.button>

            <button
              onClick={resetForm}
              className="w-full text-slate-400 hover:text-white py-2 text-sm transition-colors"
            >
              ← Volver
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
