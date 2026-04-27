import { useState, useEffect, useMemo } from 'react'
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
import EditIncomeModal from '../components/EditIncomeModal'
import EditCarModal from '../components/EditCarModal'
import EditRentModal from '../components/EditRentModal'
import RentDetailsModal from '../components/RentDetailsModal'
import AddKmModal from '../components/AddKmModal'
import { PencilSimple } from '@phosphor-icons/react'

export default function CarDetails() {
  const { plate } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  
  const [car, setCar] = useState(null)
  const [activeRental, setActiveRental] = useState(null)
  const [rentalsHistory, setRentalsHistory] = useState([])
  const [selectedHistoryRent, setSelectedHistoryRent] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [kmLogs, setKmLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false)

  // Modals state
  const [isRentModalOpen, setIsRentModalOpen] = useState(false)
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [isEditCarModalOpen, setIsEditCarModalOpen] = useState(false)
  const [isEditRentModalOpen, setIsEditRentModalOpen] = useState(false)
  const [isAddKmModalOpen, setIsAddKmModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [initialIncomeData, setInitialIncomeData] = useState(null)

  const generatePaymentSchedule = (rental) => {
    if (!rental) return []
    const dates = []
    let currentDate = new Date(rental.start_date)
    const endDate = new Date(rental.expected_end_date)
    
    let diffMs = endDate - new Date(rental.start_date)
    if (diffMs < 0) diffMs = 0
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = Math.max(1, Math.ceil(diffHours / 24))
    
    let multiplier = diffDays
    let increment = { days: 1 }
    
    if (rental.rental_model === 'Por Semana') {
      multiplier = Math.ceil(diffDays / 7)
      increment = { days: 7 }
    } else if (rental.rental_model === 'Por Mês') {
      multiplier = Math.ceil(diffDays / 30)
      increment = { months: 1 }
    }
    
    const amountPerPeriod = Number(rental.total_price) / multiplier
    
    for (let i = 0; i < multiplier; i++) {
      let paymentDate = new Date(currentDate)
      
      dates.push({
        id: `sched-${i}`,
        date: paymentDate.toISOString().split('T')[0],
        amount: amountPerPeriod,
        period: i + 1,
        totalPeriods: multiplier
      })
      
      if (increment.months) {
        currentDate.setMonth(currentDate.getMonth() + increment.months)
      } else {
        currentDate.setDate(currentDate.getDate() + increment.days)
      }
    }
    
    return dates
  }

  const paymentSchedule = activeRental ? generatePaymentSchedule(activeRental).map(sched => {
    const isPaid = incomes.some(inc => 
      inc.rental_id === activeRental.id && 
      (inc.notes?.includes(`parcela ${sched.period}/${sched.totalPeriods}`) || 
      (inc.payment_date === sched.date && parseFloat(inc.amount) === parseFloat(sched.amount)))
    )
    return { ...sched, isPaid }
  }) : []

  useEffect(() => {
    if (paymentSchedule.length > 0) {
      const firstUnpaidIndex = paymentSchedule.findIndex(s => !s.isPaid)
      if (firstUnpaidIndex !== -1) {
        const rowId = `row-sched-${firstUnpaidIndex}`
        const element = document.getElementById(rowId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }
    }
  }, [incomes, paymentSchedule.length])

  const fetchData = async () => {
    if (!user || !plate) return
    setLoading(true)
    try {
      // 1. Get Car details
      console.log('Fetching car with plate:', plate, 'for user:', user.id)
      const { data: carsData, error: carError } = await supabase
        .from('cars')
        .select('*')
        .ilike('license_plate', plate)
        .eq('owner_id', user.id)
      
      if (carError) {
        console.error('Car fetch error:', carError)
        throw carError
      }

      if (!carsData || carsData.length === 0) {
        console.error('Car not found')
        navigate('/dashboard')
        return
      }

      const carData = carsData[0]
      console.log('Car found:', carData)
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

      // 4. Get All Incomes for this car through its rentals
      const { data: incomesData, error: incomesError } = await supabase
        .from('incomes')
        .select('*, rentals(car_id, client_name)')
        .eq('user_id', user.id)
      
      if (!incomesError && incomesData) {
        // Filter incomes that belong to this car's rentals
        const filteredIncomes = incomesData.filter(inc => inc.rentals?.car_id === carData.id)
        setIncomes(filteredIncomes)
      } else if (incomesError) {
        console.error('Incomes fetch error:', incomesError)
      }

      // 5. Get KM Logs
      const { data: kmLogsData, error: kmLogsError } = await supabase
        .from('km_logs')
        .select('*')
        .eq('car_id', carData.id)
        .order('date', { ascending: false })

      if (!kmLogsError && kmLogsData) {
        setKmLogs(kmLogsData)
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

  const kmHistory = useMemo(() => {
    const history = []
    const allRentals = [...rentalsHistory]
    if (activeRental) allRentals.push(activeRental)

    allRentals.forEach(rent => {
      if (rent.initial_km) {
        history.push({
          id: `start-${rent.id}`,
          date: rent.start_date,
          km: rent.initial_km,
          label: `Início: ${rent.client_name.split(' ')[0]}`,
          type: 'start'
        })
      }
      if (rent.final_km && rent.actual_end_date) {
        history.push({
          id: `end-${rent.id}`,
          date: rent.actual_end_date,
          km: rent.final_km,
          label: `Fim: ${rent.client_name.split(' ')[0]}`,
          type: 'end'
        })
      }
    })

    kmLogs.forEach(log => {
      history.push({
        id: `log-${log.id}`,
        date: log.date,
        km: log.km,
        label: log.notes ? `Avulso: ${log.notes}` : `Lançamento Avulso`,
        type: 'avulso'
      })
    })
    
    return history.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [activeRental, rentalsHistory, kmLogs])

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
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-black text-main">
                    {car.brand} <span className="text-primary">{car.model}</span>
                  </h1>
              <button 
                onClick={() => setIsEditCarModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-lg shadow-primary/20"
              >
                <PencilSimple className="w-4 h-4" /> Editar
              </button>
                </div>
                <p className="text-xs text-muted-olive uppercase tracking-wider font-bold">{car.license_plate}</p>
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
            <button onClick={() => setIsRentModalOpen(true)} className="bg-accent hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-black transition-all flex items-center gap-2 shadow-lg shadow-accent/20 border border-accent/30">
              <PlayCircle className="w-5 h-5" /> Iniciar Aluguel
            </button>
          ) : car.status === 'Alugado' ? (
            <button onClick={() => setIsFinishModalOpen(true)} className="bg-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
              <CheckCircle className="w-5 h-5" /> Finalizar Aluguel
            </button>
          ) : null}
          
          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
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
                  <span className="text-muted-olive text-sm font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                    car.status === 'Disponível' ? 'bg-accent/20 text-white border border-accent/30' :
                    car.status === 'Alugado' ? 'bg-primary/20 text-white border border-primary/20' :
                    'bg-danger/20 text-white border border-danger/20'
                  }`}>
                    {car.status}
                  </span>
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

            {/* Histórico de Quilometragem */}
            <div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" />
                  Histórico de Quilometragem
                </h3>
                <button 
                  onClick={() => setIsAddKmModalOpen(true)}
                  className="p-1.5 px-2.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                >
                  <Plus className="w-3 h-3" /> Lançar
                </button>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                {kmHistory.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Nenhum registro de km.</p>
                ) : (
                  kmHistory.map((record, index) => (
                    <div key={record.id} className="flex justify-between items-center p-3 rounded-xl bg-primary/5 border border-border-color">
                      <div>
                        <p className="font-bold text-main">{record.km.toLocaleString()} <span className="text-xs font-medium text-muted-olive">km</span></p>
                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mt-1">{new Date(record.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${record.type === 'start' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}`}>
                          {record.label}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Lista de Despesas */}
            <div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
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
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <WarningCircle className="w-6 h-6 text-accent" />
                    Aluguel Ativo
                  </h3>
                  <button 
                    onClick={() => setIsEditRentModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 border border-accent/20"
                  >
                    <PencilSimple className="w-4 h-4" /> Editar Aluguel
                  </button>
                </div>
                
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
                    
                    {activeRental.security_deposit && (
                      <div className="pt-4 border-t border-accent/10">
                        <p className="text-xs text-slate-400 mb-1">Caução</p>
                        <p className="text-sm font-bold text-accent">R$ {activeRental.security_deposit}</p>
                      </div>
                    )}
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
                        <p className="text-3xl font-black text-accent flex items-baseline gap-1">
                          {calculateDaysRented(activeRental.start_date)} 
                          <span className="text-sm font-medium text-muted-olive">/ {Math.max(1, Math.ceil((new Date(activeRental.expected_end_date) - new Date(activeRental.start_date)) / (1000 * 60 * 60 * 24)))} dias</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-semibold">Total Acordado</p>
                        <p className="text-2xl font-black">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(activeRental.total_price)}</p>
                        <span className="text-[10px] font-bold text-muted-olive bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paymentSchedule[0]?.amount || 0)} {activeRental.rental_model.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cronograma de Pagamentos */}
                <div className="mt-8 pt-6 border-t border-accent/10 relative z-10">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Cronograma de Pagamentos</h4>
                  <div className="bg-primary/5 border border-border-color rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {paymentSchedule.length === 0 ? (
                      <p className="p-4 text-xs text-muted-olive italic">Nenhuma previsão gerada.</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 z-10">
                          <tr className="text-[10px] uppercase font-black text-slate-300 tracking-widest">
                            <th className="py-3 px-4">Parcela</th>
                            <th className="py-3 px-4">Vencimento</th>
                            <th className="py-3 px-4">Valor</th>
                            <th className="py-3 px-4 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentSchedule.map((sched, index) => (
                            <tr id={`row-sched-${index}`} key={sched.id} className={`border-b border-border-color last:border-0 transition-colors ${sched.isPaid ? 'bg-success/5 opacity-80' : 'hover:bg-primary/10'}`}>
                              <td className="py-3 px-4 font-bold text-main">{sched.period} / {sched.totalPeriods}</td>
                              <td className="py-3 px-4">{new Date(sched.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                              <td className="py-3 px-4 font-bold text-primary">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sched.amount)}</td>
                              <td className="py-3 px-4 text-right">
                                {sched.isPaid ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/20 px-3 py-1.5 rounded-md flex items-center justify-center gap-1 w-full sm:w-auto sm:inline-flex">
                                    <CheckCircle weight="fill" className="w-3 h-3" /> Pago
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setInitialIncomeData({
                                        date: sched.date,
                                        amount: sched.amount,
                                        notes: `Referente à parcela ${sched.period}/${sched.totalPeriods} do aluguel ${activeRental.rental_model.toLowerCase()}.`
                                      })
                                      setIsIncomeModalOpen(true)
                                    }}
                                    className="text-[10px] font-bold uppercase tracking-wider text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-md transition-colors"
                                  >
                                    Marcar como Pago
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Bloco de Receitas do Aluguel Atual */}
                <div className="mt-8 pt-6 border-t border-accent/10 relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Pagamentos Recebidos</h4>
                    <button onClick={() => { setInitialIncomeData(null); setIsIncomeModalOpen(true); }} className="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-bold border border-green-500/20">
                      <Plus className="w-3 h-3" /> Adicionar Pagamento
                    </button>
                  </div>
                  
                  {incomes.filter(inc => inc.rental_id === activeRental?.id).length === 0 ? (
                    <p className="text-xs text-muted-olive italic">Nenhum pagamento registrado neste aluguel ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {incomes.filter(inc => inc.rental_id === activeRental?.id).map(inc => (
                        <div key={inc.id} className="flex justify-between items-center bg-primary/5 p-3 rounded-lg border border-border-color group/inc">
                          <div>
                            <p className="font-black text-success">R$ {inc.amount}</p>
                            <p className="text-[10px] text-muted-olive font-bold uppercase">{inc.payment_method} • {new Date(inc.payment_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                            {inc.notes && <p className="text-xs text-muted-olive mt-1 italic">{inc.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingIncome(inc)}
                              className="text-[10px] font-bold uppercase tracking-wider text-muted-olive hover:text-white px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/5"
                            >
                              Editar
                            </button>
                            <CheckCircle className="w-5 h-5 text-success/30" />
                          </div>
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
                        <tr 
                          key={rent.id} 
                          onClick={() => setSelectedHistoryRent(rent)}
                          className="border-b border-border-color last:border-0 hover:bg-primary/5 transition-colors cursor-pointer"
                        >
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
          initialData={initialIncomeData}
          onClose={() => {
            setIsIncomeModalOpen(false)
            setInitialIncomeData(null)
          }}
          onSuccess={fetchData}
        />
      )}

      {isEditCarModalOpen && car && (
        <EditCarModal 
          car={car}
          onClose={() => setIsEditCarModalOpen(false)}
          onSuccess={(newPlate) => {
            if (newPlate !== car.license_plate) {
              navigate(`/car/${newPlate}`)
            } else {
              fetchData()
            }
          }}
        />
      )}

      {isEditRentModalOpen && activeRental && (
        <EditRentModal 
          rental={activeRental}
          car={car}
          onClose={() => setIsEditRentModalOpen(false)}
          onSuccess={fetchData}
        />
      )}

      {editingIncome && (
        <EditIncomeModal 
          income={editingIncome}
          onClose={() => setEditingIncome(null)}
          onSuccess={fetchData}
        />
      )}
      {selectedHistoryRent && (
        <RentDetailsModal
          rental={selectedHistoryRent}
          onClose={() => setSelectedHistoryRent(null)}
        />
      )}

      {isAddKmModalOpen && (
        <AddKmModal 
          car={car}
          onClose={() => setIsAddKmModalOpen(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
