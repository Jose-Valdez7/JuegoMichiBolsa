import { motion } from 'framer-motion'

interface Company {
  id: number
  name: string
  symbol: string
  currentPrice: number
  basePrice: number
  sector: string
  availableStocks?: number
}

interface StockChartProps {
  companies: Company[]
  onCompanySelect?: (company: Company) => void
}

export default function StockChart({ companies, onCompanySelect }: StockChartProps) {
  console.log('StockChart rendering with companies:', companies)
  
  if (!companies.length) {
    console.log('No companies data, not rendering chart')
    return (
      <div className="bg-slate-800 p-6 rounded-lg">
        <div className="text-center text-slate-400">
          <p>Cargando datos de empresas...</p>
        </div>
      </div>
    )
  }

  const maxPrice = Math.max(...companies.map(c => c.currentPrice))
  const minPrice = Math.min(...companies.map(c => c.currentPrice))
  const priceRange = maxPrice - minPrice

  const getBarHeight = (price: number) => {
    if (priceRange === 0) return 50
    return 30 + ((price - minPrice) / priceRange) * 200
  }

  const getBarColor = (company: Company) => {
    const change = ((company.currentPrice - company.basePrice) / company.basePrice) * 100
    if (change > 10) return 'bg-green-500'
    if (change > 5) return 'bg-green-400'
    if (change > 0) return 'bg-blue-500'
    if (change > -5) return 'bg-yellow-500'
    if (change > -10) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getSectorIcon = (sector: string) => {
    switch (sector.toLowerCase()) {
      case 'tech': return '💻'
      case 'finance': return '🏦'
      case 'energy': return '⚡'
      case 'health': return '🏥'
      case 'retail': return '🛒'
      default: return '🏢'
    }
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">TÍTULOS RENTA VARIABLE</h2>
        <div className="text-sm text-slate-400">
          Jugada 1 - Juego por iniciar
        </div>
      </div>
      
      <div className="relative">
        {/* Chart Container */}
        <div className="flex items-end justify-center space-x-2 h-64 mb-4">
          {companies.map((company, index) => {
            const barHeight = getBarHeight(company.currentPrice)
            const change = ((company.currentPrice - company.basePrice) / company.basePrice) * 100
            
            return (
              <motion.div
                key={company.id}
                className="relative flex flex-col items-center cursor-pointer group"
                onClick={() => onCompanySelect?.(company)}
                whileHover={{ scale: 1.05 }}
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Price Label */}
                <motion.div
                  className="absolute -top-8 bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={{ y: 10 }}
                  whileHover={{ y: 0 }}
                >
                  ${company.currentPrice.toFixed(2)}
                </motion.div>

                {/* Bar */}
                <motion.div
                  className={`w-12 ${getBarColor(company)} rounded-t-lg relative overflow-hidden`}
                  style={{ height: `${barHeight}px` }}
                  initial={{ height: 0 }}
                  animate={{ height: `${barHeight}px` }}
                  transition={{ delay: index * 0.1, duration: 0.8 }}
                >
                  {/* Price on bar */}
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold">
                    {Math.round(company.currentPrice)}
                  </div>
                  
                  {/* Company icon */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-lg">
                    {getSectorIcon(company.sector)}
                  </div>
                </motion.div>

                {/* Base info */}
                <div className="mt-2 text-center">
                  <div className="text-xs text-white font-semibold">{company.symbol}</div>
                  <div className="text-xs text-slate-400">
                    {company.availableStocks !== undefined
                      ? `${company.availableStocks.toLocaleString('es-EC')} disponibles`
                      : 'N/D'}
                  </div>
                  <div className={`text-xs font-bold ${
                    change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex justify-center space-x-4 text-xs text-slate-400">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>+10%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>0-5%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>-5%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>-10%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
