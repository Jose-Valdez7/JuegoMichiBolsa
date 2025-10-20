import { useState } from 'react'
import { api } from '../utils/api'

export default function Transactions() {
  const [companyId, setCompanyId] = useState(1)
  const [quantity, setQuantity] = useState(1)
  const [type, setType] = useState<'BUY'|'SELL'>('BUY')
  const [msg, setMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data } = await api.post('/game/transaction', { userId: 1, companyId, type, quantity })
    setMsg(`Transacción ${data.ok ? 'exitosa' : 'fallida'}: ${data.txId || ''}`)
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Transacciones</h1>
      <form onSubmit={submit} className="bg-slate-800 p-4 rounded space-y-3">
        <div>
          <label className="block text-sm">Empresa</label>
          <input type="number" value={companyId} onChange={(e)=>setCompanyId(+e.target.value)} className="w-full p-2 bg-slate-700 rounded" />
        </div>
        <div>
          <label className="block text-sm">Cantidad</label>
          <input type="number" value={quantity} onChange={(e)=>setQuantity(+e.target.value)} className="w-full p-2 bg-slate-700 rounded" />
        </div>
        <div className="flex gap-3 items-center">
          <label className="text-sm">Tipo</label>
          <select value={type} onChange={(e)=>setType(e.target.value as any)} className="p-2 bg-slate-700 rounded">
            <option value="BUY">Comprar</option>
            <option value="SELL">Vender</option>
          </select>
        </div>
        <button className="bg-success hover:bg-emerald-600 px-4 py-2 rounded">Enviar</button>
        {msg && <div className="text-sm">{msg}</div>}
      </form>
    </div>
  )
}
