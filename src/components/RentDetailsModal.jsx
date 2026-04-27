import { X, User, Phone, IdentificationCard, Calendar, Car, CurrencyDollar, CheckCircle, FileText } from '@phosphor-icons/react'

export default function RentDetailsModal({ rental, onClose }) {
  if (!rental) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-primary/5">
          <h2 className="text-xl font-black text-main flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Detalhes do Contrato
          </h2>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">
          
          {/* Cliente */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-olive flex items-center gap-2">
              <User className="w-4 h-4" /> Informações do Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-4 rounded-2xl border border-border-color">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Nome</p>
                <p className="font-bold text-main">{rental.client_name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Contato</p>
                <p className="font-bold text-main flex items-center gap-1"><Phone className="w-4 h-4 text-muted-olive"/> {rental.client_contact || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Documento (CPF/CNPJ)</p>
                <p className="font-bold text-main flex items-center gap-1"><IdentificationCard className="w-4 h-4 text-muted-olive"/> {rental.client_document || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">CNH</p>
                <p className="font-bold text-main">{rental.client_cnh || '-'}</p>
              </div>
            </div>
          </div>

          {/* Período e Veículo */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-olive flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Período e Veículo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-4 rounded-2xl border border-border-color">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Retirada</p>
                <p className="font-bold text-main">{new Date(rental.start_date).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-olive mt-1">KM: {rental.initial_km || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Devolução (Prevista)</p>
                <p className="font-bold text-main">{new Date(rental.expected_end_date).toLocaleString('pt-BR')}</p>
              </div>
              {rental.actual_end_date && (
                <div className="sm:col-span-2 pt-3 border-t border-border-color mt-2">
                  <p className="text-[10px] uppercase font-black tracking-widest text-primary mb-1">Devolução Realizada</p>
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-main">{new Date(rental.actual_end_date).toLocaleString('pt-BR')}</p>
                    <p className="text-sm font-bold text-muted-olive">KM Final: {rental.final_km || '-'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Financeiro */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-olive flex items-center gap-2">
              <CurrencyDollar className="w-4 h-4" /> Financeiro
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-primary/5 p-4 rounded-2xl border border-border-color">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Modelo</p>
                <p className="font-bold text-main">{rental.rental_model}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Caução</p>
                <p className="font-bold text-main">R$ {rental.security_deposit || '0,00'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Status</p>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${rental.payment_status === 'Pago' ? 'bg-success/20 text-success border border-success/20' : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'}`}>
                  {rental.payment_status}
                </span>
              </div>
              <div className="sm:col-span-3 pt-3 border-t border-border-color flex justify-between items-center mt-2">
                <p className="text-sm font-black uppercase tracking-widest text-muted-olive">Total Acordado</p>
                <p className="text-2xl font-black text-primary">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rental.total_price)}</p>
              </div>
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-border-color bg-bg-main/50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-lg shadow-primary/20">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
