import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, WarningOctagon } from '@phosphor-icons/react'

export default function IncidentModal({ car, activeRental, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    incident_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    is_linked_to_rental: !!activeRental,
    payment_source: 'Caução',
    payment_date: new Date().toISOString().split('T')[0]
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
      const amount = parseMaskedValue(formData.amount)
      if (amount <= 0) throw new Error("Valor do sinistro deve ser maior que zero.")

      if (formData.is_linked_to_rental) {
        if (!activeRental) throw new Error("Não há contrato de aluguel ativo para vincular.");

        const { error: insError } = await supabase.from('rental_incidents').insert([{
          rental_id: activeRental.id,
          incident_date: formData.incident_date,
          description: formData.description,
          amount: amount
        }])

        if (insError) throw insError
      }

      const isPaidFromDeposit = formData.is_linked_to_rental && formData.payment_source === 'Caução'
      const isPaidByRenterExtra = formData.is_linked_to_rental && formData.payment_source === 'renter_extra'

      if (!isPaidFromDeposit) {
          if (isPaidByRenterExtra) {
              const isPastOrToday = new Date(`${formData.payment_date}T23:59:59`) <= new Date()
              let incomeId = null
              
              if (isPastOrToday) {
                  const { data: incData, error: incError } = await supabase.from('incomes').insert([{
                      car_id: car.id,
                      user_id: activeRental?.user_id || car.owner_id,
                      income_type: 'Reembolso Sinistro',
                      amount: amount,
                      payment_date: formData.payment_date,
                      notes: `Reembolso pago pelo locatário: ${formData.description}`,
                      rental_id: activeRental?.id,
                      payment_method: 'A combinar'
                  }]).select().single()
                  
                  if (incError) throw incError
                  incomeId = incData.id
              }
              
              const { error: schedError } = await supabase.from('scheduled_expenses').insert([{
                  car_id: car.id,
                  rental_id: activeRental?.id,
                  expense_type: 'Reembolso Sinistro',
                  description: formData.description,
                  amount: amount,
                  due_date: formData.payment_date,
                  status: isPastOrToday ? 'Pago' : 'Pendente'
              }])
              
              if (schedError) throw schedError
          } else {
              // Lógica de despesa (pago pelo owner)
              const isPastOrToday = new Date(`${formData.payment_date}T23:59:59`) <= new Date()
              let expenseId = null
              
              if (isPastOrToday) {
                  const { data: expData, error: expError } = await supabase.from('expenses').insert([{
                      car_id: car.id,
                      user_id: activeRental?.user_id || car.owner_id,
                      expense_type: 'Sinistro',
                      amount: amount,
                      expense_date: formData.payment_date,
                      description: formData.description
                  }]).select().single()
                  
                  if (expError) throw expError
                  expenseId = expData.id
              }
              
              const { error: schedError } = await supabase.from('scheduled_expenses').insert([{
                  car_id: car.id,
                  rental_id: formData.is_linked_to_rental ? activeRental?.id : null,
                  expense_type: 'Sinistro',
                  description: formData.description,
                  amount: amount,
                  due_date: formData.payment_date,
                  status: isPastOrToday ? 'Pago' : 'Pendente',
                  expense_id: expenseId
              }])
              
              if (schedError) throw schedError
          }
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erro ao registrar sinistro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-main flex items-center gap-2">
            <WarningOctagon className="w-6 h-6 text-danger" /> Registrar Sinistro
          </h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          {formData.is_linked_to_rental && formData.payment_source === 'Caução' ? (
             <div className="bg-danger/5 border border-danger/20 p-4 rounded-xl mb-6 transition-all">
               <p className="text-xs font-medium text-main">
                 O valor será deduzido do caução {activeRental ? `de R$ ${activeRental.security_deposit || '0,00'}` : ''} do contrato ativo. O incidente também ficará registrado no histórico do locatário.
               </p>
             </div>
          ) : formData.is_linked_to_rental && formData.payment_source === 'renter_extra' ? (
             <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl mb-6 transition-all">
               <p className="text-xs font-medium text-main">
                 O valor será lançado como uma <strong>Receita</strong> (Reembolso de Sinistro). O incidente ficará no histórico e no cronograma.
               </p>
             </div>
          ) : (
            <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl mb-6 transition-all">
               <p className="text-xs font-medium text-main">
                 O pagamento deste sinistro entrará no fluxo como uma <strong>Despesa</strong>. Se a data de pagamento for hoje ou passada, entrará em Gastos; se for futura, entrará no Cronograma.
               </p>
             </div>
          )}

          <form id="incidentForm" onSubmit={handleSubmit} className="space-y-4">
            {activeRental && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Vinculado ao Aluguel Ativo? *</label>
                  <select name="is_linked_to_rental" value={formData.is_linked_to_rental} onChange={(e) => setFormData({...formData, is_linked_to_rental: e.target.value === 'true'})} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                    <option value="true">Sim, aconteceu durante o contrato atual</option>
                    <option value="false">Não, não tem relação com o locatário</option>
                  </select>
                </div>
            )}

            {formData.is_linked_to_rental && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Como será pago? *</label>
                  <select name="payment_source" value={formData.payment_source} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer">
                    <option value="owner">Pago por mim (Lançar Despesa)</option>
                    <option value="Caução">Descontar do Caução do Contrato</option>
                    <option value="renter_extra">Pago pelo locatário à parte (Gerar Receita)</option>
                  </select>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data do Ocorrido *</label>
                <input required type="date" name="incident_date" value={formData.incident_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                </div>

                <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data de Pagamento *</label>
                <input required type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} disabled={formData.is_linked_to_rental && formData.payment_source === 'Caução'} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none disabled:opacity-50 disabled:cursor-not-allowed dark:[color-scheme:dark]" />
                </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Descrição (O que aconteceu) *</label>
              <input required type="text" name="description" value={formData.description} onChange={handleChange} placeholder="Ex: Batida no parachoque, Multa, Vidro trincado..." className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor do Prejuízo (R$) *</label>
              <input required type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleCurrencyChange} placeholder="Ex: 500,00" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-slate-50/50 dark:bg-slate-950/20 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl text-muted-olive hover:text-main font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="incidentForm" disabled={loading} className="flex-1 py-3 px-4 rounded-xl bg-danger text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-danger/20">
            {loading ? <CircleNotch className="w-5 h-5 animate-spin" /> : <span>Registrar</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
