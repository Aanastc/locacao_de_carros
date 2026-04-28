import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, FloppyDisk, Car, CurrencyDollar, Wrench, FileText } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function EditCarModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const formatInitialCurrency = (val) => {
    if (val === null || val === undefined || val === '') return ''
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const [formData, setFormData] = useState({
    brand: car.brand || '',
    model: car.model || '',
    year: car.year || new Date().getFullYear(),
    license_plate: car.license_plate || '',
    color: car.color || '',
    renavam: car.renavam || '',
    status: car.status || 'Disponível',
    purchase_price: formatInitialCurrency(car.purchase_price),
    payment_method: car.payment_method || 'A vista',
    purchase_date: car.purchase_date ? new Date(car.purchase_date).toISOString().split('T')[0] : '',
    financed_down_payment: formatInitialCurrency(car.financed_down_payment),
    financed_installments: car.financed_installments || '',
    financed_installment_value: formatInitialCurrency(car.financed_installment_value),
    financed_bank: car.financed_bank || '',
    insurance_cost: formatInitialCurrency(car.insurance_cost),
    ipva_cost: formatInitialCurrency(car.ipva_cost),
    licensing_cost: formatInitialCurrency(car.licensing_cost),
    last_revision_date: car.last_revision_date ? new Date(car.last_revision_date).toISOString().split('T')[0] : '',
    current_km: car.current_km || '',
    next_revision_km: car.next_revision_km || '',
    km_per_liter: car.km_per_liter || '',
    notes: car.notes || ''
  })

  // Buscar a última KM real no km_logs ao montar
  useEffect(() => {
    const fetchLatestKm = async () => {
      try {
        const { data, error: kmError } = await supabase
          .from('km_logs')
          .select('km')
          .eq('car_id', car.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (data && data.km > (car.current_km || 0)) {
          setFormData(prev => ({ ...prev, current_km: data.km }))
        }
      } catch (e) {
        console.error('Erro ao buscar KM mais recente:', e)
      }
    }

    fetchLatestKm()
    
    const saved = localStorage.getItem(`editCarDraft_${car.id}`)
    if (saved) {
      try { setFormData(JSON.parse(saved)) } catch (e) { console.error(e) }
    }
    setIsInitialized(true)
  }, [car.id, car.current_km])

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(`editCarDraft_${car.id}`, JSON.stringify(formData))
    }
  }, [formData, car.id, isInitialized])

  const handleChange = (e) => {
    const { name, value } = e.target
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

  const parseNumber = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  }

  const parseMaskedValue = (val) => {
    if (!val) return null
    return parseFloat(val.replace(/\./g, '').replace(',', '.'))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const plateUpper = formData.license_plate.toUpperCase()
      const payload = {
        brand: formData.brand,
        model: formData.model,
        year: formData.year,
        license_plate: plateUpper,
        color: formData.color || null,
        renavam: formData.renavam || null,
        status: formData.status,
        purchase_price: parseMaskedValue(formData.purchase_price) || 0,
        payment_method: formData.payment_method,
        purchase_date: formData.purchase_date || null,
        financed_down_payment: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') ? parseMaskedValue(formData.financed_down_payment) : null,
        financed_installments: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') ? parseNumber(formData.financed_installments) : null,
        financed_installment_value: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') ? parseMaskedValue(formData.financed_installment_value) : null,
        financed_bank: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') ? formData.financed_bank : null,
        insurance_cost: parseMaskedValue(formData.insurance_cost),
        ipva_cost: parseMaskedValue(formData.ipva_cost),
        licensing_cost: parseMaskedValue(formData.licensing_cost),
        last_revision_date: formData.last_revision_date || null,
        current_km: parseNumber(formData.current_km),
        next_revision_km: parseNumber(formData.next_revision_km),
        km_per_liter: parseNumber(formData.km_per_liter),
        notes: formData.notes || null
      }

      const { error: updError } = await supabase.from('cars').update(payload).eq('id', car.id)
      if (updError) throw updError

      // Se a KM atual foi alterada manualmente aqui, também registrar no log
      const newKm = parseNumber(formData.current_km)
      if (newKm !== null && newKm !== car.current_km) {
        await supabase.from('km_logs').insert([{
          car_id: car.id,
          user_id: user.id,
          km: newKm,
          date: new Date().toISOString(),
          notes: 'Ajuste Manual via Edição de Veículo'
        }])
      }

      localStorage.removeItem(`editCarDraft_${car.id}`)
      onSuccess(plateUpper)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao atualizar informações do veículo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" />
            Editar Veículo Completo
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-main transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-white dark:bg-slate-900">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg mb-6 text-sm font-medium border border-danger/20">{error}</div>}

          <form id="editCarForm" onSubmit={handleSubmit} className="space-y-10">
            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-accent border-b border-slate-100 dark:border-slate-800 pb-2">
                <Car className="w-5 h-5" /> Identificação e Básico
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Marca *</label>
                  <input required name="brand" value={formData.brand} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Modelo *</label>
                  <input required name="model" value={formData.model} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Ano *</label>
                  <input required name="year" value={formData.year} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Placa *</label>
                  <input required name="license_plate" value={formData.license_plate} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium uppercase" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Cor</label>
                  <input name="color" value={formData.color} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Renavam</label>
                  <input name="renavam" value={formData.renavam} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-success border-b border-slate-100 dark:border-slate-800 pb-2">
                <CurrencyDollar className="w-5 h-5" /> Financeiro da Compra
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valor de Compra (R$) *</label>
                  <input required type="text" name="purchase_price" value={formData.purchase_price} onChange={handleCurrencyChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Forma de Pagamento *</label>
                  <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none appearance-none font-medium dark:[color-scheme:dark]">
                    <option value="A vista">À vista</option>
                    <option value="Financiado">Financiado</option>
                    <option value="Consórcio">Consórcio</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Data da Compra</label>
                  <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
                </div>

                {(formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valor da Entrada (R$)</label>
                      <input type="text" name="financed_down_payment" value={formData.financed_down_payment} onChange={handleCurrencyChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Parcelas</label>
                      <input type="number" name="financed_installments" value={formData.financed_installments} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valor Parcela (R$)</label>
                      <input type="text" name="financed_installment_value" value={formData.financed_installment_value} onChange={handleCurrencyChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                    </div>
                  </>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-warning border-b border-slate-100 dark:border-slate-800 pb-2">
                <Wrench className="w-5 h-5" /> Manutenção e Dados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">KM Atual</label>
                  <input type="number" name="current_km" value={formData.current_km} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Consumo (KM/L)</label>
                  <input type="number" step="0.1" name="km_per_liter" value={formData.km_per_liter} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status Geral</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none font-medium appearance-none dark:[color-scheme:dark]">
                    <option value="Disponível">Disponível</option>
                    <option value="Alugado">Alugado</option>
                    <option value="Manutenção">Manutenção</option>
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                <FileText className="w-5 h-5" /> Observações
              </h3>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none resize-none font-medium"></textarea>
            </section>

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex justify-end gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="editCarForm" disabled={loading} className="bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-xl font-black text-sm transition-all flex items-center shadow-xl shadow-primary/20">
            {loading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <><FloppyDisk className="w-4 h-4 mr-2" /><span>Salvar Tudo</span></>}
          </button>
        </div>
      </div>
    </div>
  )
}
