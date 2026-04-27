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
    // Identificação
    brand: car.brand || '',
    model: car.model || '',
    year: car.year || new Date().getFullYear(),
    license_plate: car.license_plate || '',
    color: car.color || '',
    renavam: car.renavam || '',
    
    // Status
    status: car.status || 'Disponível',
    
    // Financeiro (Compra) - All monetary formatted
    purchase_price: formatInitialCurrency(car.purchase_price),
    payment_method: car.payment_method || 'A vista',
    purchase_date: car.purchase_date ? new Date(car.purchase_date).toISOString().split('T')[0] : '',
    financed_down_payment: formatInitialCurrency(car.financed_down_payment),
    financed_installments: car.financed_installments || '',
    financed_installment_value: formatInitialCurrency(car.financed_installment_value),
    financed_bank: car.financed_bank || '',
    
    // Custos Fixos - All monetary formatted
    insurance_cost: formatInitialCurrency(car.insurance_cost),
    ipva_cost: formatInitialCurrency(car.ipva_cost),
    licensing_cost: formatInitialCurrency(car.licensing_cost),
    
    // Manutenção
    last_revision_date: car.last_revision_date ? new Date(car.last_revision_date).toISOString().split('T')[0] : '',
    current_km: car.current_km || '',
    next_revision_km: car.next_revision_km || '',
    km_per_liter: car.km_per_liter || '',
    
    // Observações
    notes: car.notes || ''
  })

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`editCarDraft_${car.id}`)
    if (saved) {
      try {
        setFormData(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse draft', e)
      }
    }
    setIsInitialized(true)
  }, [car.id])

  // Save to localStorage on change
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
      const payload = {
        brand: formData.brand,
        model: formData.model,
        year: parseInt(formData.year),
        license_plate: formData.license_plate.toUpperCase(),
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

      const { error: updError } = await supabase
        .from('cars')
        .update(payload)
        .eq('id', car.id)

      if (updError) throw updError

      // Se a quilometragem atual foi alterada, registrar no histórico
      const newKm = parseNumber(formData.current_km)
      if (newKm !== null && newKm !== car.current_km) {
        await supabase.from('km_logs').insert([{
          car_id: car.id,
          user_id: user.id, // we need useAuth for this, let's check if it exists in EditCarModal
          km: newKm,
          date: new Date().toISOString(),
          notes: 'Ajuste Manual (Edição do Veículo)'
        }])
      }

      localStorage.removeItem(`editCarDraft_${car.id}`)
      onSuccess(formData.license_plate.toUpperCase())
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
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-bg-main">
          <h2 className="text-xl font-black text-main flex items-center gap-2">
            Editar Veículo Completo
          </h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-bg-card">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg mb-6 text-sm font-medium border border-danger/20">{error}</div>}

          <form id="editCarForm" onSubmit={handleSubmit} className="space-y-10">
            
            {/* 1. IDENTIFICAÇÃO */}
            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-accent border-b border-border-color pb-2">
                <Car className="w-5 h-5" /> Identificação e Básico
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Marca *</label>
                  <input required name="brand" value={formData.brand} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Modelo *</label>
                  <input required name="model" value={formData.model} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Ano *</label>
                  <input required type="number" name="year" value={formData.year} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Placa *</label>
                  <input required name="license_plate" value={formData.license_plate} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium uppercase" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Cor</label>
                  <input name="color" value={formData.color} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Renavam</label>
                  <input name="renavam" value={formData.renavam} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
              </div>
            </section>

            {/* 2. ALUGUEL E STATUS */}
            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary border-b border-border-color pb-2">
                <FileText className="w-5 h-5" /> Status e Locação
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Status *</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium appearance-none dark:[color-scheme:dark]">
                    <option value="Disponível" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Disponível</option>
                    <option value="Alugado" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Alugado</option>
                    <option value="Manutenção" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Manutenção</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 3. FINANCEIRO DA COMPRA */}
            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-success border-b border-border-color pb-2">
                <CurrencyDollar className="w-5 h-5" /> Financeiro da Compra
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Valor de Compra (R$) *</label>
                  <input required type="text" inputMode="numeric" name="purchase_price" value={formData.purchase_price} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Data da Compra</label>
                  <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Forma de Pagamento *</label>
                  <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none font-medium dark:[color-scheme:dark]">
                    <option value="A vista" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>À vista</option>
                    <option value="Financiado" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Financiado</option>
                    <option value="Consórcio" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Consórcio</option>
                  </select>
                </div>

                {(formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Valor da Entrada (R$)</label>
                      <input type="text" inputMode="numeric" name="financed_down_payment" value={formData.financed_down_payment} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="0,00" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Nº de Parcelas</label>
                      <input type="number" name="financed_installments" value={formData.financed_installments} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Valor da Parcela (R$)</label>
                      <input type="text" inputMode="numeric" name="financed_installment_value" value={formData.financed_installment_value} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="0,00" />
                    </div>
                    <div className="space-y-2 sm:col-span-2 md:col-span-3">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Banco / Instituição</label>
                      <input name="financed_bank" value={formData.financed_bank} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* 4. CUSTOS FIXOS */}
            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-danger border-b border-border-color pb-2">
                <CurrencyDollar className="w-5 h-5" /> Custos Anuais
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Seguro (R$)</label>
                  <input type="text" inputMode="numeric" name="insurance_cost" value={formData.insurance_cost} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">IPVA (R$)</label>
                  <input type="text" inputMode="numeric" name="ipva_cost" value={formData.ipva_cost} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Licenciamento (R$)</label>
                  <input type="text" inputMode="numeric" name="licensing_cost" value={formData.licensing_cost} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" placeholder="0,00" />
                </div>
              </div>
            </section>

            {/* 5. MANUTENÇÃO */}
            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-warning border-b border-border-color pb-2">
                <Wrench className="w-5 h-5" /> Manutenção e Dados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">KM Atual</label>
                  <input type="number" name="current_km" value={formData.current_km} onChange={handleChange} max="9999999" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Próxima Rev. (KM)</label>
                  <input type="number" name="next_revision_km" value={formData.next_revision_km} onChange={handleChange} max="9999999" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Última Revisão</label>
                  <input type="date" name="last_revision_date" value={formData.last_revision_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Consumo (KM/L)</label>
                  <input type="number" step="0.1" name="km_per_liter" value={formData.km_per_liter} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
                </div>
              </div>
            </section>

            {/* 6. OBSERVAÇÕES */}
            <section>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-muted-olive border-b border-border-color pb-2">
                <FileText className="w-5 h-5" /> Observações
              </h3>
              <div className="space-y-2">
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" placeholder="Adicione detalhes, histórico ou qualquer informação relevante..." className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-main focus:ring-2 focus:ring-accent outline-none resize-none font-medium"></textarea>
              </div>
            </section>

          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-bg-main flex justify-end gap-3 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 rounded-xl text-muted-olive hover:bg-bg-card transition-colors font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="editCarForm" disabled={loading} className="bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-xl font-black text-sm transition-all flex items-center shadow-xl shadow-primary/20">
            {loading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <><FloppyDisk className="w-4 h-4 mr-2" /> Salvar Tudo</>}
          </button>
        </div>
      </div>
    </div>
  )
}
