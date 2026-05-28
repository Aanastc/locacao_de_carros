import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch } from '@phosphor-icons/react'

export default function EditIncomeModal({ income, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const formatInitialCurrency = (val) => {
    if (val === null || val === undefined || val === '') return ''
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const [formData, setFormData] = useState({
    amount: formatInitialCurrency(income.amount),
    payment_date: income.payment_date,
    payment_method: income.payment_method,
    notes: income.notes || ''
  })

  useEffect(() => {
    const saved = localStorage.getItem(`editIncomeDraft_${income.id}`)
    if (saved) {
      try { setFormData(JSON.parse(saved)) } catch (e) { console.error(e) }
    }
    setIsInitialized(true)
  }, [income.id])

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(`editIncomeDraft_${income.id}`, JSON.stringify(formData))
    }
  }, [formData, income.id, isInitialized])

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
      const { error: updError } = await supabase
        .from('incomes')
        .update({
          amount: parseMaskedValue(formData.amount),
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
          notes: formData.notes || null
        })
        .eq('id', income.id)

      if (updError) throw updError
      localStorage.removeItem(`editIncomeDraft_${income.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao atualizar recebimento.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      const { error: delError } = await supabase
        .from('incomes')
        .delete()
        .eq('id', income.id)
      
      if (delError) throw delError
      
      localStorage.removeItem(`editIncomeDraft_${income.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao excluir recebimento.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-main flex items-center gap-2">
            Editar Recebimento
          </h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 bg-bg-card">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg mb-4 text-sm font-medium border border-danger/20">{error}</div>}

          <form id="editIncomeForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Valor (R$)</label>
              <input required type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Forma de Pagamento</label>
              <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none font-medium dark:[color-scheme:dark]">
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Transferência">Transferência Bancária</option>
                <option value="A combinar">A combinar</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Data</label>
              <input required type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-slate-50/50 dark:bg-slate-950/20 flex gap-3">
          <button 
            type="button" 
            onClick={handleDelete}
            disabled={deleting}
            className="flex-none py-3 px-4 rounded-xl text-danger hover:bg-danger/10 font-bold text-sm transition-colors disabled:opacity-50"
          >
            {deleting ? <CircleNotch className="w-5 h-5 animate-spin mx-auto" /> : 'Excluir'}
          </button>
          <div className="flex-1 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl bg-bg-main border border-border-color text-main hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm transition-all text-center">
              Cancelar
            </button>
            <button type="submit" form="editIncomeForm" disabled={loading} className="flex-1 py-3 px-4 rounded-xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20">
              {loading ? <CircleNotch className="w-5 h-5 animate-spin" /> : <span>Salvar</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
