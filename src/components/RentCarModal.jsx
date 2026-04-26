import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function RentCarModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    client_name: '',
    client_contact: '',
    client_document: '',
    client_license: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: '',
    rental_model: 'Por Dia',
    initial_km: car.current_km || '',
    total_price: '',
    security_deposit: '',
    payment_status: 'Pendente'
  })

  // Calculate suggested price
  useEffect(() => {
    if (formData.start_date && formData.expected_end_date && car.rental_value) {
      const start = new Date(formData.start_date)
      const end = new Date(formData.expected_end_date)
      if (end >= start) {
        const diffTime = Math.abs(end - start)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1 // minimum 1 day
        
        let multiplier = diffDays
        if (formData.rental_model === 'Por Semana') {
          multiplier = diffDays / 7
        } else if (formData.rental_model === 'Por Mês') {
          multiplier = diffDays / 30
        }

        const suggested = (car.rental_value * multiplier).toFixed(2)
        setFormData(prev => ({ ...prev, total_price: suggested }))
      }
    }
  }, [formData.start_date, formData.expected_end_date, formData.rental_model, car])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Insert Rental
      const { error: rentalError } = await supabase.from('rentals').insert([{
        car_id: car.id,
        user_id: user.id,
        client_name: formData.client_name,
        client_contact: formData.client_contact,
        client_document: formData.client_document,
        client_license: formData.client_license,
        start_date: formData.start_date,
        expected_end_date: formData.expected_end_date,
        rental_model: formData.rental_model,
        initial_km: parseInt(formData.initial_km),
        total_price: parseFloat(formData.total_price),
        security_deposit: formData.security_deposit ? parseFloat(formData.security_deposit) : null,
        payment_status: formData.payment_status,
        status: 'active'
      }])

      if (rentalError) throw rentalError

      // Update Car Status
      const { error: carError } = await supabase.from('cars')
        .update({ status: 'Alugado' })
        .eq('id', car.id)

      if (carError) throw carError

      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao registrar aluguel. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border-color rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color/50">
          <h2 className="text-xl font-black text-main">Registrar Aluguel</h2>
          <button onClick={onClose} className="text-muted-olive hover:text-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          <form id="rentForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-accent uppercase tracking-widest border-b border-accent/10 pb-2">Informações do Cliente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nome Completo *</label>
                  <input required type="text" name="client_name" value={formData.client_name} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="João Silva" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Contato *</label>
                  <input required type="text" name="client_contact" value={formData.client_contact} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Documento (CPF/CNPJ) *</label>
                  <input required type="text" name="client_document" value={formData.client_document} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="000.000.000-00" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-accent uppercase tracking-widest border-b border-accent/10 pb-2">Detalhes do Contrato</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data de Início *</label>
                  <input required type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data de Entrega *</label>
                  <input required type="date" name="expected_end_date" value={formData.expected_end_date} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">KM Inicial *</label>
                  <input required type="number" name="initial_km" value={formData.initial_km} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Modelo de Aluguel *</label>
                  <select name="rental_model" value={formData.rental_model} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                    <option value="Por Dia">Por Dia</option>
                    <option value="Por Semana">Por Semana</option>
                    <option value="Por Mês">Por Mês</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Caução (R$)</label>
                  <input type="number" step="0.01" name="security_deposit" value={formData.security_deposit} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor Total (R$) *</label>
                  <input required type="number" step="0.01" name="total_price" value={formData.total_price} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="rentForm" disabled={loading} className="bg-accent hover:bg-accent/80 text-white px-6 py-2 rounded-xl font-medium transition-colors flex items-center shadow-lg shadow-accent/20">
            {loading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : 'Confirmar Aluguel'}
          </button>
        </div>

      </div>
    </div>
  )
}
