import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  X, CircleNotch, Paperclip, CheckCircle, 
  User, MapPin, Files, Users, FileText, 
  Phone, IdentificationCard, Envelope, MapTrifold, Camera
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function EditRentModal({ rental, car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState({
    uber_file: null,
    criminal_file: null,
    cnh_ear_file: null,
    residence_file: null,
    sne_file: null
  })

  // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatToLocalDatetime = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
  }

  const formatInitialCurrency = (val) => {
    if (val === null || val === undefined || val === '') return ''
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const [formData, setFormData] = useState({
    // Identificação
    client_name: rental.client_name || '',
    client_contact: rental.client_contact || '',
    client_document: rental.client_document || '',
    client_cnh: rental.client_cnh || '',
    client_email: rental.client_email || '',
    
    // Endereço
    client_cep: rental.client_cep || '',
    client_address: rental.client_address || '',
    client_address_number: rental.client_address_number || '',
    client_address_complement: rental.client_address_complement || '',
    client_neighborhood: rental.client_neighborhood || '',
    client_city: rental.client_city || '',
    client_state: rental.client_state || '',

    // Referências e Cônjuge
    personal_references: Array.isArray(rental.personal_references) 
      ? rental.personal_references 
      : [{ name: '', phone: '' }],
    spouse_name: rental.spouse_name || '',
    spouse_phone: rental.spouse_phone || '',
    spouse_cpf: rental.spouse_cpf || '',

    // Contrato
    start_date: formatToLocalDatetime(rental.start_date),
    expected_end_date: formatToLocalDatetime(rental.expected_end_date),
    rental_model: rental.rental_model || 'Por Dia',
    unit_price: '', 
    initial_km: rental.initial_km || '',
    total_price: formatInitialCurrency(rental.total_price),
    security_deposit: formatInitialCurrency(rental.security_deposit),
    start_inspection_notes: rental.start_inspection_notes || '',
    end_inspection_notes: rental.end_inspection_notes || ''
  })

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
    if (!val) return 0
    return parseFloat(String(val).replace(/\./g, '').replace(',', '.'))
  }

  const handleChange = (e) => {
    let { name, value } = e.target

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

    setFormData(prev => ({ ...prev, [name]: value }))
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
    setLoading(true)
    setError('')

    try {
      // 1. Upload New Files if any
      let urls = {
        uber: rental.uber_file_url,
        criminal: rental.criminal_record_file_url,
        cnh_ear: rental.cnh_ear_file_url,
        residence: rental.residence_proof_file_url,
        sne: rental.sne_file_url
      }

      if (files.uber_file) urls.uber = await uploadFile(files.uber_file, 'uber')
      if (files.criminal_file) urls.criminal = await uploadFile(files.criminal_file, 'criminal')
      if (files.cnh_ear_file) urls.cnh_ear = await uploadFile(files.cnh_ear_file, 'cnh_ear')
      if (files.residence_file) urls.residence = await uploadFile(files.residence_file, 'residence')
      if (files.sne_file) urls.sne = await uploadFile(files.sne_file, 'sne')

      const startUtc = new Date(formData.start_date).toISOString()
      const endUtc = new Date(formData.expected_end_date).toISOString()

      // 2. Update Rental
      const { error: rentalError } = await supabase.from('rentals')
        .update({
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
          
          uber_file_url: urls.uber,
          criminal_record_file_url: urls.criminal,
          cnh_ear_file_url: urls.cnh_ear,
          residence_proof_file_url: urls.residence,
          sne_file_url: urls.sne,

          personal_references: formData.personal_references,
          spouse_name: formData.spouse_name || null,
          spouse_phone: formData.spouse_phone || null,
          spouse_cpf: formData.spouse_cpf || null,
          start_inspection_notes: formData.start_inspection_notes || null,
          end_inspection_notes: formData.end_inspection_notes || null
        })
        .eq('id', rental.id)

      if (rentalError) throw rentalError

      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao atualizar aluguel. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  const optionStyle = { color: '#0f172a', backgroundColor: '#ffffff' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Editar Aluguel</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{car.brand} {car.model}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-accent transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-6 text-sm font-medium">{error}</div>}

          <form id="editRentForm" onSubmit={handleSubmit} className="space-y-8">
            
            {/* 1. Identificação */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent border-b border-border-color pb-2">
                <User className="w-5 h-5" />
                <h3 className="font-black uppercase text-xs tracking-widest">Identificação do Locatário</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nome Completo *</label>
                  <input required type="text" name="client_name" value={formData.client_name} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">E-mail *</label>
                  <input required type="email" name="client_email" value={formData.client_email} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Contato/WhatsApp *</label>
                  <input required type="text" name="client_contact" value={formData.client_contact} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">CPF/CNPJ *</label>
                  <input required type="text" name="client_document" value={formData.client_document} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Nº da CNH *</label>
                  <input required type="text" name="client_cnh" value={formData.client_cnh} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
              </div>
            </div>

            {/* 2. Endereço */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary border-b border-border-color pb-2">
                <MapPin className="w-5 h-5" />
                <h3 className="font-black uppercase text-xs tracking-widest">Endereço Residencial</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">CEP *</label>
                  <input required type="text" name="client_cep" value={formData.client_cep} onChange={handleCEP} maxLength="8" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Rua/Logradouro *</label>
                  <input required type="text" name="client_address" value={formData.client_address} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Número *</label>
                  <input required type="text" name="client_address_number" value={formData.client_address_number} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Complemento</label>
                  <input type="text" name="client_address_complement" value={formData.client_address_complement} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none" />
                </div>
              </div>
            </div>

            {/* 3. Documentação */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-warning border-b border-border-color pb-2">
                <Files className="w-5 h-5" />
                <h3 className="font-black uppercase text-xs tracking-widest">Documentação (Anexos)</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'uber_file', label: 'Print Conta Uber', existing: rental.uber_file_url, file: files.uber_file },
                  { id: 'criminal_file', label: 'Ficha Criminal', existing: rental.criminal_record_file_url, file: files.criminal_file },
                  { id: 'cnh_ear_file', label: 'CNH com EAR', existing: rental.cnh_ear_file_url, file: files.cnh_ear_file },
                  { id: 'residence_file', label: 'Comprovante de Residência', existing: rental.residence_proof_file_url, file: files.residence_file },
                  { id: 'sne_file', label: 'SNE Digital', existing: rental.sne_file_url, file: files.sne_file },
                ].map(f => (
                  <div key={f.id} className="space-y-1">
                    <input type="file" name={f.id} onChange={handleFileChange} accept="image/*,.pdf" className="hidden" id={f.id} />
                    <label htmlFor={f.id} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${f.file ? 'border-accent bg-accent/5' : 'border-border-color hover:border-accent/50'}`}>
                      <div className="flex items-center gap-3">
                        <Paperclip className={`w-4 h-4 ${f.file || f.existing ? 'text-accent' : 'text-muted-olive'}`} />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-muted-olive tracking-widest">{f.label}</span>
                          <span className="text-xs font-bold truncate max-w-[200px]">
                            {f.file ? f.file.name : f.existing ? 'Documento já enviado' : 'Clique para anexar'}
                          </span>
                        </div>
                      </div>
                      {(f.file || f.existing) && <CheckCircle weight="fill" className="text-accent w-5 h-5" />}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Referências e Família */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border-color pb-2">
                <div className="flex items-center gap-2 text-danger">
                  <Users className="w-5 h-5" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Família e Referências</h3>
                </div>
                <button type="button" onClick={addReference} className="text-[10px] font-black uppercase tracking-widest text-accent">+ Adicionar Referência</button>
              </div>
              
              <div className="space-y-3">
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

              <div className="pt-4 space-y-3">
                <h4 className="text-[10px] font-black text-muted-olive uppercase tracking-widest">Informações do Cônjuge</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" name="spouse_name" value={formData.spouse_name} onChange={handleChange} className="bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="Nome" />
                  <input type="text" name="spouse_phone" value={formData.spouse_phone} onChange={handleChange} className="bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="Telefone" />
                  <input type="text" name="spouse_cpf" value={formData.spouse_cpf} onChange={handleChange} className="bg-bg-main border border-border-color rounded-xl px-3 py-2 text-xs text-main" placeholder="CPF" />
                </div>
              </div>
            </div>

            {/* 5. Contrato */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary border-b border-border-color pb-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-black uppercase text-xs tracking-widest">Contrato e Valores</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Início *</label>
                  <input required type="datetime-local" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Devolução Prevista *</label>
                  <input required type="datetime-local" name="expected_end_date" value={formData.expected_end_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Total Atual (R$)</label>
                  <input required type="text" name="total_price" value={formData.total_price} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main font-black focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Caução (R$)</label>
                  <input type="text" name="security_deposit" value={formData.security_deposit} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main font-bold focus:ring-2 focus:ring-accent outline-none" />
                </div>
              </div>
            </div>

            {/* 6. Vistorias (Notas) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent border-b border-border-color pb-2">
                <Camera className="w-5 h-5" />
                <h3 className="font-black uppercase text-xs tracking-widest">Observações de Vistoria</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Vistoria Inicial (Notas)</label>
                  <textarea name="start_inspection_notes" value={formData.start_inspection_notes} onChange={handleChange} rows="2" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2 text-xs text-main focus:ring-2 focus:ring-accent outline-none resize-none" />
                </div>
                {rental.status === 'completed' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Vistoria Final (Notas)</label>
                    <textarea name="end_inspection_notes" value={formData.end_inspection_notes} onChange={handleChange} rows="2" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2 text-xs text-main focus:ring-2 focus:ring-accent outline-none resize-none" />
                  </div>
                )}
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 rounded-b-2xl flex justify-end gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
          <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-colors">
            Cancelar
          </button>
          <button type="submit" form="editRentForm" disabled={loading} className="bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-xl font-black text-sm transition-all flex items-center shadow-lg shadow-primary/20">
            {loading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <span>Salvar Alterações</span>}
          </button>
        </div>

      </div>
    </div>
  )
}
