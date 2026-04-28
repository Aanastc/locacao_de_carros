import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Car, CurrencyDollar, Wrench, FileText, ArrowRight, ArrowLeft, CircleNotch, CheckCircle } from '@phosphor-icons/react'

const STEPS = [
  { id: 1, name: 'Identificação', icon: Car },
  { id: 2, name: 'Financeiro', icon: CurrencyDollar },
  { id: 3, name: 'Manutenção', icon: Wrench },
]

const CAR_BRANDS = [
  "Acura", "Agrale", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Bugatti", "Buick", "BYD", 
  "Cadillac", "Caoa Chery", "Chery", "Chevrolet", "Chrysler", "Citroën", "Dacia", "Dodge", "Ferrari", 
  "Fiat", "Fisker", "Ford", "GMC", "Great Wall Motors (GWM)", "Haval", "Honda", "Hyundai", "Infiniti", 
  "JAC Motors", "Jaguar", "Jeep", "Kia", "Koenigsegg", "Lamborghini", "Lancia", "Land Rover", "Lexus", 
  "Lotus", "Lucid", "Maserati", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Opel", 
  "Pagani", "Peugeot", "Polestar", "Porsche", "RAM", "Renault", "Rimac", "Rolls-Royce", "Saab", 
  "Scion", "Seat", "Skoda", "Smart", "Subaru", "Suzuki", "Tesla", "Toyota", "Troller", "Vauxhall", 
  "Volkswagen", "Volvo"
].sort()

export default function AddCarForm({ onComplete }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingBrands, setExistingBrands] = useState([])

  const [formData, setFormData] = useState({
    // Identificação
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    license_plate: '',
    color: '',
    renavam: '',
    
    // Financeiro
    purchase_price: '',
    payment_method: 'A vista',
    purchase_date: '',
    financed_down_payment: '',
    financed_installments: '',
    financed_installment_value: '',
    financed_bank: '',
    
    // Aluguel (Set default or hidden)
    rental_value: '0',
    status: 'Disponível',
    
    // Custos Fixos (Set default or hidden)
    insurance_cost: '',
    ipva_cost: '',
    licensing_cost: '',
    
    // Manutenção
    last_revision_date: '',
    current_km: '',
    next_revision_km: '',
    km_per_liter: '',
    notes: ''
  })

  useEffect(() => {
    if (user) {
      fetchBrands()
    }
    // Load saved draft
    try {
      const savedDraft = localStorage.getItem('addCarDraft')
      if (savedDraft) {
        setFormData(JSON.parse(savedDraft))
      }
    } catch (e) {
      console.warn('Failed to read draft from localStorage', e)
    }
  }, [user])

  // Save draft on change
  useEffect(() => {
    try {
      localStorage.setItem('addCarDraft', JSON.stringify(formData))
    } catch (e) {
      console.warn('Failed to save draft to localStorage', e)
    }
  }, [formData])

  const fetchBrands = async () => {
    const { data } = await supabase.from('cars').select('brand').eq('owner_id', user.id)
    if (data) {
      const brands = [...new Set(data.map(c => c.brand))].sort()
      setExistingBrands(brands)
    }
  }

  const formatCurrency = (value) => {
    if (!value) return ''
    const cleanValue = value.replace(/\D/g, '')
    const options = { minimumFractionDigits: 2 }
    const result = new Intl.NumberFormat('pt-BR', options).format(
      parseFloat(cleanValue) / 100
    )
    return result
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    if (name.includes('price') || name.includes('value') || name.includes('payment')) {
      if (name === 'payment_method') {
        setFormData(prev => ({ ...prev, [name]: value }))
      } else {
        // Handle currency masking for specific fields if needed, 
        // but simple numeric for now as requested for purchase_price
        setFormData(prev => ({ ...prev, [name]: value }))
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handlePriceChange = (e) => {
    const { name, value } = e.target
    const formatted = formatCurrency(value)
    setFormData(prev => ({ ...prev, [name]: formatted }))
  }

  const parseCurrency = (formattedValue) => {
    if (!formattedValue) return 0
    return parseFloat(formattedValue.replace(/\./g, '').replace(',', '.'))
  }

  const handleNext = async () => {
    if (step === 1) {
      setLoading(true)
      setError('')
      const plateUpper = formData.license_plate.toUpperCase()
      
      try {
        const { data: existingPlate } = await supabase
          .from('cars')
          .select('id')
          .ilike('license_plate', plateUpper)
          .eq('owner_id', user.id)
          .maybeSingle()

        if (existingPlate) {
          setError(`Já existe um veículo com a placa ${plateUpper} cadastrado.`)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error("Erro ao validar placa:", err)
      } finally {
        setLoading(false)
      }
    }
    
    if (step < STEPS.length) setStep(step + 1)
  }

  const handlePrev = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        owner_id: user.id,
        brand: formData.brand,
        model: formData.model,
        year: formData.year,
        license_plate: formData.license_plate.toUpperCase(),
        color: formData.color || null,
        renavam: formData.renavam || null,
        
        purchase_price: parseCurrency(formData.purchase_price),
        payment_method: formData.payment_method,
        purchase_date: formData.purchase_date || null,
        
        financed_down_payment: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') && formData.financed_down_payment ? parseCurrency(formData.financed_down_payment) : null,
        financed_installments: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') && formData.financed_installments ? parseInt(formData.financed_installments) : null,
        financed_installment_value: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') && formData.financed_installment_value ? parseCurrency(formData.financed_installment_value) : null,
        financed_bank: (formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') ? formData.financed_bank : null,
        
        rental_value: parseFloat(formData.rental_value) || 0,
        status: formData.status,
        
        insurance_cost: formData.insurance_cost ? parseCurrency(formData.insurance_cost) : null,
        ipva_cost: formData.ipva_cost ? parseCurrency(formData.ipva_cost) : null,
        licensing_cost: formData.licensing_cost ? parseCurrency(formData.licensing_cost) : null,
        
        last_revision_date: formData.last_revision_date || null,
        current_km: formData.current_km ? parseInt(formData.current_km) : null,
        next_revision_km: formData.next_revision_km ? parseInt(formData.next_revision_km) : null,
        km_per_liter: formData.km_per_liter ? parseFloat(formData.km_per_liter) : null,
        notes: formData.notes || null,
      }

      const { data: newCarData, error: dbError } = await supabase.from('cars').insert([payload]).select()

      if (dbError) throw dbError
      
      // Criar registro de KM inicial
      if (newCarData && newCarData[0] && newCarData[0].current_km != null) {
        const { error: logError } = await supabase.from('km_logs').insert([{
          car_id: newCarData[0].id,
          user_id: user.id,
          km: newCarData[0].current_km,
          date: new Date().toISOString(),
          notes: 'Cadastro Inicial'
        }])
        
        if (logError) {
          console.error("Erro ao inserir km_log inicial (não bloqueante):", logError)
          // Não lançamos o erro aqui para permitir que o cadastro do carro finalize 
          // mesmo que o histórico inicial falhe por questões de RLS
        }
      }

      localStorage.removeItem('addCarDraft')
      onComplete()
    } catch (err) {
      console.error(err)
      setError('Ocorreu um erro ao salvar o carro. Verifique os campos e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-6 sm:p-10 border border-border-color w-full max-w-4xl mx-auto mt-8">
      
      {/* Cabeçalho do Wizard */}
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-black mb-6 text-main">Cadastrar Novo Veículo</h2>
        <div className="flex items-center justify-between relative px-2 sm:px-0">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-primary/10 rounded-full z-0"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-accent rounded-full z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          ></div>
          
          {STEPS.map((s, idx) => {
            const Icon = s.icon
            const isActive = step === s.id
            const isCompleted = step > s.id
            
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
                  step >= s.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-card border border-border-color text-muted-olive'
                }`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className={`text-[10px] mt-2 hidden md:block uppercase font-bold tracking-widest ${isActive ? 'text-accent' : 'text-muted-olive'}`}>
                  {s.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-xl text-sm mb-6 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={step === STEPS.length ? handleSubmit : (e) => { e.preventDefault(); handleNext() }}>
        <div className="min-h-[400px]">
          {/* ETAPA 1: Identificação */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Marca *</label>
                  <input 
                    type="text" 
                    name="brand" 
                    required 
                    list="brands-list"
                    value={formData.brand} 
                    onChange={handleChange} 
                    className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none transition-all" 
                    placeholder="Digite ou selecione" 
                  />
                  <datalist id="brands-list">
                    {[...new Set([...CAR_BRANDS, ...existingBrands])].sort().map(b => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Modelo *</label>
                  <input type="text" name="model" required value={formData.model} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="ex: Corolla" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Ano *</label>
                  <input type="text" name="year" required value={formData.year} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="Ex: 2024/2025" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Placa *</label>
                  <input type="text" name="license_plate" required value={formData.license_plate} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none uppercase" placeholder="ABC-1234" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Cor</label>
                  <input type="text" name="color" value={formData.color} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="Prata" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Renavam</label>
                  <input type="text" name="renavam" value={formData.renavam} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="00000000000" />
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 2: Financeiro */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Valor de Compra (R$) *</label>
                  <input 
                    type="text" 
                    name="purchase_price" 
                    required 
                    value={formData.purchase_price} 
                    onChange={handlePriceChange} 
                    className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" 
                    placeholder="0,00" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Data da Compra</label>
                  <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Forma de Pagamento *</label>
                  <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full bg-bg-card border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer dark:[color-scheme:dark]">
                    <option value="A vista" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>À vista</option>
                    <option value="Financiado" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Financiado</option>
                    <option value="Consórcio" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Consórcio</option>
                  </select>
                </div>
              </div>

              {(formData.payment_method === 'Financiado' || formData.payment_method === 'Consórcio') && (
                <div className="p-5 border border-accent/20 bg-accent/5 rounded-2xl space-y-6">
                  <h4 className="text-xs font-black text-accent uppercase tracking-widest">Detalhes do {formData.payment_method}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Entrada / Lance (R$)</label>
                      <input type="text" name="financed_down_payment" value={formData.financed_down_payment} onChange={handlePriceChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="0,00" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Número de Parcelas</label>
                      <input type="number" name="financed_installments" value={formData.financed_installments} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="48" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Valor da Parcela (R$)</label>
                      <input type="text" name="financed_installment_value" value={formData.financed_installment_value} onChange={handlePriceChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="0,00" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Banco / Admin</label>
                      <input type="text" name="financed_bank" value={formData.financed_bank} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="ex: Itaú" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3: Manutenção */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-6">
                <h4 className="text-xs font-black text-accent uppercase tracking-widest border-b border-border-color pb-2">Manutenção & Consumo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Data Última Revisão</label>
                    <input type="date" name="last_revision_date" value={formData.last_revision_date} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Km Atual *</label>
                    <input required type="number" name="current_km" value={formData.current_km} onChange={handleChange} max="9999999" className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="50000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Km Próxima Revisão</label>
                    <input type="number" name="next_revision_km" value={formData.next_revision_km} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="60000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Km por Litro (Consumo)</label>
                    <input type="number" step="0.1" name="km_per_liter" value={formData.km_per_liter} onChange={handleChange} className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-accent outline-none" placeholder="12.5" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-black text-accent uppercase tracking-widest border-b border-border-color pb-2">Observações Adicionais</h4>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-olive uppercase tracking-widest">Notas Estratégicas</label>
                  <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent outline-none resize-none" placeholder="Ex: Veículo recém envelopado..."></textarea>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controles de Navegação */}
        <div className="mt-8 flex items-center justify-between pt-6 border-t border-border-color">
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 1 || loading}
            className={`flex items-center px-5 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-colors ${step === 1 ? 'opacity-0 cursor-default' : 'text-muted-olive hover:bg-primary/10 hover:text-primary'}`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span>Voltar</span>
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-6 py-2.5 bg-accent hover:opacity-90 text-white rounded-xl font-black transition-all disabled:opacity-70 shadow-xl shadow-accent/20 border border-accent/20"
          >
            {loading ? (
              <>
                <CircleNotch className="w-5 h-5 mr-2 animate-spin" />
                <span>{step === STEPS.length ? 'Salvando...' : 'Validando...'}</span>
              </>
            ) : step === STEPS.length ? (
              <>
                <span>Cadastrar Veículo</span>
                <CheckCircle className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                <span>Próxima Etapa</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
