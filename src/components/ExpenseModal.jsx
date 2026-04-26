import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function ExpenseModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    expense_type: 'Manutenção',
    custom_type: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: ''
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const finalType = formData.expense_type === 'Outros' && formData.custom_type.trim() !== '' 
        ? formData.custom_type.trim() 
        : formData.expense_type

      const { error: expError } = await supabase.from('expenses').insert([{
        car_id: car.id,
        user_id: user.id,
        expense_type: finalType,
        amount: parseFloat(formData.amount),
        expense_date: formData.expense_date,
        description: formData.description || null
      }])

      if (expError) throw expError

      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao registrar despesa. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color/50">
          <h2 className="text-xl font-black text-main">Lançar Despesa</h2>
          <button onClick={onClose} className="text-muted-olive hover:text-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          <form id="expenseForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Tipo de Despesa *</label>
              <select name="expense_type" value={formData.expense_type} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                <option value="Troca de óleo">Troca de óleo</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Seguro">Seguro</option>
                <option value="Alinhamento">Alinhamento</option>
                <option value="Multas">Multas</option>
                <option value="Outros">Outros (Digitar)</option>
              </select>
            </div>

            {formData.expense_type === 'Outros' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Qual despesa? *</label>
                <input required type="text" name="custom_type" value={formData.custom_type} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="Ex: Lavagem" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor (R$) *</label>
              <input required type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="150.00" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data da Despesa *</label>
              <input required type="date" name="expense_date" value={formData.expense_date} onChange={handleChange} className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Descrição (Opcional)</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows="2" className="w-full bg-primary/5 border border-border-color rounded-xl px-4 py-3 text-main focus:ring-2 focus:ring-accent outline-none resize-none" placeholder="Detalhes do custo..."></textarea>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color/50 flex gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-border-color text-muted-olive font-bold text-sm hover:bg-muted-olive/5 transition-all"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="expenseForm"
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl bg-danger text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-danger/20 disabled:opacity-50"
          >
            {loading ? <CircleNotch className="w-5 h-5 animate-spin" /> : 'Registrar Despesa'}
          </button>
        </div>
      </div>
    </div>
  )
}
