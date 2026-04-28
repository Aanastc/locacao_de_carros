import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  X, CircleNotch, Paperclip, CheckCircle, 
  User, MapPin, Files, Users, FileText, 
  ArrowRight, ArrowLeft, CheckSquareOffset,
  Envelope, IdentificationCard, Phone, 
  Fingerprint, MapTrifold, Calendar,
  Speedometer, CurrencyDollar
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  { id: 1, name: 'Identificação', icon: User },
  { id: 2, name: 'Endereço', icon: MapPin },
  { id: 3, name: 'Documentação', icon: Files },
  { id: 4, name: 'Referências', icon: Users },
  { id: 5, name: 'Contrato', icon: FileText },
  { id: 6, name: 'Revisão', icon: CheckSquareOffset },
]

export default function RentCarModal({ car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState({
    uber_file: null,
    criminal_file: null,
    cnh_ear_file: null,
    residence_file: null,
    sne_file: null
  })

  // Get current datetime in YYYY-MM-DDTHH:MM format for the input
  const now = new Date()
  const localDatetime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)

  const [formData, setFormData] = useState({
    // 1. Identificação
    client_name: '',
    client_contact: '',
    client_document: '',
    client_cnh: '',
    client_email: '',
    
    // 2. Endereço
    client_cep: '',
    client_address: '',
    client_address_number: '',
    client_address_complement: '',
    client_neighborhood: '',
    client_city: '',
    client_state: '',

    // 4. Referências e Cônjuge
    personal_references: [{ name: '', phone: '' }],
    spouse_name: '',
    spouse_phone: '',
    spouse_cpf: '',

    // 5. Contrato
    start_date: localDatetime,
    expected_end_date: localDatetime,
    rental_model: 'Por Dia',
    unit_price: '',
    initial_km: car.current_km || '',
    total_price: '',
    security_deposit: '',
    payment_status: 'Pendente'
  })

  const [isInitialized, setIsInitialized] = useState(false)
  const [durationText, setDurationText] = useState('')

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`rentCarDraft_${car.id}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFormData(prev => ({
          ...prev,
          ...parsed,
          personal_references: Array.isArray(parsed.personal_references) 
            ? parsed.personal_references 
            : [{ name: '', phone: '' }]
        }))
      } catch (e) {
        console.error('Failed to parse rent draft', e)
      }
    }
    setIsInitialized(true)
  }, [car.id])

  // Save to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(`rentCarDraft_${car.id}`, JSON.stringify(formData))
    }
  }, [formData, car.id, isInitialized])

  const handleCEP = async (e) => {
    const cep = e.target.value.replace(/\D/g, '')
    setFormData(prev => ({ ...prev, client_cep: cep }))
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
        const data = await response.json()
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            client_address: data.logradouro,
            client_neighborhood: data.bairro,
            client_city: data.localidade,
            client_state: data.uf
          }))
        }
      } catch (err) {
        console.error('Error fetching CEP:', err)
      }
    }
  }

  const parseMaskedValue = (val) => {
    if (typeof val === 'number') return val
    if (!val) return 0
    return parseFloat(val.replace(/\./g, '').replace(',', '.'))
  }

  useEffect(() => {
    if (formData.start_date && formData.expected_end_date && formData.unit_price) {
      const start = new Date(formData.start_date)
      const end = new Date(formData.expected_end_date)
      
      let diffMs = end - start
      if (diffMs < 0) diffMs = 0
      
      const diffHours = diffMs / (1000 * 60 * 60)
      const diffDays = Math.max(1, Math.ceil(diffHours / 24))
      
      let multiplier = diffDays
      let text = `Duração: ${diffDays} dia${diffDays > 1 ? 's' : ''}`

      if (formData.rental_model === 'Por Semana') {
        multiplier = Math.ceil(diffDays / 7)
        text = `Duração: ${multiplier} semana${multiplier > 1 ? 's' : ''}`
      } else if (formData.rental_model === 'Por Mês') {
        multiplier = Math.ceil(diffDays / 30)
        text = `Duração: ${multiplier} mês${multiplier > 1 ? 'es' : ''}`
      }

      setDurationText(text)

      const unitValue = parseMaskedValue(formData.unit_price)
      if (!isNaN(unitValue)) {
        const calculated = unitValue * multiplier
        const formattedTotal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(calculated)
        setFormData(prev => ({ ...prev, total_price: formattedTotal }))
      }
    }
  }, [formData.start_date, formData.expected_end_date, formData.rental_model, formData.unit_price])

  const handleChange = (e) => {
    let { name, value, type, checked } = e.target

    if (name === 'client_contact' || name === 'spouse_phone') {
      let v = value.replace(/\D/g, '')
      if (v.length <= 10) {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2')
        v = v.replace(/(\d{4})(\d)/, '$1-$2')
      } else {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2')
        v = v.replace(/(\d{5})(\d)/, '$1-$2')
      }
      value = v.substring(0, 15)
    }

    if (name === 'client_document' || name === 'spouse_cpf') {
      let v = value.replace(/\D/g, '')
      if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2')
        v = v.replace(/(\d{3})(\d)/, '$1.$2')
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        value = v.substring(0, 14)
      } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2')
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2')
        v = v.replace(/(\d{4})(\d)/, '$1-$2')
        value = v.substring(0, 18)
      }
    }

    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleReferenceChange = (index, field, value) => {
    const newRefs = [...formData.personal_references]
    if (field === 'phone') {
      let v = value.replace(/\D/g, '')
      if (v.length <= 10) {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2')
        v = v.replace(/(\d{4})(\d)/, '$1-$2')
      } else {
        v = v.replace(/^(\d{2})(\d)/g, '($1) $2')
        v = v.replace(/(\d{5})(\d)/, '$1-$2')
      }
      value = v.substring(0, 15)
    }
    newRefs[index][field] = value
    setFormData(prev => ({ ...prev, personal_references: newRefs }))
  }

  const addReference = () => {
    setFormData(prev => ({
      ...prev,
      personal_references: [...prev.personal_references, { name: '', phone: '' }]
    }))
  }

  const removeReference = (index) => {
    if (formData.personal_references.length <= 1) return
    const newRefs = formData.personal_references.filter((_, i) => i !== index)
    setFormData(prev => ({ ...prev, personal_references: newRefs }))
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

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target
    if (selectedFiles && selectedFiles[0]) {
      setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }))
    }
  }

  const uploadFile = async (file, path) => {
    if (!file) return null
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${user.id}/${path}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('rentals')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('rentals')
      .getPublicUrl(filePath)

    return publicUrl
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step < STEPS.length) {
      setStep(step + 1)
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Upload All Files
      let urls = {
        uber: null,
        criminal: null,
        cnh_ear: null,
        residence: null,
        sne: null
      }

      try {
        if (files.uber_file) urls.uber = await uploadFile(files.uber_file, 'uber')
        if (files.criminal_file) urls.criminal = await uploadFile(files.criminal_file, 'criminal')
        if (files.cnh_ear_file) urls.cnh_ear = await uploadFile(files.cnh_ear_file, 'cnh_ear')
        if (files.residence_file) urls.residence = await uploadFile(files.residence_file, 'residence')
        if (files.sne_file) urls.sne = await uploadFile(files.sne_file, 'sne')
      } catch (uploadErr) {
        console.error('File upload error:', uploadErr)
        throw new Error('Erro ao fazer upload de um ou mais documentos.')
      }

      const startUtc = new Date(formData.start_date).toISOString()
      const endUtc = new Date(formData.expected_end_date).toISOString()

      // 2. Insert Rental
      const { error: rentalError } = await supabase.from('rentals').insert([{
        car_id: car.id,
        user_id: user.id,
        client_name: formData.client_name,
        client_contact: formData.client_contact,
        client_document: formData.client_document,
        client_cnh: formData.client_cnh || null,
        client_email: formData.client_email || null,
        
        client_cep: formData.client_cep,
        client_address: formData.client_address,
        client_address_number: formData.client_address_number,
        client_address_complement: formData.client_address_complement,
        client_neighborhood: formData.client_neighborhood,
        client_city: formData.client_city,
        client_state: formData.client_state,

        start_date: startUtc,
        expected_end_date: endUtc,
        rental_model: formData.rental_model,
        initial_km: parseInt(formData.initial_km),
        total_price: parseMaskedValue(formData.total_price),
        security_deposit: formData.security_deposit ? parseMaskedValue(formData.security_deposit) : null,
        payment_status: formData.payment_status,
        status: 'active',
        
        uber_file_url: urls.uber,
        criminal_record_file_url: urls.criminal,
        cnh_ear_file_url: urls.cnh_ear,
        residence_proof_file_url: urls.residence,
        sne_file_url: urls.sne,

        personal_references: formData.personal_references,
        spouse_name: formData.spouse_name || null,
        spouse_phone: formData.spouse_phone || null,
        spouse_cpf: formData.spouse_cpf || null
      }])

      if (rentalError) throw rentalError

      await supabase.from('cars').update({ status: 'Alugado' }).eq('id', car.id)

      localStorage.removeItem(`rentCarDraft_${car.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao registrar aluguel. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  const optionStyle = { color: '#0f172a', backgroundColor: '#ffffff' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Registrar Aluguel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-accent transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Wizard Header */}
        <div className="bg-slate-50/30 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between w-full">
            {STEPS.map((s, idx) => {
              const Icon = s.icon
              const isActive = step === s.id
              const isCompleted = step > s.id
              
              return (
                <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative">
                  {idx !== 0 && (
                    <div className={`absolute -left-1/2 top-4 w-full h-[2px] -translate-y-1/2 z-0 ${step > idx ? 'bg-accent' : 'bg-border-color'}`}></div>
                  )}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center z-10 transition-all ${
                    isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 
                    isCompleted ? 'bg-accent/20 text-accent' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle weight="fill" className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isActive ? 'text-accent' : 'text-slate-400'}`}>
                    {s.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-6 text-sm font-medium">{error}</div>}

          <form id="rentForm" onSubmit={handleSubmit} className="space-y-6">
            
            {/* ETAPA 1: Identificação */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 text-accent">
                  <User className="w-5 h-5" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Identificação do Locatário</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nome Completo *</label>
                    <input required type="text" name="client_name" value={formData.client_name} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="João Silva" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">E-mail *</label>
                    <input required type="email" name="client_email" value={formData.client_email} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="email@exemplo.com" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Contato/WhatsApp *</label>
                    <input required type="text" name="client_contact" value={formData.client_contact} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">CPF/CNPJ *</label>
                    <input required type="text" name="client_document" value={formData.client_document} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nº da CNH *</label>
                    <input required type="text" name="client_cnh" value={formData.client_cnh} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="Número da Carteira" />
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 2: Endereço */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 text-primary">
                  <MapPin className="w-5 h-5" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Endereço Residencial</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">CEP *</label>
                    <input required type="text" name="client_cep" value={formData.client_cep} onChange={handleCEP} maxLength="8" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="00000000" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Rua/Logradouro *</label>
                    <input required type="text" name="client_address" value={formData.client_address} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="Av. Paulista" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Número *</label>
                    <input required type="text" name="client_address_number" value={formData.client_address_number} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="123" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Complemento</label>
                    <input type="text" name="client_address_complement" value={formData.client_address_complement} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="Apto 10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Bairro *</label>
                    <input required type="text" name="client_neighborhood" value={formData.client_neighborhood} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="Centro" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Cidade *</label>
                    <input required type="text" name="client_city" value={formData.client_city} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="São Paulo" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">UF *</label>
                    <input required type="text" name="client_state" value={formData.client_state} onChange={handleChange} maxLength="2" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" placeholder="SP" />
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 3: Documentação (TUDO ANEXO AGORA) */}
            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 text-warning">
                  <Files className="w-5 h-5" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Documentação (Opcional)</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 pr-2">
                  
                  {/* File Upload Component Helper */}
                  {[
                    { id: 'uber_file', label: 'Print Conta Uber', file: files.uber_file },
                    { id: 'criminal_file', label: 'Ficha Criminal', file: files.criminal_file },
                    { id: 'cnh_ear_file', label: 'CNH com EAR', file: files.cnh_ear_file },
                    { id: 'residence_file', label: 'Comprovante de Residência', file: files.residence_file },
                    { id: 'sne_file', label: 'SNE Digital', file: files.sne_file },
                  ].map(f => (
                    <div key={f.id} className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">{f.label}</label>
                      <input type="file" name={f.id} onChange={handleFileChange} accept="image/*,.pdf" className="hidden" id={f.id} />
                      <label htmlFor={f.id} className={`flex items-center justify-between p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${f.file ? 'border-accent bg-accent/5' : 'border-border-color hover:border-accent/50'}`}>
                        <div className="flex items-center gap-3">
                          <Paperclip className={`w-5 h-5 ${f.file ? 'text-accent' : 'text-muted-olive'}`} />
                          <span className="text-xs font-bold truncate max-w-[250px]">{f.file ? f.file.name : `Anexar ${f.label}`}</span>
                        </div>
                        {f.file && <CheckCircle weight="fill" className="text-accent w-5 h-5" />}
                      </label>
                    </div>
                  ))}

                </div>
              </div>
            )}

            {/* ETAPA 4: Referências e Cônjuge */}
            {step === 4 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 text-danger">
                  <Users className="w-5 h-5" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Família e Referências</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-border-color pb-2">
                    <h4 className="text-[10px] font-black text-muted-olive uppercase tracking-widest">Referências Pessoais</h4>
                    <button type="button" onClick={addReference} className="text-[10px] font-bold text-accent">+ Adicionar</button>
                  </div>
                  <div className="space-y-3 pr-2">
                    {formData.personal_references.map((ref, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" value={ref.name} onChange={(e) => handleReferenceChange(idx, 'name', e.target.value)} className="flex-1 bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="Nome" />
                        <input type="text" value={ref.phone} onChange={(e) => handleReferenceChange(idx, 'phone', e.target.value)} className="flex-1 bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="Telefone" />
                        {formData.personal_references.length > 1 && (
                          <button type="button" onClick={() => removeReference(idx)} className="text-danger p-1"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <h4 className="text-[10px] font-black text-muted-olive uppercase tracking-widest border-b border-border-color pb-2">Informações do Cônjuge (Opcional)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" name="spouse_name" value={formData.spouse_name} onChange={handleChange} className="bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="Nome" />
                    <input type="text" name="spouse_phone" value={formData.spouse_phone} onChange={handleChange} className="bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="Telefone" />
                    <input type="text" name="spouse_cpf" value={formData.spouse_cpf} onChange={handleChange} className="bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="CPF" />
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 5: Contrato e Valores */}
            {step === 5 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 text-primary">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Configurações do Contrato</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Início da Locação *</label>
                    <input required type="datetime-local" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Devolução Prevista *</label>
                    <input required type="datetime-local" name="expected_end_date" value={formData.expected_end_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">KM Inicial *</label>
                    <input required type="number" name="initial_km" value={formData.initial_km} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Modelo de Aluguel *</label>
                    <select name="rental_model" value={formData.rental_model} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none cursor-pointer dark:[color-scheme:dark]">
                      <option value="Por Dia" style={optionStyle}>Por Dia</option>
                      <option value="Por Semana" style={optionStyle}>Por Semana</option>
                      <option value="Por Mês" style={optionStyle}>Por Mês</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor Unitário (R$) *</label>
                    <input required type="text" name="unit_price" value={formData.unit_price} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" placeholder="0,00" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Caução (R$)</label>
                    <input type="text" name="security_deposit" value={formData.security_deposit} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" placeholder="0,00" />
                  </div>
                  <div className="sm:col-span-2 p-4 bg-primary/5 border border-primary/20 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">Total Estimado</p>
                      <p className="text-xs text-muted-olive mt-0.5">{durationText}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-main">R$ {formData.total_price || '0,00'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 6: Revisão */}
            {step === 6 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 text-accent">
                  <CheckSquareOffset className="w-5 h-5" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Revisão Completa do Contrato</h3>
                </div>
                
                <div className="space-y-4 pr-2">
                  
                  {/* 1. Locatário */}
                  <div className="bg-bg-main/50 p-4 rounded-2xl border border-border-color space-y-3">
                    <div className="flex items-center gap-2 text-accent">
                      <IdentificationCard className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">1. Dados do Locatário</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div><p className="text-muted-olive">Nome:</p><p className="font-bold text-main">{formData.client_name}</p></div>
                      <div><p className="text-muted-olive">CPF/CNPJ:</p><p className="font-bold text-main">{formData.client_document}</p></div>
                      <div><p className="text-muted-olive">WhatsApp:</p><p className="font-bold text-main">{formData.client_contact}</p></div>
                      <div><p className="text-muted-olive">E-mail:</p><p className="font-bold text-main">{formData.client_email}</p></div>
                      <div className="col-span-2"><p className="text-muted-olive">Nº CNH:</p><p className="font-bold text-main">{formData.client_cnh}</p></div>
                    </div>
                  </div>

                  {/* 2. Endereço */}
                  <div className="bg-bg-main/50 p-4 rounded-2xl border border-border-color space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <MapTrifold className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">2. Endereço de Residência</span>
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-main">
                        {formData.client_address}, {formData.client_address_number}
                        {formData.client_address_complement && ` - ${formData.client_address_complement}`}
                      </p>
                      <p className="text-muted-olive">
                        {formData.client_neighborhood} — {formData.client_city}/{formData.client_state}
                      </p>
                      <p className="text-muted-olive">CEP: {formData.client_cep}</p>
                    </div>
                  </div>

                  {/* 3. Documentação */}
                  <div className="bg-bg-main/50 p-4 rounded-2xl border border-border-color space-y-4">
                    <div className="flex items-center gap-2 text-warning">
                      <Files className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">3. Status da Documentação</span>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Enviados */}
                      {Object.values(files).some(f => f !== null) && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase text-accent tracking-widest ml-1">Enviados</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { val: files.uber_file, label: 'Conta Uber' },
                              { val: files.criminal_file, label: 'Ficha Criminal' },
                              { val: files.cnh_ear_file, label: 'CNH EAR' },
                              { val: files.residence_file, label: 'Compr. Residência' },
                              { val: files.sne_file, label: 'SNE Digital' },
                            ].map(doc => doc.val && (
                              <div key={doc.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold">
                                <CheckCircle weight="fill" className="w-3.5 h-3.5" />
                                {doc.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pendentes */}
                      {Object.values(files).some(f => f === null) && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase text-muted-olive tracking-widest ml-1">Pendentes (Enviar Depois)</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { val: files.uber_file, label: 'Conta Uber' },
                              { val: files.criminal_file, label: 'Ficha Criminal' },
                              { val: files.cnh_ear_file, label: 'CNH EAR' },
                              { val: files.residence_file, label: 'Compr. Residência' },
                              { val: files.sne_file, label: 'SNE Digital' },
                            ].map(doc => !doc.val && (
                              <div key={doc.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-card border border-border-color text-muted-olive text-[10px] font-bold opacity-60">
                                <X className="w-3.5 h-3.5" />
                                {doc.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Referências e Cônjuge */}
                  <div className="bg-bg-main/50 p-4 rounded-2xl border border-border-color space-y-3">
                    <div className="flex items-center gap-2 text-danger">
                      <Users className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">4. Referências e Família</span>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        {formData.personal_references.map((ref, i) => (
                          <div key={i} className="flex justify-between text-xs border-b border-border-color/50 pb-1 italic">
                            <span className="text-muted-olive">Ref {i+1}: {ref.name}</span>
                            <span className="font-bold text-main">{ref.phone}</span>
                          </div>
                        ))}
                      </div>
                      {(formData.spouse_name || formData.spouse_cpf) && (
                        <div className="pt-2 border-t border-border-color/50">
                          <p className="text-[9px] font-black uppercase text-muted-olive mb-1">Cônjuge</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <p className="text-muted-olive">Nome: <span className="text-main font-bold">{formData.spouse_name}</span></p>
                            <p className="text-muted-olive">CPF: <span className="text-main font-bold">{formData.spouse_cpf}</span></p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5. Contrato e Financeiro */}
                  <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Calendar className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">5. Contrato e Financeiro</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-3 text-xs">
                      <div>
                        <p className="text-muted-olive">Período:</p>
                        <p className="font-bold text-main">{new Date(formData.start_date).toLocaleDateString()} até {new Date(formData.expected_end_date).toLocaleDateString()}</p>
                        <p className="text-[10px] font-bold text-primary">{durationText}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-olive">Modelo:</p>
                        <p className="font-bold text-main">{formData.rental_model}</p>
                      </div>
                      <div>
                        <p className="text-muted-olive">Valor Unitário:</p>
                        <p className="font-bold text-main">R$ {formData.unit_price}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-olive">Caução:</p>
                        <p className="font-bold text-main">R$ {formData.security_deposit || '0,00'}</p>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-primary/20 flex justify-between items-center">
                        <p className="text-sm font-black text-primary uppercase">Total a Receber:</p>
                        <p className="text-xl font-black text-primary">R$ {formData.total_price}</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex justify-between gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
          <button 
            type="button" 
            onClick={step === 1 ? onClose : () => setStep(step - 1)} 
            disabled={loading} 
            className="flex items-center px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors"
          >
            {step === 1 ? 'Cancelar' : <><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</>}
          </button>
          
          <button 
            type="submit" 
            form="rentForm" 
            disabled={loading} 
            className={`px-8 py-2.5 rounded-xl font-black text-sm transition-all flex items-center shadow-lg ${
              step === STEPS.length ? 'bg-accent hover:opacity-90 shadow-accent/20' : 'bg-primary hover:opacity-90 shadow-primary/20'
            } text-white`}
          >
            {loading ? (
              <><CircleNotch className="w-4 h-4 mr-2 animate-spin" /><span>Processando...</span></>
            ) : step === STEPS.length ? (
              <><CheckSquareOffset className="w-5 h-5 mr-2" /> <span>Finalizar Aluguel</span></>
            ) : (
              <><span>Próxima Etapa</span> <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
