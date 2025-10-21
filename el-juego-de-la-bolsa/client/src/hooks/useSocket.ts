import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    console.log('Creating socket connection...')
    const newSocket = io('http://localhost:3000', {
      transports: ['websocket', 'polling'], // Agregar polling como fallback
      withCredentials: true
    })

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
    })

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    setSocket(newSocket)

    return () => {
      console.log('Closing socket connection')
      newSocket.close()
    }
  }, [])

  return socket
}
