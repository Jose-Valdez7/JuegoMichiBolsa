import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface News {
  id: number
  title: string
  content: string
  type: 'positive' | 'negative'
  affectedSectors: string[]
}

interface NewsReviewProps {
  currentNews: News[]
  isVisible: boolean
  onClose: () => void
}

export default function NewsReview({ currentNews, isVisible, onClose }: NewsReviewProps) {
  const [selectedNews, setSelectedNews] = useState<News | null>(null)

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold flex items-center">
                📰 Revisión de Noticias
              </h2>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                ×
              </button>
            </div>
            <p className="text-blue-100 mt-2">
              Revisa las noticias de esta ronda para tomar mejores decisiones
            </p>
          </div>

          <div className="flex h-96">
            {/* Lista de Noticias */}
            <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
              <div className="p-4">
                <h3 className="font-semibold text-gray-700 mb-4">Noticias Actuales</h3>
                <div className="space-y-2">
                  {currentNews.map((news) => (
                    <motion.button
                      key={news.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedNews(news)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedNews?.id === news.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <div className={`w-3 h-3 rounded-full ${
                          news.type === 'positive' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className="text-xs font-medium text-gray-500">
                          {news.type === 'positive' ? 'POSITIVA' : 'NEGATIVA'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-800 line-clamp-2">
                        {news.title}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Detalle de Noticia */}
            <div className="flex-1 p-6 overflow-y-auto">
              {selectedNews ? (
                <motion.div
                  key={selectedNews.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      selectedNews.type === 'positive' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {selectedNews.type === 'positive' ? '+' : '-'}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      selectedNews.type === 'positive' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      NOTICIA {selectedNews.type === 'positive' ? 'POSITIVA' : 'NEGATIVA'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-4">
                    {selectedNews.title}
                  </h3>

                  <div className="prose prose-sm text-gray-600 mb-6">
                    {selectedNews.content}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Sectores Afectados:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedNews.affectedSectors.map((sector, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                        >
                          {sector}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📰</div>
                    <p>Selecciona una noticia para ver los detalles</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 <strong>Tip:</strong> Relaciona las noticias con los sectores para tomar mejores decisiones
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continuar Jugando
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
