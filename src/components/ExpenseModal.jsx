import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, Trash } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import ManageExpenseCategories from './ManageExpenseCategories'
import { PencilSimple } from '@phosphor-icons/react'

export default function ExpenseModal({ car, expense, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showManage, setShowManage] = useState(false)

  const [formData, setFormData] = useState({
    expense_type: expense?.expense_type || 'Manutenção',
    custom_type: '',
    amount: expense ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(expense.amount) : '',
    expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
    description: expense?.description || '',
    oil_change_km: '',
    payment_type: 'A vista',
    installments_count: 1,
    payment_day: new Date().getDate()
  })

  const [categories, setCategories] = useState([])

  const loadCategories = async () => {
    const hidden = JSON.parse(localStorage.getItem(`hiddenExpenseCategories_${user.id}`) || '[]')
    const defaultCats = ['Troca de óleo', 'Manutenção', 'Seguro', 'Alinhamento', 'Multas'].filter(c => !hidden.includes(c))
    
    const { data, error } = await supabase
      .from('expenses')
      .select('expense_type')
      .eq('user_id', user.id)
    
    if (!error && data) {
      const unique = [...new Set(data.map(item => item.expense_type))]
      const combined = [...new Set([...defaultCats, ...unique])]
      setCategories(combined.sort())
    } else {
      setCategories(defaultCats)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [user.id])

  useEffect(() => {
    if (expense) {
      // Tentar extrair KM da descrição se for troca de óleo
      let extractedKm = ''
      if (expense.expense_type === 'Troca de óleo' && expense.description) {
        const match = expense.description.match(/\[KM: (\d+)\]/)
        if (match) extractedKm = match[1]
      }

      setFormData({
        expense_type: expense.expense_type,
        custom_type: '',
        amount: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(expense.amount),
        expense_date: expense.expense_date,
        description: expense.description?.replace(/\[KM: \d+\]/, '').trim() || '',
        oil_change_km: extractedKm
      })
      setIsInitialized(true)
      return
    }
    const saved = localStorage.getItem(`expenseDraft_${car.id}`)
    if (saved) {
      try { setFormData(JSON.parse(saved)) } catch (e) { console.error(e) }
    }
    setIsInitialized(true)
  }, [car.id, expense])

  useEffect(() => {
    if (isInitialized && !expense) {
      localStorage.setItem(`expenseDraft_${car.id}`, JSON.stringify(formData))
    }
  }, [formData, car.id, isInitialized, expense])

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

      // Se for troca de óleo, anexar a KM na descrição se não estiver lá
      let finalDescription = formData.description
      if (formData.expense_type === 'Troca de óleo' && formData.oil_change_km) {
        const kmInfo = `[KM: ${formData.oil_change_km}]`
        if (!finalDescription?.includes(kmInfo)) {
          finalDescription = finalDescription ? `${finalDescription} ${kmInfo}` : kmInfo
        }
      }
      

      if (expense) {
        const { error: expError } = await supabase.from('expenses').update({
          expense_type: finalType,
          amount: parseMaskedValue(formData.amount),
          expense_date: formData.expense_date,
          description: finalDescription || null
        }).eq('id', expense.id)
        if (expError) throw expError
      } else {
        if (formData.payment_type === 'Parcelado') {
            const totalAmount = parseMaskedValue(formData.amount)
            const installments = parseInt(formData.installments_count)
            const installmentValue = totalAmount / installments
            const expensesToInsert = []
            
            const baseDate = new Date(formData.expense_date + 'T12:00:00')
            const currentMonth = baseDate.getMonth()
            const currentYear = baseDate.getFullYear()
            
            for (let i = 0; i < installments; i++) {
                const dueDate = new Date(currentYear, currentMonth + i, parseInt(formData.payment_day))
                
                const y = dueDate.getFullYear()
                const m = String(dueDate.getMonth() + 1).padStart(2, '0')
                const d = String(dueDate.getDate()).padStart(2, '0')
                const expenseDate = `${y}-${m}-${d}`

                let description = `${finalType}`
                if (finalDescription) description += ` - ${finalDescription}`
                description += ` (Parcela ${i + 1}/${installments})`

                expensesToInsert.push({
                  car_id: car.id,
                  expense_type: finalType,
                  amount: parseFloat(installmentValue.toFixed(2)),
                  due_date: expenseDate,
                  description: description,
                  status: 'Pendente'
                })
            }

            const calculatedTotal = expensesToInsert.reduce((acc, curr) => acc + curr.amount, 0)
            if (Math.abs(calculatedTotal - totalAmount) > 0.001) {
                const diff = totalAmount - calculatedTotal
                expensesToInsert[installments - 1].amount += parseFloat(diff.toFixed(2))
            }

            const { error: expError } = await supabase.from('scheduled_expenses').insert(expensesToInsert)
            if (expError) throw expError
        } else {
            const { error: expError } = await supabase.from('expenses').insert([{
              car_id: car.id,
              user_id: user.id,
              expense_type: finalType,
              amount: parseMaskedValue(formData.amount),
              expense_date: formData.expense_date,
              description: finalDescription || null
            }])
            if (expError) throw expError
        }
      }

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

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      const { error: delError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)
      
      if (delError) throw delError
      
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao excluir despesa.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-main">{expense ? 'Editar Despesa' : 'Lançar Despesa'}</h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          <form id="expenseForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Tipo de Despesa *</label>
                <button type="button" onClick={() => setShowManage(true)} className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity">
                  <PencilSimple className="w-3 h-3" /> Gerenciar Tipos
                </button>
              </div>
              <select name="expense_type" value={formData.expense_type} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer dark:[color-scheme:dark]">
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="Outros">Outros (Digitar Novo...)</option>
              </select>
            </div>

            {formData.expense_type === 'Troca de óleo' && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">KM Atual (Ref)</label>
                  <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-border-color rounded-xl px-4 py-2.5 text-muted-olive font-bold">
                    {car.current_km?.toLocaleString() || '0'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nova KM *</label>
                  <input required type="number" name="oil_change_km" value={formData.oil_change_km} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" placeholder="KM da troca" />
                </div>
              </div>
            )}

            {formData.expense_type === 'Outros' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Qual despesa? *</label>
                <input required type="text" name="custom_type" value={formData.custom_type} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor Total (R$) *</label>
              <input required type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" />
            </div>

            {!expense && (
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Forma de Pagamento *</label>
                    <select name="payment_type" value={formData.payment_type} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                        <option value="A vista">À vista</option>
                        <option value="Parcelado">Parcelado</option>
                    </select>
                </div>
            )}

            {!expense && formData.payment_type === 'Parcelado' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nº de Parcelas *</label>
                        <select name="installments_count" value={formData.installments_count} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                            {[...Array(12)].map((_, i) => (
                                <option key={i + 2} value={i + 2}>{i + 2}x</option>
                            ))}
                        </select>
                        {parseMaskedValue(formData.amount) > 0 && (
                            <p className="text-[10px] text-accent font-bold mt-1 ml-1">
                                R$ {(parseMaskedValue(formData.amount) / parseInt(formData.installments_count)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mês
                            </p>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Dia do Vencimento *</label>
                        <select name="payment_day" value={formData.payment_day} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                            {[...Array(31)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>Dia {i + 1}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data da Despesa (Contratação/Compra) *</label>
              <input required type="date" name="expense_date" value={formData.expense_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Observações (Opcional)</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-main focus:ring-2 focus:ring-accent outline-none resize-none font-medium" placeholder="Ex: Peças trocadas, oficina, etc..."></textarea>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row gap-3">
          {expense && !showDeleteConfirm && (
            <button 
              type="button" 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-3 rounded-xl text-danger hover:bg-danger/10 transition-colors flex items-center justify-center border border-transparent hover:border-danger/20"
              title="Excluir Despesa"
            >
              <Trash className="w-5 h-5" />
            </button>
          )}

          {showDeleteConfirm ? (
            <div className="flex-1 flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
              <span className="text-[10px] font-black uppercase text-danger mr-auto">Confirmar exclusão?</span>
              <button 
                type="button" 
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 rounded-lg text-muted-olive text-xs font-bold"
              >
                Não
              </button>
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-danger text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-danger/20 flex items-center gap-2"
              >
                {deleting ? <CircleNotch className="w-3 h-3 animate-spin" /> : 'Sim, Excluir'}
              </button>
            </div>
          ) : (
            <>
              <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl text-muted-olive hover:text-main font-bold text-sm">
                Cancelar
              </button>
              <button type="submit" form="expenseForm" disabled={loading} className="flex-1 py-3 px-4 rounded-xl bg-danger text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-danger/20">
                {loading ? <CircleNotch className="w-5 h-5 animate-spin" /> : <span>{expense ? 'Salvar Alterações' : 'Registrar Despesa'}</span>}
              </button>
            </>
          )}
        </div>
      </div>
      
      {showManage && (
        <ManageExpenseCategories 
          user={user} 
          onClose={() => setShowManage(false)} 
          onCategoriesUpdated={loadCategories} 
        />
      )}
    </div>
  )
}
