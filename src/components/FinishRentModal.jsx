import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, WarningCircle } from '@phosphor-icons/react'

export default function FinishRentModal({ rental, car, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const [formData, setFormData] = useState({
    actual_end_date: new Date().toISOString().split('T')[0],
    final_km: rental.initial_km || '',
    payment_status: rental.payment_status
  })

  useEffect(() => {
    const saved = localStorage.getItem(`finishRentDraft_${rental.id}`)
    if (saved) {
      try { setFormData(JSON.parse(saved)) } catch (e) { console.error(e) }
    }
    setIsInitialized(true)
  }, [rental.id])

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(`finishRentDraft_${rental.id}`, JSON.stringify(formData))
    }
  }, [formData, rental.id, isInitialized])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const finalKmNum = parseInt(formData.final_km)
    if (finalKmNum < rental.initial_km) {
      setError('A quilometragem final não pode ser menor que a inicial.')
      setLoading(false)
      return
    }

    try {
      const { error: rentalError } = await supabase.from('rentals')
        .update({
          actual_end_date: formData.actual_end_date,
          final_km: finalKmNum,
          payment_status: formData.payment_status,
          status: 'completed'
        })
        .eq('id', rental.id)

      if (rentalError) throw rentalError

      const { error: carError } = await supabase.from('cars')
        .update({ status: 'Disponível', current_km: finalKmNum })
        .eq('id', car.id)

      if (carError) throw carError

      localStorage.removeItem(`finishRentDraft_${rental.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao finalizar aluguel.')
    } finally {
      setLoading(false)
    }
  }

  const isEarlyReturn = rental.expected_end_date && formData.actual_end_date < rental.expected_end_date.split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Encerrar Aluguel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg mb-4 text-sm font-medium border border-danger/20">{error}</div>}

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cliente</p>
            <p className="text-slate-900 dark:text-white font-bold">{rental.client_name}</p>
            <div className="flex justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Km Inicial</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{rental.initial_km} km</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Acordado</p>
                <p className="text-sm font-bold text-primary">R$ {rental.total_price}</p>
              </div>
            </div>
          </div>

          <form id="finishForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Data Real de Devolução</label>
              <input required type="date" name="actual_end_date" value={formData.actual_end_date} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Km Final do Veículo</label>
              <input required type="number" name="final_km" value={formData.final_km} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
            </div>

            {isEarlyReturn && (
              <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                <WarningCircle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" weight="fill" />
                <div>
                  <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Devolução Antecipada</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                    O caução de <span className="font-bold">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rental.security_deposit || 0)}</span> ficou retido pela seguradora conforme cláusula contratual de quebra de período.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status do Pagamento</label>
              <select name="payment_status" value={formData.payment_status} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none appearance-none font-medium dark:[color-scheme:dark]">
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Parcial">Pago (Parcial)</option>
              </select>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="finishForm" disabled={loading} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center shadow-lg shadow-primary/20">
            {loading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <span>Finalizar e Liberar Veículo</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
