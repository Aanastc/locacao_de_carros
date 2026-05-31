import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, WarningCircle, Camera, Plus, Trash } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function FinishRentModal({ rental, car, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [endInspectionFiles, setEndInspectionFiles] = useState([])
  
  const [financials, setFinancials] = useState({
    loaded: false,
    incomes: 0,
    incidents: 0,
    incidentsList: []
  })

  const [formData, setFormData] = useState({
    actual_end_date: new Date().toISOString().split('T')[0],
    final_km: rental.initial_km || '',
    payment_status: rental.payment_status,
    end_inspection_notes: ''
  })

  useEffect(() => {
    async function loadFinancials() {
      try {
        const [incRes, incdRes] = await Promise.all([
          supabase.from('incomes').select('amount').eq('rental_id', rental.id),
          supabase.from('rental_incidents').select('amount, description, incident_date').eq('rental_id', rental.id)
        ])
        
        const incomesTotal = (incRes.data || []).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        const incidentsTotal = (incdRes.data || []).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        
        setFinancials({
          loaded: true,
          incomes: incomesTotal,
          incidents: incidentsTotal,
          incidentsList: incdRes.data || []
        })
      } catch (err) {
        console.error("Erro ao carregar finanças do aluguel:", err)
      }
    }
    if (rental?.id) loadFinancials()
  }, [rental.id])

  useEffect(() => {
    const saved = localStorage.getItem(`finishRentDraft_${rental.id}`)
    if (saved) {
      try { setFormData(JSON.parse(saved)) } catch (e) { console.error(e) }
    }
    setIsInitialized(true)
  }, [rental.id])

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(`finishRentDraft_${rental.id}`, JSON.stringify(formData))
    }
  }, [formData, rental.id, isInitialized])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleInspectionFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length > 0) {
      setEndInspectionFiles(prev => [...prev, ...selectedFiles])
    }
  }

  const removeInspectionFile = (index) => {
    setEndInspectionFiles(prev => prev.filter((_, i) => i !== index))
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

    const finalKmNum = parseInt(formData.final_km)
    if (finalKmNum < rental.initial_km) {
      setError('A quilometragem final não pode ser menor que a inicial.')
      setLoading(false)
      return
    }

    try {
      let endInspectionUrls = []
      if (endInspectionFiles.length > 0) {
        const uploadPromises = endInspectionFiles.map(f => uploadFile(f, 'inspections/end'))
        endInspectionUrls = await Promise.all(uploadPromises)
      }

      const { error: rentalError } = await supabase.from('rentals')
        .update({
          actual_end_date: formData.actual_end_date,
          final_km: finalKmNum,
          payment_status: formData.payment_status,
          status: 'completed',
          end_inspection_urls: endInspectionUrls,
          end_inspection_notes: formData.end_inspection_notes || null
        })
        .eq('id', rental.id)

      if (rentalError) throw rentalError

      const { error: carError } = await supabase.from('cars')
        .update({ status: 'Disponível', current_km: finalKmNum })
        .eq('id', car.id)

      if (carError) throw carError

      localStorage.removeItem(`finishRentDraft_${rental.id}`)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao finalizar aluguel.')
    } finally {
      setLoading(false)
    }
  }

  const isEarlyReturn = rental.expected_end_date && formData.actual_end_date < rental.expected_end_date.split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-xl font-black text-main">Encerrar Aluguel</h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="bg-danger/10 text-danger p-3 rounded-lg mb-4 text-sm font-medium border border-danger/20">{error}</div>}

          <div className="bg-bg-main border border-border-color rounded-2xl p-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-1">Resumo do Contrato</p>
            <p className="text-main font-bold">{rental.client_name}</p>
            
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border-color">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive">Km Inicial</p>
                <p className="text-sm font-bold text-main">{rental.initial_km} km</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive">Valor Acordado</p>
                <p className="text-sm font-bold text-primary">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rental.total_price)}</p>
              </div>
            </div>
          </div>

          {financials.loaded && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-border-color rounded-2xl p-5 mb-6 shadow-inner">
              <h3 className="text-xs font-black uppercase tracking-widest text-main mb-4 flex items-center gap-2">
                Balanço Financeiro Final
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-olive font-medium">Garantia Retida (Caução):</span>
                  <span className="font-bold text-main">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rental.security_deposit || 0)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-olive font-medium">Total de Parcelas Recebidas:</span>
                  <span className="text-success font-bold">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(financials.incomes)}</span>
                </div>

                {rental.total_price - financials.incomes > 0 && (
                  <div className="flex justify-between text-sm bg-danger/5 p-2 rounded-lg -mx-2 px-2">
                    <span className="text-danger font-bold flex items-center gap-1">Falta Pagar do Aluguel:</span>
                    <span className="text-danger font-bold">- R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rental.total_price - financials.incomes)}</span>
                  </div>
                )}

                {financials.incidents > 0 && (
                  <div className="flex justify-between text-sm bg-orange-500/10 p-2 rounded-lg -mx-2 px-2 mt-1">
                    <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1">Sinistros / Prejuízos:</span>
                    <span className="text-orange-600 dark:text-orange-400 font-bold">- R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(financials.incidents)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base pt-4 border-t border-border-color mt-4">
                  <span className="text-main font-black uppercase tracking-wider text-xs flex items-center">Resultado do Caução</span>
                  {(() => {
                    const balance = (rental.security_deposit || 0) - (rental.total_price - financials.incomes) - financials.incidents;
                    if (balance > 0) {
                      return <span className="text-success font-black text-lg">Devolver R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(balance)}</span>
                    } else if (balance < 0) {
                      return <span className="text-danger font-black text-lg">Cobrar R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Math.abs(balance))}</span>
                    } else {
                      return <span className="text-muted-olive font-black text-lg">R$ 0,00</span>
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

          <form id="finishForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Data Real de Devolução</label>
              <input required type="date" name="actual_end_date" value={formData.actual_end_date} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium dark:[color-scheme:dark]" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Km Final do Veículo</label>
              <input required type="number" name="final_km" value={formData.final_km} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-medium" />
            </div>

            {isEarlyReturn && (
              <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                <WarningCircle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" weight="fill" />
                <div>
                  <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Devolução Antecipada</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                    O caução de <span className="font-bold">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rental.security_deposit || 0)}</span> ficou retido pela seguradora conforme cláusula contratual de quebra de período.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-olive">Status do Pagamento</label>
              <select name="payment_status" value={formData.payment_status} onChange={handleChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none appearance-none font-medium dark:[color-scheme:dark]">
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
              </select>
            </div>

            <div className="pt-4 border-t border-border-color space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <Camera className="w-5 h-5" />
                <h3 className="font-black uppercase text-xs tracking-widest">Vistoria Final</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Fotos da Vistoria (Múltiplas)</label>
                <input type="file" multiple accept="image/*" onChange={handleInspectionFileChange} className="hidden" id="end_inspection_files" />
                <label htmlFor="end_inspection_files" className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border-color rounded-2xl cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group">
                  <Plus className="w-6 h-6 text-muted-olive group-hover:text-accent mb-2" />
                  <span className="text-[10px] font-bold text-muted-olive group-hover:text-accent">Clique para adicionar fotos</span>
                </label>
              </div>

              {endInspectionFiles.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {endInspectionFiles.map((file, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border-color">
                      <img src={URL.createObjectURL(file)} alt={`Vistoria ${idx}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeInspectionFile(idx)} className="absolute top-1 right-1 bg-danger text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Observações da Vistoria Final</label>
                <textarea 
                  name="end_inspection_notes" 
                  value={formData.end_inspection_notes} 
                  onChange={handleChange} 
                  rows="2" 
                  className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none resize-none text-xs" 
                  placeholder="Observações sobre o estado do veículo na devolução..."
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border-color bg-slate-50/50 dark:bg-slate-950/20 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-muted-olive hover:text-main font-bold text-sm">
            Cancelar
          </button>
          <button type="submit" form="finishForm" disabled={loading} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center shadow-lg shadow-primary/20">
            {loading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <span>Finalizar e Liberar Veículo</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
