import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'

const CHARACTERS = [
  { id: 1, name: 'Ana', avatar: '/images/characters/personaje1.png', color: 'bg-pink-500' },
  { id: 2, name: 'Carlos', avatar: '/images/characters/personaje2.png', color: 'bg-blue-500' },
  { id: 3, name: 'María', avatar: '/images/characters/personaje3.png', color: 'bg-green-500' },
  { id: 4, name: 'Luis', avatar: '/images/characters/personaje4.png', color: 'bg-purple-500' },
  { id: 5, name: 'Sofia', avatar: '/images/characters/personaje5.png', color: 'bg-orange-500' },
  { id: 6, name: 'Alex', avatar: '/images/characters/personaje6.png', color: 'bg-red-500' }
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo con blur */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/images/ui/fondo-principal.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'blur(5px)'
        }}
      ></div>
        {/* Card para pantalla inicial */}
        {!gameMode && (
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl max-w-6xl w-full overflow-hidden relative border-2 border-slate-600">
            {/* Layout dividido en dos mitades sin gap */}
            <div className="flex flex-col lg:flex-row min-h-[600px]">
              {/* Mitad izquierda - Imagen ocupando toda la mitad */}
              <div 
                className="w-full lg:w-1/2 relative"
                style={{
                  backgroundImage: 'url(/images/cards/card-gato.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
              </div>

              {/* Mitad derecha - Título y botones */}
              <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-12 space-y-8">
                <div className="text-center">
                  <div className="mb-6">
                    <img
                      src="/images/companies/logo-vector.png"
                      alt="Logo de la Empresa"
                      className="h-64 mx-auto object-contain"
                    />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-3">
                    💼 El Juego de la Bolsa 💼
                  </h1>
              
                </div>

                <div className="w-full space-y-6">
                  <button
                    onClick={() => setGameMode('create')}
                    className="w-full transition-transform hover:scale-105"
                  >
                    <img
                      src="/images/buttons/crear-partida.png"
                      alt="Crear Partida"
                      className="w-full h-20 object-contain"
                    />
                  </button>

                  <button
                    onClick={() => setGameMode('join')}
                    className="w-full transition-transform hover:scale-105"
                  >
                    <img
                      src="/images/buttons/unirse-partida.png"
                      alt="Unirse a Partida"
                      className="w-full h-20 object-contain"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card para crear partida */}
        {gameMode === 'create' && (
          <div className="bg-slate-800/90 backdrop-blur-lg rounded-3xl p-8 max-w-7xl w-full border-2 border-slate-600 shadow-2xl relative">
            <div className="space-y-4 relative z-[99999]">
            <div className="relative z-[99999] bg-slate-800/90 backdrop-blur-sm p-4 rounded-lg">
              <label className="block text-white font-medium mb-2">Tu Nombre</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ingresa tu nombre"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none relative z-[99999]"
                maxLength={20}
                style={{ zIndex: 99999 }}
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-4 text-xl text-center">
                ✨ Selecciona tu Personaje ✨
              </label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-6 p-8 bg-slate-700/60 rounded-3xl border-2 border-slate-600 shadow-2xl relative">
                {CHARACTERS.map((character) => {
                  const isTaken = takenCharacters.includes(character.id)
                  const isSelected = selectedCharacter === character.id

                  return (
                    <button
                      key={character.id}
                      onClick={() => !isTaken && setSelectedCharacter(character.id)}
                      disabled={isTaken}
                      className={`
                        p-6 rounded-3xl border-4 transition-all duration-300 relative overflow-hidden transform h-32 w-full
                        ${isSelected
                          ? 'border-blue-400 shadow-2xl shadow-blue-500/60 scale-105 ring-4 ring-blue-500/30'
                          : isTaken
                            ? 'border-red-400 opacity-50 cursor-not-allowed grayscale'
                            : 'border-slate-600 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 hover:ring-2 hover:ring-blue-500/20'
                        }
                      `}
                      style={{
                        backgroundImage: `url(${character.avatar})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundBlendMode: 'overlay'
                      }}
                    >
                      {/* Gradiente overlay para mejor legibilidad */}
                      {/* Gradientes ELIMINADOS para evitar interferencia con inputs */}

                      {/* Contenido del botón */}
                      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-2">
                        {isSelected && (
                          <div className="text-sm text-white font-bold animate-pulse bg-green-600 px-4 py-2 rounded-full shadow-lg border-2 border-green-400">
                            ✓ Seleccionado
                          </div>
                        )}
                        {isTaken && (
                          <div className="text-sm text-red-300 font-semibold bg-red-500/20 px-3 py-1 rounded-full">
                            ✗ Ocupado
                          </div>
                        )}
                      </div>
                      {isTaken && (
                        <div className="text-xs text-red-400 mt-1">Ocupado</div>
                      )}
                    </button>
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
              <button
                onClick={handleCreateGame}
                disabled={isLoading}
                className="w-full transition-transform hover:scale-105"
              >
                <img
                  src="/images/buttons/crear-partida.png"
                  alt="Crear Partida"
                  className="w-full h-16 object-contain"
                />
              </button>
            )}

            <button
              onClick={resetForm}
              className="w-full text-slate-400 hover:text-white py-2 text-sm transition-colors"
            >
              ← Volver
            </button>
            </div>
          </div>
        )}

        {/* Card para unirse a partida */}
        {gameMode === 'join' && (
          <div className="bg-slate-800/90 backdrop-blur-lg rounded-3xl p-8 max-w-7xl w-full border-2 border-slate-600 shadow-2xl relative">
            <div className="space-y-4 relative z-[99999]">
            <div className="relative z-[99999] bg-slate-800/90 backdrop-blur-sm p-4 rounded-lg">
              <label className="block text-white font-medium mb-2">Tu Nombre</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ingresa tu nombre"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none relative z-[99999]"
                maxLength={20}
                style={{ zIndex: 99999 }}
              />
            </div>

            <div className="relative z-[99999] bg-slate-800/90 backdrop-blur-sm p-4 rounded-lg">
              <label className="block text-white font-medium mb-2">Código de la Partida</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Ingresa el código"
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none font-mono text-center text-lg relative z-[99999]"
                maxLength={6}
                style={{ zIndex: 99999 }}
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-4 text-xl text-center">
                ✨ Selecciona tu Personaje ✨
              </label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-6 p-8 bg-slate-700/60 rounded-3xl border-2 border-slate-600 shadow-2xl relative">
                {CHARACTERS.map((character) => {
                  const isTaken = takenCharacters.includes(character.id)
                  const isSelected = selectedCharacter === character.id

                  return (
                    <button
                      key={character.id}
                      onClick={() => !isTaken && setSelectedCharacter(character.id)}
                      disabled={isTaken}
                      className={`
                        p-6 rounded-3xl border-4 transition-all duration-300 relative overflow-hidden transform h-32 w-full
                        ${isSelected
                          ? 'border-blue-400 shadow-2xl shadow-blue-500/60 scale-105 ring-4 ring-blue-500/30'
                          : isTaken
                            ? 'border-red-400 opacity-50 cursor-not-allowed grayscale'
                            : 'border-slate-600 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 hover:ring-2 hover:ring-blue-500/20'
                        }
                      `}
                      style={{
                        backgroundImage: `url(${character.avatar})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundBlendMode: 'overlay'
                      }}
                    >
                      {/* Gradiente overlay para mejor legibilidad */}
                      {/* Gradientes ELIMINADOS para evitar interferencia con inputs */}

                      {/* Contenido del botón */}
                      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-2">
                        {isSelected && (
                          <div className="text-sm text-white font-bold animate-pulse bg-green-600 px-4 py-2 rounded-full shadow-lg border-2 border-green-400">
                            ✓ Seleccionado
                          </div>
                        )}
                        {isTaken && (
                          <div className="text-sm text-red-300 font-semibold bg-red-500/20 px-3 py-1 rounded-full">
                            ✗ Ocupado
                          </div>
                        )}
                      </div>
                      {isTaken && (
                        <div className="text-xs text-red-400 mt-1">Ocupado</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleJoinGame}
              disabled={isLoading}
              className="w-full transition-transform hover:scale-105"
            >
              <img
                src="/images/buttons/unirse-partida.png"
                alt="Unirse a Partida"
                className="w-full h-16 object-contain"
              />
            </button>

            <button
              onClick={resetForm}
              className="w-full text-slate-400 hover:text-white py-2 text-sm transition-colors"
            >
              ← Volver
            </button>
            </div>
          </div>
        )}

        {error && (
          <div
            className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm"
          >
            {error}
          </div>
        )}
    </div>
  )
}