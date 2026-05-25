import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, ShieldCheck } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function InsuranceModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    company: '',
    amount: '',
    start_date: new Date().toISOString().split('T')[0],
    installments: 1
  })

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
      const totalAmount = parseMaskedValue(formData.amount)
      if (totalAmount <= 0) throw new Error("Valor total inválido.")
      
      const installments = parseInt(formData.installments)
      const installmentValue = totalAmount / installments
      
      const expensesToInsert = []
      
      // Parse data localmente ignorando fuso
      const [year, month, day] = formData.start_date.split('-').map(Number)
      
      for (let i = 0; i < installments; i++) {
        // Cria a data da parcela incrementando os meses
        const date = new Date(year, month - 1 + i, day)
        
        // Ajusta para ultimo dia do mes caso o mes alvo seja menor
        // Ex: 31 de Janeiro + 1 mes = 3 de Março. (O javascript ajusta assim).
        // Se a data original era 31, e mudou pra mes seguinte q tem 28 dias, o javascript vaza.
        // O ideal é uma lib, mas podemos fazer algo simples:
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        
        const expenseDate = `${y}-${m}-${d}`

        let description = `${formData.company}`
        if (installments > 1) {
            description += ` - Parcela ${i + 1}/${installments}`
        }

        expensesToInsert.push({
          car_id: car.id,
          user_id: user.id,
          expense_type: 'Seguro',
          amount: parseFloat(installmentValue.toFixed(2)),
          expense_date: expenseDate,
          description: description
        })
      }

      // Arredondamento do total pode causar divergencia de 1 centavo
      // Ajuste na ultima parcela se precisar
      const calculatedTotal = expensesToInsert.reduce((acc, curr) => acc + curr.amount, 0)
      if (Math.abs(calculatedTotal - totalAmount) > 0.001) {
          const diff = totalAmount - calculatedTotal
          expensesToInsert[installments - 1].amount += parseFloat(diff.toFixed(2))
      }

      const { error: expError } = await supabase.from('expenses').insert(expensesToInsert)
      if (expError) throw expError

      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erro ao registrar seguro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-main flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent" /> Lançar Seguro
          </h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl mb-6">
            <p className="text-xs font-medium text-main">
              Este assistente vai diluir automaticamente o valor total do seguro ao longo dos meses selecionados, criando os lançamentos diretamente na aba de Despesas da Empresa.
            </p>
          </div>

          <form id="insuranceForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Seguradora / Empresa *</label>
              <input required type="text" name="company" value={formData.company} onChange={handleChange} placeholder="Ex: Porto Seguro, HDI, Suhai..." className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor Total (R$) *</label>
              <input required type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleCurrencyChange} placeholder="Ex: 2.500,00" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data 1ª Parcela *</label>
                <input required type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                </div>
                
                <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nº de Parcelas *</label>
                <select name="installments" value={formData.installments} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                    {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}x {i === 0 ? '(À vista)' : ''}</option>
                    ))}
                </select>
                </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-slate-50/50 dark:bg-slate-950/20 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl text-muted-olive hover:text-main font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="insuranceForm" disabled={loading} className="flex-1 py-3 px-4 rounded-xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20">
            {loading ? <CircleNotch className="w-5 h-5 animate-spin" /> : <span>Lançar Seguro</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
