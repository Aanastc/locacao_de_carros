import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function EditRentModal({ rental, car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Helper to format currency for initial state
  const formatInitialCurrency = (val) => {
    if (val === null || val === undefined || val === '') return ''
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatToLocalDatetime = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
  }

  const [formData, setFormData] = useState({
    client_name: rental.client_name || '',
    client_contact: rental.client_contact || '',
    client_document: rental.client_document || '',
    client_cnh: rental.client_cnh || '',
    start_date: formatToLocalDatetime(rental.start_date),
    expected_end_date: formatToLocalDatetime(rental.expected_end_date),
    rental_model: rental.rental_model || 'Por Dia',
    unit_price: '', // Not stored in DB, will only recalculate if user types something
    initial_km: rental.initial_km || '',
    total_price: formatInitialCurrency(rental.total_price),
    security_deposit: formatInitialCurrency(rental.security_deposit)
  })

  const [isInitialized, setIsInitialized] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`editRentDraft_${rental.id}`)
    if (saved) {
      try {
        setFormData(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse edit rent draft', e)
      }
    }
    setIsInitialized(true)
  }, [rental.id])

  // Save to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(`editRentDraft_${rental.id}`, JSON.stringify(formData))
    }
  }, [formData, rental.id, isInitialized])

  // Helper to parse masked string to float
  const parseMaskedValue = (val) => {
    if (!val) return 0
    return parseFloat(String(val).replace(/\./g, '').replace(',', '.'))
  }

  // Calculate price dynamically ONLY IF unit_price is provided (since we don't store it)
  useEffect(() => {
    if (formData.start_date && formData.expected_end_date && formData.unit_price) {
      const start = new Date(formData.start_date)
      const end = new Date(formData.expected_end_date)
      
      let diffMs = end - start
      if (diffMs < 0) diffMs = 0
      
      const diffHours = diffMs / (1000 * 60 * 60)
      const diffDays = Math.max(1, Math.ceil(diffHours / 24))
      
      let multiplier = diffDays
      if (formData.rental_model === 'Por Semana') {
        multiplier = Math.ceil(diffDays / 7)
      } else if (formData.rental_model === 'Por Mês') {
        multiplier = Math.ceil(diffDays / 30)
      }

      const unitValue = parseMaskedValue(formData.unit_price)
      if (!isNaN(unitValue) && unitValue > 0) {
        const calculated = unitValue * multiplier
        const formattedTotal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(calculated)
        setFormData(prev => ({ ...prev, total_price: formattedTotal }))
      }
    }
  }, [formData.start_date, formData.expected_end_date, formData.rental_model, formData.unit_price])

  const handleChange = (e) => {
    let { name, value } = e.target

    if (name === 'client_contact') {
      let v = value.replace(/\D/g, '')
      if (v.length <= 10) {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2')
        v = v.replace(/(\d{4})(\d)/, '$1-$2')
      } else {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2')
        v = v.replace(/(\d{5})(\d)/, '$1-$2')
      }
      value = v.substring(0, 15)
    }

    if (name === 'client_document') {
      let v = value.replace(/\D/g, '')
      if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2')
        v = v.replace(/(\d{3})(\d)/, '$1.$2')
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        value = v.substring(0, 14)
      } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2')
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2')
        v = v.replace(/(\d{4})(\d)/, '$1-$2')
        value = v.substring(0, 18)
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCurrencyChange = (e) => {
    const { name, value } = e.target
    const numericValue = value.replace(/\D/g, '')
    if (!numericValue) {
      setFormData(prev => ({ ...prev, [name]: '' }))
      return
    }
    const floatValue = parseFloat(numericValue) / 100
    const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(floatValue)
    setFormData(prev => ({ ...prev, [name]: formatted }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const startUtc = new Date(formData.start_date).toISOString()
      const endUtc = new Date(formData.expected_end_date).toISOString()

      const { error: rentalError } = await supabase.from('rentals')
        .update({
          client_name: formData.client_name,
          client_contact: formData.client_contact,
          client_document: formData.client_document,
          client_cnh: formData.client_cnh || null,
          start_date: startUtc,
          expected_end_date: endUtc,
          rental_model: formData.rental_model,
          initial_km: parseInt(formData.initial_km),
          total_price: parseMaskedValue(formData.total_price),
          security_deposit: formData.security_deposit ? parseMaskedValue(formData.security_deposit) : null
        })
        .eq('id', rental.id)

      if (rentalError) throw rentalError

      localStorage.removeItem(`editRentDraft_${rental.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao atualizar aluguel. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  const optionStyle = { color: '#0f172a', backgroundColor: '#ffffff' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-bg-main">
          <h2 className="text-xl font-black text-main">Editar Aluguel Ativo</h2>
          <button onClick={onClose} className="text-muted-olive hover:text-accent transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-6 text-sm font-medium">{error}</div>}

          <form id="editRentForm" onSubmit={handleSubmit} className="space-y-8">
            
            <div className="space-y-4">
              <h3 className="text-xs font-black text-accent uppercase tracking-widest border-b border-border-color pb-2">1. Cliente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nome Completo *</label>
                  <input required type="text" name="client_name" value={formData.client_name} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Contato *</label>
                  <input required type="text" name="client_contact" value={formData.client_contact} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Documento (CPF/CNPJ) *</label>
                  <input required type="text" name="client_document" value={formData.client_document} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nº da CNH</label>
                  <input type="text" name="client_cnh" value={formData.client_cnh} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border-color pb-2">2. Contrato e Valores</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Início (Data e Hora) *</label>
                  <input required type="datetime-local" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Devolução Prevista *</label>
                  <input required type="datetime-local" name="expected_end_date" value={formData.expected_end_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">KM Inicial *</label>
                  <input required type="number" name="initial_km" value={formData.initial_km} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Modelo de Aluguel *</label>
                  <select name="rental_model" value={formData.rental_model} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer dark:[color-scheme:dark]">
                    <option value="Por Dia" style={optionStyle}>Por Dia</option>
                    <option value="Por Semana" style={optionStyle}>Por Semana</option>
                    <option value="Por Mês" style={optionStyle}>Por Mês</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Atualizar Diária/Mês (Opcional) (R$)</label>
                  <input type="text" inputMode="numeric" name="unit_price" value={formData.unit_price} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="Digite para recalcular..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Caução (R$)</label>
                  <input type="text" inputMode="numeric" name="security_deposit" value={formData.security_deposit} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="0,00" />
                </div>

                <div className="sm:col-span-2 mt-4 p-5 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="w-full sm:w-1/2">
                    <p className="text-sm font-black text-main flex items-center gap-2">
                      Valor Total a Receber
                    </p>
                    <p className="text-xs text-main opacity-70 mt-1">
                      Você pode editar este valor manualmente se necessário.
                    </p>
                  </div>
                  <div className="w-full sm:w-1/2">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-main/50 pointer-events-none">R$</span>
                      <input required type="text" inputMode="numeric" name="total_price" value={formData.total_price} onChange={handleCurrencyChange} className="w-full bg-bg-main/50 border border-border-color rounded-xl py-3 pl-12 pr-4 text-xl font-black text-main outline-none text-right" placeholder="0,00" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-bg-main rounded-b-2xl flex justify-end gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 rounded-xl text-muted-olive hover:text-main font-bold transition-colors">
            Cancelar
          </button>
          <button type="submit" form="editRentForm" disabled={loading} className="bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-xl font-black text-sm transition-all flex items-center shadow-lg shadow-primary/20">
            {loading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : 'Salvar Alterações'}
          </button>
        </div>

      </div>
    </div>
  )
}
