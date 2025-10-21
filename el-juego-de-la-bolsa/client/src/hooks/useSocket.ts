import { useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'
import { socketManager } from '../utils/socket'

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    console.log('Getting socket from manager...')
    const socket = socketManager.getSocket()
    setSocket(socket)

    // No cerrar el socket al desmontar el componente
    return () => {
      console.log('Component unmounting, keeping socket alive')
    }
  }, [])

  return socket
}
