import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'

interface Transaction {
  id: number
  type: 'BUY' | 'SELL'
  quantity: number
  priceAtMoment: number
  createdAt: string
  company: {
    symbol: string
    name: string
  }
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const socket = useSocket()

  useEffect(() => {
    if (socket) {
      // Escuchar transacciones procesadas
      socket.on('transactionProcessed', (data: any) => {
        if (data.success) {
          const newTransaction: Transaction = {
            id: Date.now(), // ID temporal
            type: data.type,
            quantity: data.quantity,
            priceAtMoment: data.priceAtMoment || 0,
            createdAt: new Date().toISOString(),
            company: {
              symbol: data.companySymbol || 'N/A',
              name: data.companyName || 'Unknown Company'
            }
          }
          
          setTransactions(prev => [newTransaction, ...prev].slice(0, 10)) // Mantener solo las últimas 10
        }
      })

      return () => {
        socket.off('transactionProcessed')
      }
    }
  }, [socket])

  const loadTransactions = async () => {
    // Ya no necesitamos cargar desde API, las transacciones vienen por WebSocket
    console.log('Transactions loaded via WebSocket')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getTransactionIcon = (type: 'BUY' | 'SELL') => {
    return type === 'BUY' ? '📈' : '📉'
  }

  const getTransactionColor = (type: 'BUY' | 'SELL') => {
    return type === 'BUY' ? 'text-green-400' : 'text-red-400'
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="text-lg">📊</div>
          <h3 className="text-lg font-semibold text-white">HISTORIAL DE TRANSACCIONES</h3>
          <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {transactions.length}
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400"
        >
          ▼
        </motion.div>
      </div>

      {/* Transaction List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-slate-700"
          >
            <div className="max-h-64 overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  No hay transacciones aún
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {transactions.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-lg">
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                                {transaction.type === 'BUY' ? 'COMPRA' : 'VENTA'}
                              </span>
                              <span className="text-white font-bold">
                                {transaction.company.symbol}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              {transaction.company.name}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-white font-semibold">
                            {transaction.quantity} acciones
                          </div>
                          <div className="text-xs text-slate-400">
                            ${transaction.priceAtMoment.toFixed(2)} c/u
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDate(transaction.createdAt)}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`font-bold ${getTransactionColor(transaction.type)}`}>
                            {transaction.type === 'BUY' ? '-' : '+'}
                            ${(transaction.quantity * transaction.priceAtMoment).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-3 bg-slate-700/50 border-t border-slate-600">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total transacciones:</span>
                <span className="text-white font-semibold">{transactions.length}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
