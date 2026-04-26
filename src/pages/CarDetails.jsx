import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { 
  ArrowLeft, Car, Calendar, CurrencyDollar, Wrench, FileText, 
  User, CircleNotch, Plus, CheckCircle, WarningCircle, PlayCircle, MapPin, ClockCounterClockwise,
  Sun, Moon, ShieldCheck, Phone, DownloadSimple, CaretDown
} from '@phosphor-icons/react'
import * as XLSX from 'xlsx'
import RentCarModal from '../components/RentCarModal'
import FinishRentModal from '../components/FinishRentModal'
import ExpenseModal from '../components/ExpenseModal'
import IncomeModal from '../components/IncomeModal'

export default function CarDetails() {
  const { plate } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  
  const [car, setCar] = useState(null)
  const [activeRental, setActiveRental] = useState(null)
  const [rentalsHistory, setRentalsHistory] = useState([])
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false)

  // Modals state
  const [isRentModalOpen, setIsRentModalOpen] = useState(false)
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)

  const fetchData = async () => {
    if (!user || !plate) return
    setLoading(true)
    try {
      // 1. Get Car details
      const { data: carData, error: carError } = await supabase
        .from('cars')
        .select('*')
        .eq('license_plate', plate)
        .eq('owner_id', user.id)
        .single()
      
      if (carError) throw carError
      setCar(carData)

      // 2. Get Rentals
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select('*')
        .eq('car_id', carData.id)
        .order('created_at', { ascending: false })
      
      if (!rentalsError && rentalsData) {
        const active = rentalsData.find(r => r.status === 'active')
        setActiveRental(active || null)
        setRentalsHistory(rentalsData.filter(r => r.status !== 'active'))
      }

      // 3. Get Expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('car_id', carData.id)
        .order('expense_date', { ascending: false })
      
      if (!expensesError && expensesData) {
        setExpenses(expensesData)
      }

      // 4. Get All Incomes for this car
      const { data: incomesData, error: incomesError } = await supabase
        .from('incomes')
        .select('*, rentals(client_name)')
        .eq('car_id', carData.id)
        .order('payment_date', { ascending: false })
      
      if (!incomesError && incomesData) {
        setIncomes(incomesData)
      }

    } catch (error) {
      console.error('Erro ao buscar detalhes do carro:', error)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [plate, user])

  const handleExportAnnual = () => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const year = new Date().getFullYear()
    
    const incomeCategories = ['Aluguel', 'Calção', 'Juros de investimentos', 'Outros']
    const expenseCategories = [
      'Prestação', 'Pneu', 'Bateria', 'Funilaria', 'Mecânico', 
      'Oleo', 'Seguro carro', 'IPVA/LICENC/Vistoria', 'Ar-condicionado', 'Multa', 'Outros'
    ]

    const matrix = []
    matrix.push([`PLANO ANUAL - ${car.brand} ${car.model} (${year})`])
    matrix.push([])
    matrix.push([null, 'CATEGORIA', ...months, 'TOTAL'])

    const getMonthData = (data, monthIndex, category, type) => {
      return data.filter(item => {
        const date = new Date(type === 'income' ? item.payment_date : item.expense_date)
        if (date.getFullYear() !== year) return false
        if (date.getMonth() !== monthIndex) return false
        
        if (type === 'income') {
          if (category === 'Aluguel') return !item.notes?.toLowerCase().includes('calção')
          if (category === 'Calção') return item.notes?.toLowerCase().includes('calção')
          return false
        } else {
          return item.expense_type === category
        }
      }).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
    }

    matrix.push(['RECEITAS'])
    incomeCategories.forEach(cat => {
      const row = [null, cat]
      let rowTotal = 0
      months.forEach((_, i) => {
        const val = getMonthData(incomes, i, cat, 'income')
        row.push(val)
        rowTotal += val
      })
      row.push(rowTotal)
      matrix.push(row)
    })
    matrix.push([])

    matrix.push(['AUTOMÓVEL'])
    expenseCategories.forEach(cat => {
      const row = [null, cat]
      let rowTotal = 0
      months.forEach((_, i) => {
        const val = getMonthData(expenses, i, cat, 'expense')
        row.push(val)
        rowTotal += val
      })
      row.push(rowTotal)
      matrix.push(row)
    })
    matrix.push([])

    matrix.push([null, 'TOTAIS', ...months, 'TOTAL'])
    
    const rendimentosRow = [null, 'Rendimentos']
    const gastosRow = [null, 'Gastos']
    const saldoRow = [null, 'Saldo do Mês']
    const acumuladoRow = [null, 'Saldo Acumulado']
    
    let totalRendimentos = 0
    let totalGastos = 0
    let saldoAcumulado = 0

    months.forEach((_, i) => {
      const mIncomes = incomes.filter(inc => {
        const d = new Date(inc.payment_date)
        return d.getFullYear() === year && d.getMonth() === i
      }).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)

      const mExpenses = expenses.filter(exp => {
        const d = new Date(exp.expense_date)
        return d.getFullYear() === year && d.getMonth() === i
      }).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
      
      rendimentosRow.push(mIncomes)
      gastosRow.push(mExpenses)
      const saldoMes = mIncomes - mExpenses
      saldoRow.push(saldoMes)
      saldoAcumulado += saldoMes
      acumuladoRow.push(saldoAcumulado)
      
      totalRendimentos += mIncomes
      totalGastos += mExpenses
    })
    
    rendimentosRow.push(totalRendimentos)
    gastosRow.push(totalGastos)
    saldoRow.push(totalRendimentos - totalGastos)
    acumuladoRow.push(saldoAcumulado)

    matrix.push(rendimentosRow)
    matrix.push(gastosRow)
    matrix.push(saldoRow)
    matrix.push(acumuladoRow)

    const ws = XLSX.utils.aoa_to_sheet(matrix)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Plano Anual')
    XLSX.writeFile(wb, `PLANO_ANUAL_${car.brand}_${car.model}_${year}.xlsx`)
  }

  const calculateDaysRented = (startDate) => {
    const start = new Date(startDate)
    const today = new Date()
    const diffTime = Math.abs(today - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircleNotch className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!car) return null

  return (
    <div className="min-h-screen pb-12 transition-colors duration-300">
      {/* Header Premium */}
      <header className="glass sticky top-0 z-40 border-b border-border-color">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link to="/dashboard" className="p-2 hover:bg-primary/10 rounded-full transition-colors text-muted-olive hover:text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 flex justify-between items-center">
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-border-color">
                  <span className="text-muted-olive text-sm font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                    car.status === 'Disponível' ? 'bg-accent/20 text-text-main border border-accent/30' :
                    car.status === 'Alugado' ? 'bg-primary/10 text-primary border border-primary/20' :
                    'bg-danger/10 text-danger border border-danger/20'
                  }`}>
                    {car.status}
                  </span>
                </div>
                <p className="text-xs text-muted-olive uppercase tracking-wider">{car.license_plate}</p>
              </div>
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-primary/10 transition-colors text-muted-olive hover:text-accent"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Painel de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-4">
          {car.status === 'Disponível' ? (
            <button onClick={() => setIsRentModalOpen(true)} className="bg-accent hover:opacity-90 text-primary px-5 py-2.5 rounded-xl font-black transition-all flex items-center gap-2 shadow-lg shadow-accent/20 border border-accent/30">
              <PlayCircle className="w-5 h-5" /> Iniciar Aluguel
            </button>
          ) : car.status === 'Alugado' ? (
            <button onClick={() => setIsFinishModalOpen(true)} className="bg-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
              <CheckCircle className="w-5 h-5" /> Finalizar Aluguel
            </button>
          ) : null}
          
          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-primary/10 hover:bg-primary/20 text-primary px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 border border-primary/20">
            <CurrencyDollar className="w-5 h-5" /> Lançar Despesa
          </button>

          {/* Botão de Exportar Simplificado */}
          <button 
            onClick={handleExportAnnual}
            className="bg-accent/10 hover:bg-accent/20 text-accent px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 border border-accent/20"
          >
            <DownloadSimple className="w-5 h-5" />
            Baixar Planilha
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna Esquerda: Info & Despesas */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Card Info do Carro */}
            <div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-accent" />
                Detalhes do Veículo
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border-color">
                  <span className="text-muted-olive text-sm font-medium">Ano</span>
                  <span className="font-bold">{car.year}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border-color">
                  <span className="text-muted-olive text-sm font-medium">Cor</span>
                  <span className="font-bold">{car.color || '-'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border-color">
                  <span className="text-muted-olive text-sm font-medium">Km Atual</span>
                  <span className="font-bold">{car.current_km ? `${car.current_km.toLocaleString()} km` : '-'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border-color">
                  <span className="text-muted-olive text-sm font-medium">Última Manutenção</span>
                  <span className="font-bold">{car.last_revision_date ? new Date(car.last_revision_date).toLocaleDateString('pt-BR') : '-'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border-color">
                  <span className="text-muted-olive text-sm font-medium">Valor de Compra</span>
                  <span className="font-bold">R$ {car.purchase_price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-olive text-sm font-medium">Renavam</span>
                  <span className="font-bold">{car.renavam || '-'}</span>
                </div>
              </div>
            </div>

            {/* Lista de Despesas */}
            <div className="glass rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-accent" />
                  Despesas Recentes
                </h3>
              </div>
              
              {expenses.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhuma despesa registrada.</p>
              ) : (
                <div className="space-y-4">
                  {expenses.slice(0, 5).map(exp => (
                    <div key={exp.id} className="flex justify-between items-start pb-3 border-b border-border-color last:border-0 last:pb-0">
                      <div>
                        <p className="font-bold text-sm">{exp.expense_type}</p>
                        <p className="text-[10px] text-muted-olive uppercase font-bold mt-0.5">{new Date(exp.expense_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className="text-danger font-black text-sm">- R$ {exp.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>

          {/* Coluna Direita: Aluguéis */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Aluguel Atual */}
            {activeRental ? (
              <div className="bg-primary/5 dark:bg-primary-dark/20 border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl"></div>
                <h3 className="text-xl font-black mb-6 flex items-center gap-2 relative z-10">
                  <WarningCircle className="w-6 h-6 text-accent" />
                  Aluguel Ativo
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs text-muted-olive uppercase tracking-widest mb-2 font-semibold">Informações do Cliente</p>
                      <div className="space-y-3">
                        <p className="text-lg font-black flex items-center gap-2">
                          <User className="w-5 h-5 text-accent" /> {activeRental.client_name}
                        </p>
                        <p className="text-sm text-main flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-olive" weight="fill" /> {activeRental.client_contact}
                        </p>
                        <p className="text-sm text-main flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-muted-olive" weight="fill" /> 
                          <span className="text-muted-olive font-bold">Doc:</span> {activeRental.client_document || '-'}
                        </p>
                        <p className="text-sm text-main flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-olive" weight="fill" /> 
                          <span className="text-muted-olive font-bold">CNH:</span> {activeRental.client_license || '-'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-accent/10 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Pagamento</p>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${activeRental.payment_status === 'Pago' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'}`}>
                          {activeRental.payment_status.toUpperCase()}
                        </span>
                      </div>
                      {activeRental.security_deposit && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Caução</p>
                          <p className="text-sm font-bold text-accent">R$ {activeRental.security_deposit}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-primary/5 dark:bg-slate-950/40 p-4 rounded-xl border border-border-color dark:border-slate-800">
                      <div>
                        <p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Retirada</p>
                        <p className="font-bold">{new Date(activeRental.start_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Devolução</p>
                        <p className="font-bold">{new Date(activeRental.expected_end_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2">
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Tempo Decorrido</p>
                        <p className="text-3xl font-black text-accent">
                          {calculateDaysRented(activeRental.start_date)} <span className="text-sm font-medium text-muted-olive">dias</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-semibold">Total Acordado</p>
                        <p className="text-2xl font-black">R$ {activeRental.total_price}</p>
                        <span className="text-xs text-slate-500">{activeRental.rental_model}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bloco de Receitas do Aluguel Atual */}
                <div className="mt-8 pt-6 border-t border-accent/10 relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Pagamentos Recebidos</h4>
                    <button onClick={() => setIsIncomeModalOpen(true)} className="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-bold border border-green-500/20">
                      <Plus className="w-3 h-3" /> Adicionar Pagamento
                    </button>
                  </div>
                  
                  {incomes.length === 0 ? (
                    <p className="text-xs text-muted-olive italic">Nenhum pagamento registrado neste aluguel ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {incomes.map(inc => (
                        <div key={inc.id} className="flex justify-between items-center bg-primary/5 p-3 rounded-lg border border-border-color">
                          <div>
                            <p className="font-black text-success">R$ {inc.amount}</p>
                            <p className="text-[10px] text-muted-olive font-bold uppercase">{inc.payment_method} • {new Date(inc.payment_date).toLocaleDateString('pt-BR')}</p>
                            {inc.notes && <p className="text-xs text-muted-olive mt-1 italic">{inc.notes}</p>}
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-success/30" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="glass rounded-2xl p-12 border border-border-color text-center shadow-sm">
                <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/20">
                  <CheckCircle className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-main">Veículo Disponível</h3>
                <p className="text-muted-olive mb-8 max-w-xs mx-auto font-medium">Este veículo está pronto para gerar novas receitas. Inicie um contrato agora.</p>
                <button onClick={() => setIsRentModalOpen(true)} className="bg-primary hover:opacity-90 text-white px-8 py-3 rounded-2xl font-black transition-all inline-flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-105 active:scale-95">
                  <PlayCircle className="w-6 h-6" /> Iniciar Novo Aluguel
                </button>
              </div>
            )}

            {/* Histórico */}
            <div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-main">
                <ClockCounterClockwise className="w-5 h-5 text-muted-olive" />
                Histórico de Aluguéis
              </h3>
              
              {rentalsHistory.length === 0 ? (
                <p className="text-sm text-muted-olive py-4 text-center italic">Nenhum histórico encontrado para este veículo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-color text-[10px] uppercase font-black tracking-widest text-muted-olive">
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3">Período</th>
                        <th className="pb-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {rentalsHistory.map(rent => (
                        <tr key={rent.id} className="border-b border-border-color last:border-0 hover:bg-primary/5 transition-colors">
                          <td className="py-4">
                            <p className="font-bold text-main">{rent.client_name}</p>
                            <p className="text-xs text-muted-olive">{rent.client_document || '-'}</p>
                          </td>
                          <td className="py-4 text-main">
                            {new Date(rent.start_date).toLocaleDateString('pt-BR')} até <br/>
                            <span className="text-muted-olive">{new Date(rent.actual_end_date || rent.expected_end_date).toLocaleDateString('pt-BR')}</span>
                          </td>
                          <td className="py-4 text-right">
                            <span className="text-green-400 font-bold block">R$ {rent.total_price}</span>
                            <span className="text-xs text-muted-olive">{rent.rental_model}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Modals */}
      {isRentModalOpen && (
        <RentCarModal 
          car={car} 
          onClose={() => setIsRentModalOpen(false)} 
          onSuccess={fetchData} 
        />
      )}

      {isFinishModalOpen && activeRental && (
        <FinishRentModal 
          rental={activeRental}
          car={car}
          onClose={() => setIsFinishModalOpen(false)} 
          onSuccess={fetchData} 
        />
      )}

      {isExpenseModalOpen && (
        <ExpenseModal 
          car={car} 
          onClose={() => setIsExpenseModalOpen(false)} 
          onSuccess={fetchData} 
        />
      )}

      {isIncomeModalOpen && activeRental && (
        <IncomeModal 
          rental={activeRental}
          onClose={() => setIsIncomeModalOpen(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
