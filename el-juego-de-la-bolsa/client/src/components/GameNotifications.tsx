import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Notification {
  id: string
  type: 'system' | 'director' | 'renta_fija' | 'success' | 'error'
  title: string
  message: string
  duration?: number
}

interface GameNotificationsProps {
  notifications: Notification[]
  onRemoveNotification: (id: string) => void
}

export default function GameNotifications({
  notifications,
  onRemoveNotification
}: GameNotificationsProps) {
  
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.duration) {
        const timer = setTimeout(() => {
          onRemoveNotification(notification.id)
        }, notification.duration)
        
        return () => clearTimeout(timer)
      }
    })
  }, [notifications, onRemoveNotification])

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'system':
        return 'bg-blue-600 border-blue-500'
      case 'director':
        return 'bg-purple-600 border-purple-500'
      case 'renta_fija':
        return 'bg-yellow-600 border-yellow-500'
      case 'success':
        return 'bg-green-600 border-green-500'
      case 'error':
        return 'bg-red-600 border-red-500'
      default:
        return 'bg-gray-600 border-gray-500'
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'system':
        return '🔔'
      case 'director':
        return '👔'
      case 'renta_fija':
        return '🏛️'
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      default:
        return 'ℹ️'
    }
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className={`${getNotificationStyle(notification.type)} text-white rounded-lg shadow-lg border-l-4 p-4 cursor-pointer`}
            onClick={() => onRemoveNotification(notification.id)}
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{getIcon(notification.type)}</div>
              <div className="flex-1">
                <div className="font-bold text-sm">{notification.title}</div>
                <div className="text-xs opacity-90 mt-1">{notification.message}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveNotification(notification.id)
                }}
                className="text-white/70 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// Hook para manejar notificaciones
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const newNotification = {
      ...notification,
      id,
      duration: notification.duration || 5000
    }
    setNotifications(prev => [...prev, newNotification])
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // Notificaciones predefinidas del juego
  const showSystemNotification = (message: string) => {
    addNotification({
      type: 'system',
      title: 'Sistema',
      message,
      duration: 3000
    })
  }

  const showDirectorMessage = (message: string, success: boolean = true) => {
    addNotification({
      type: 'director',
      title: 'Director de Rueda',
      message,
      duration: 4000
    })
  }

  const showRentaFijaAlert = (companies: string[]) => {
    addNotification({
      type: 'renta_fija',
      title: 'Jugada 1 - Alerta de Renta Fija',
      message: `Nuevas emisiones disponibles: ${companies.join(', ')}`,
      duration: 6000
    })
  }

  const showTransactionConfirmation = (type: 'buy' | 'sell', company: string, quantity: number) => {
    addNotification({
      type: 'success',
      title: 'Transacción Registrada',
      message: `${type === 'buy' ? 'Compra' : 'Venta'} de ${quantity} acciones de ${company}`,
      duration: 3000
    })
  }

  const showTransactionError = (message: string) => {
    addNotification({
      type: 'error',
      title: 'Error en Transacción',
      message,
      duration: 4000
    })
  }

  const showSpecialEventNotification = (eventType: string, message: string) => {
    const eventConfig = {
      boom: { type: 'success' as const, title: '🚀 EVENTO BOOM!', duration: 8000 },
      crash: { type: 'error' as const, title: '📉 EVENTO CRASH!', duration: 8000 },
      split: { type: 'system' as const, title: '📈 EVENTO SPLIT!', duration: 8000 },
      contraplit: { type: 'system' as const, title: '📊 EVENTO CONTRA-SPLIT!', duration: 8000 }
    }

    const config = eventConfig[eventType as keyof typeof eventConfig] || {
      type: 'system' as const,
      title: '⚡ EVENTO ESPECIAL!',
      duration: 8000
    }

    addNotification({
      type: config.type,
      title: config.title,
      message,
      duration: config.duration
    })
  }

  return {
    notifications,
    addNotification,
    removeNotification,
    showSystemNotification,
    showDirectorMessage,
    showRentaFijaAlert,
    showTransactionConfirmation,
    showTransactionError,
    showSpecialEventNotification
  }
}
