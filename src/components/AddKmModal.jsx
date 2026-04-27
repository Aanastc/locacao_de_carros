import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, MapPin } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function AddKmModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Default to current local time
  const now = new Date()
  const localDatetime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)

  const [formData, setFormData] = useState({
    km: car.current_km || '',
    date: localDatetime,
    notes: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const kmNum = parseInt(formData.km)
      if (isNaN(kmNum) || kmNum < 0) {
        throw new Error('Quilometragem inválida.')
      }

      const dateUtc = new Date(formData.date).toISOString()

      // 1. Insert into km_logs
      const { error: logError } = await supabase.from('km_logs').insert([{
        car_id: car.id,
        user_id: user.id,
        km: kmNum,
        date: dateUtc,
        notes: formData.notes || null
      }])

      if (logError) throw logError

      // 2. Update car's current_km if this new km is higher
      if (kmNum > (car.current_km || 0)) {
        const { error: carError } = await supabase.from('cars')
          .update({ current_km: kmNum })
          .eq('id', car.id)
        
        if (carError) throw carError
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erro ao registrar quilometragem. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color">
          <h2 className="text-xl font-black text-main flex items-center gap-2">
            <MapPin className="w-6 h-6 text-accent" />
            Lançar KM Avulso
          </h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm font-medium border border-danger/20">{error}</div>}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Quilometragem Registrada *</label>
            <input required type="number" name="km" value={formData.km} onChange={handleChange} min="0" max="9999999" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="Ex: 150000" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data e Hora *</label>
            <input required type="datetime-local" name="date" value={formData.date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Observações (Opcional)</label>
            <input type="text" name="notes" value={formData.notes} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="Ex: Medição após revisão" />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border-color mt-6">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-muted-olive hover:text-main font-bold text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="bg-accent hover:opacity-90 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-accent/20">
              {loading ? <><CircleNotch className="w-5 h-5 animate-spin" /><span>Salvando...</span></> : <span>Salvar Registro</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
