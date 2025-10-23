import { io, Socket } from 'socket.io-client'

class SocketManager {
  private static instance: SocketManager
  private socket: Socket | null = null

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager()
    }
    return SocketManager.instance
  }

  public getSocket(): Socket {
    if (!this.socket) {
      console.log('Creating new socket connection...')
      // Usar variable de entorno o localhost por defecto
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
      
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        autoConnect: true
      })

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id)
      })

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected')
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
      })
    }
    return this.socket
  }

  public disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting socket')
      this.socket.disconnect()
      this.socket = null
    }
  }
}

export const socketManager = SocketManager.getInstance()
export default socketManager