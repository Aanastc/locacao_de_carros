import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function IncomeModal({ rental, initialData, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const formatInitialCurrency = (val) => {
    if (val === null || val === undefined || val === '') return ''
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const [formData, setFormData] = useState({
    amount: initialData?.amount ? formatInitialCurrency(initialData.amount) : '',
    payment_date: initialData?.date || new Date().toISOString().split('T')[0],
    payment_method: 'Pix',
    notes: initialData?.notes || ''
  })

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`incomeDraft_${rental.id}`)
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
      localStorage.setItem(`incomeDraft_${rental.id}`, JSON.stringify(formData))
    }
  }, [formData, rental.id, isInitialized])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
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

  const parseMaskedValue = (val) => {
    if (!val) return 0
    return parseFloat(val.replace(/\./g, '').replace(',', '.'))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error: incError } = await supabase.from('incomes').insert([{
        rental_id: rental.id,
        user_id: user.id,
        amount: parseMaskedValue(formData.amount),
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        notes: formData.notes || null
      }])

      if (incError) throw incError

      localStorage.removeItem(`incomeDraft_${rental.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao registrar recebimento. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color">
          <h2 className="text-xl font-black text-main flex items-center gap-2">
            Registrar Recebimento
          </h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg mb-4 text-sm font-medium border border-danger/20">{error}</div>}

          <form id="incomeForm" onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Valor Recebido (R$)</label>
              <input required type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="0,00" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Forma de Pagamento</label>
              <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none font-medium dark:[color-scheme:dark]">
                <option value="Pix" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Pix</option>
                <option value="Dinheiro" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Dinheiro</option>
                <option value="Cartão de Crédito" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Cartão de Crédito</option>
                <option value="Cartão de Débito" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Cartão de Débito</option>
                <option value="Transferência" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Transferência Bancária</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Data do Pagamento</label>
              <input required type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Observações</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-main focus:ring-2 focus:ring-accent outline-none resize-none font-medium" placeholder="Ex: R$ 50 de taxa da maquininha..."></textarea>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-bg-main/50 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-muted-olive hover:text-main font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="incomeForm" disabled={loading} className="bg-success text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center shadow-lg shadow-success/20 active:scale-95">
            {loading ? <><CircleNotch className="w-4 h-4 mr-2 animate-spin" /><span>Salvando...</span></> : <span>Confirmar Recebimento</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
