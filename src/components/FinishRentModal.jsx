import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch } from '@phosphor-icons/react'

export default function FinishRentModal({ rental, car, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const [formData, setFormData] = useState({
    actual_end_date: new Date().toISOString().split('T')[0],
    final_km: rental.initial_km || '',
    payment_status: rental.payment_status
  })

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`finishRentDraft_${rental.id}`)
    if (saved) {
      try {
        setFormData(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse draft', e)
      }
    }
    setIsInitialized(true)
  }, [rental.id])

  // Save to localStorage on change
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
      // Update Rental
      const { error: rentalError } = await supabase.from('rentals')
        .update({
          actual_end_date: formData.actual_end_date,
          final_km: finalKmNum,
          payment_status: formData.payment_status,
          status: 'completed'
        })
        .eq('id', rental.id)

      if (rentalError) throw rentalError

      // Update Car Status and KM
      const { error: carError } = await supabase.from('cars')
        .update({ 
          status: 'Disponível',
          current_km: finalKmNum
        })
        .eq('id', car.id)

      if (carError) throw carError

      localStorage.removeItem(`finishRentDraft_${rental.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao finalizar aluguel. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color">
          <h2 className="text-xl font-black text-main">Finalizar Aluguel</h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg mb-4 text-sm font-medium border border-danger/20">{error}</div>}

          <div className="bg-primary/5 border border-border-color rounded-2xl p-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-1">Cliente</p>
            <p className="text-main font-bold">{rental.client_name}</p>
            <div className="flex justify-between mt-3 pt-3 border-t border-border-color">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive">Km Inicial</p>
                <p className="text-sm font-bold text-main">{rental.initial_km} km</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive">Valor Acordado</p>
                <p className="text-sm font-bold text-primary">R$ {rental.total_price}</p>
              </div>
            </div>
          </div>

          <form id="finishForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Data Real de Devolução</label>
              <input required type="date" name="actual_end_date" value={formData.actual_end_date} onChange={handleChange} min={rental.start_date.split('T')[0]} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Km Final do Veículo</label>
              <input required type="number" name="final_km" value={formData.final_km} onChange={handleChange} max="9999999" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder={`Atual: ${car.current_km} km`} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Status do Pagamento</label>
              <select name="payment_status" value={formData.payment_status} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none font-medium">
                <option value="Pendente" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Pendente</option>
                <option value="Pago" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Pago</option>
                <option value="Parcial" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Pago (Parcial)</option>
              </select>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-bg-main/50 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-muted-olive hover:text-main font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="finishForm" disabled={loading} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center shadow-lg shadow-primary/20 active:scale-95">
            {loading ? <><CircleNotch className="w-4 h-4 mr-2 animate-spin" /><span>Finalizando...</span></> : <span>Finalizar e Liberar Veículo</span>}
          </button>
        </div>

      </div>
    </div>
  )
}
