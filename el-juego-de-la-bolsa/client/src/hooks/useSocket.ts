import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../store/useAuth'

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const { token } = useAuth()

  useEffect(() => {
    if (!token) return

    const newSocket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket']
    })

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
    })

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [token])

  return socket
}
