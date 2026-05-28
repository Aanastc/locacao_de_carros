import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, ShieldCheck } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function InsuranceModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    company_name: '',
    start_date: new Date().toISOString().split('T')[0],
    total_amount: '',
    payment_type: 'A vista',
    installments_count: 1,
    payment_day: new Date().getDate(),
    end_date: ''
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
      const totalAmount = parseMaskedValue(formData.total_amount)
      if (totalAmount <= 0) throw new Error("Valor total inválido.")
      if (!formData.end_date) throw new Error("Informe a validade do seguro.")
      
      const isInstallment = formData.payment_type === 'Parcelado'
      const installments = isInstallment ? parseInt(formData.installments_count) : 1
      
      // 1. Criar a Apólice (Insurance)
      const { data: insurance, error: insError } = await supabase.from('insurances').insert([{
        car_id: car.id,
        company_name: formData.company_name,
        total_amount: totalAmount,
        payment_type: formData.payment_type,
        installments_count: installments,
        payment_day: isInstallment ? parseInt(formData.payment_day) : null,
        start_date: formData.start_date,
        end_date: formData.end_date
      }]).select().single()

      if (insError) {
        if (insError.code === '42P01') throw new Error("A tabela 'insurances' não existe. Execute o script SQL gerado.")
        throw insError
      }

      // 2. Criar os Pagamentos Agendados
      const installmentValue = totalAmount / installments
      const expensesToInsert = []
      
      const baseDate = new Date(formData.start_date + 'T12:00:00')
      const currentMonth = baseDate.getMonth()
      const currentYear = baseDate.getFullYear()
      
      for (let i = 0; i < installments; i++) {
        let dueDate
        if (isInstallment) {
           dueDate = new Date(currentYear, currentMonth + i, parseInt(formData.payment_day))
        } else {
           dueDate = baseDate // À vista, vencimento na data de contratação
        }
        
        const y = dueDate.getFullYear()
        const m = String(dueDate.getMonth() + 1).padStart(2, '0')
        const d = String(dueDate.getDate()).padStart(2, '0')
        const expenseDate = `${y}-${m}-${d}`

        let description = `${formData.company_name}`
        if (installments > 1) {
            description += ` - Parcela ${i + 1}/${installments}`
        }

        expensesToInsert.push({
          car_id: car.id,
          insurance_id: insurance.id,
          expense_type: 'Seguro',
          amount: parseFloat(installmentValue.toFixed(2)),
          due_date: expenseDate,
          description: description,
          status: 'Pendente'
        })
      }

      // Ajustar diferença de centavos na última parcela
      const calculatedTotal = expensesToInsert.reduce((acc, curr) => acc + curr.amount, 0)
      if (Math.abs(calculatedTotal - totalAmount) > 0.001) {
          const diff = totalAmount - calculatedTotal
          expensesToInsert[installments - 1].amount += parseFloat(diff.toFixed(2))
      }

      const { error: expError } = await supabase.from('scheduled_expenses').insert(expensesToInsert)
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

          <form id="insuranceForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Seguradora / Empresa *</label>
              <input required type="text" name="company_name" list="insurance-companies" value={formData.company_name} onChange={handleChange} placeholder="Ex: Porto Seguro..." className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
              <datalist id="insurance-companies">
                 <option value="Porto Seguro" />
                 <option value="Suhai" />
                 <option value="Azul Seguros" />
                 <option value="HDI" />
                 <option value="Allianz" />
                 <option value="Tokio Marine" />
                 <option value="Mapfre" />
                 <option value="Bradesco Seguros" />
                 <option value="SulAmérica" />
                 <option value="Youse" />
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data da Contratação *</label>
                <input required type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Validade do Seguro *</label>
                <input required type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor Total (R$) *</label>
              <input required type="text" inputMode="numeric" name="total_amount" value={formData.total_amount} onChange={handleCurrencyChange} placeholder="Ex: 2.500,00" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Forma de Pagamento *</label>
                <select name="payment_type" value={formData.payment_type} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                    <option value="A vista">À vista</option>
                    <option value="Parcelado">Parcelado</option>
                </select>
            </div>

            {formData.payment_type === 'Parcelado' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nº de Parcelas *</label>
                        <select name="installments_count" value={formData.installments_count} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                            {[...Array(12)].map((_, i) => (
                                <option key={i + 2} value={i + 2}>{i + 2}x</option>
                            ))}
                        </select>
                        {parseMaskedValue(formData.total_amount) > 0 && formData.payment_type === 'Parcelado' && (
                            <p className="text-[10px] text-accent font-bold mt-1 ml-1">
                                R$ {(parseMaskedValue(formData.total_amount) / parseInt(formData.installments_count)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mês
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
