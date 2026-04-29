import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function ExpenseModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const [formData, setFormData] = useState({
    expense_type: 'Manutenção',
    custom_type: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    oil_change_km: ''
  })

  const [categories, setCategories] = useState(['Troca de óleo', 'Manutenção', 'Seguro', 'Alinhamento', 'Multas'])

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('expense_type')
        .eq('user_id', user.id)
      
      if (!error && data) {
        const unique = [...new Set(data.map(item => item.expense_type))]
        setCategories(prev => {
          const combined = [...new Set([...prev, ...unique])]
          return combined.sort()
        })
      }
    }
    fetchCategories()
  }, [user.id])

  useEffect(() => {
    const saved = localStorage.getItem(`expenseDraft_${car.id}`)
    if (saved) {
      try { setFormData(JSON.parse(saved)) } catch (e) { console.error(e) }
    }
    setIsInitialized(true)
  }, [car.id])

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(`expenseDraft_${car.id}`, JSON.stringify(formData))
    }
  }, [formData, car.id, isInitialized])

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
      const finalType = formData.expense_type === 'Outros' && formData.custom_type.trim() !== '' 
        ? formData.custom_type.trim() 
        : formData.expense_type

      const { error: expError } = await supabase.from('expenses').insert([{
        car_id: car.id,
        user_id: user.id,
        expense_type: finalType,
        amount: parseMaskedValue(formData.amount),
        expense_date: formData.expense_date,
        description: formData.description || null
      }])

      if (expError) throw expError

      // Se for troca de óleo e informou nova KM, atualizar o carro e logar
      if (formData.expense_type === 'Troca de óleo' && formData.oil_change_km) {
        const newKm = parseInt(formData.oil_change_km)
        if (!isNaN(newKm)) {
          await supabase.from('cars').update({ current_km: newKm }).eq('id', car.id)
          await supabase.from('km_logs').insert([{
            car_id: car.id,
            user_id: user.id,
            km: newKm,
            date: new Date().toISOString(),
            notes: 'Registro via Troca de Óleo'
          }])
        }
      }

      localStorage.removeItem(`expenseDraft_${car.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao registrar despesa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Lançar Despesa</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          <form id="expenseForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Despesa *</label>
              <select name="expense_type" value={formData.expense_type} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer dark:[color-scheme:dark]">
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="Outros">Outros (Digitar Novo...)</option>
              </select>
            </div>

            {formData.expense_type === 'Troca de óleo' && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KM Atual (Ref)</label>
                  <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-500 font-bold">
                    {car.current_km?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova KM *</label>
                  <input required type="number" name="oil_change_km" value={formData.oil_change_km} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-bold" placeholder="KM da troca" />
                </div>
              </div>
            )}

            {formData.expense_type === 'Outros' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qual despesa? *</label>
                <input required type="text" name="custom_type" value={formData.custom_type} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$) *</label>
              <input required type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleCurrencyChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data da Despesa *</label>
              <input required type="date" name="expense_date" value={formData.expense_date} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações (Opcional)</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none resize-none font-medium" placeholder="Ex: Peças trocadas, oficina, etc..."></textarea>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="expenseForm" disabled={loading} className="flex-1 py-3 px-4 rounded-xl bg-danger text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-danger/20">
            {loading ? <CircleNotch className="w-5 h-5 animate-spin" /> : <span>Registrar Despesa</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
