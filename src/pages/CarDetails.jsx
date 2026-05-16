import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { 
  ArrowLeft, Car, Calendar, CurrencyDollar, Wrench, FileText, 
  User, CircleNotch, CheckCircle, PlayCircle, MapPin, 
  ShieldCheck, Phone, DownloadSimple, CaretDown, WarningCircle, Files, Plus, ClockCounterClockwise, TrendUp, ArrowDownRight
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
  const [editingExpense, setEditingExpense] = useState(null)
  const [initialIncomeData, setInitialIncomeData] = useState(null)
  const [activeFinanceTab, setActiveFinanceTab] = useState('gastos') // gastos, receitas

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
  }, [incomes, activeRental?.id])

  const fetchData = async () => {
    if (!user || !plate) return
    setLoading(true)
    try {
      // 1. Get Car details
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
        .order('created_at', { ascending: false })

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
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-olive hover:text-primary transition-colors mb-2 text-sm font-bold group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 
              Voltar ao Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-black text-main flex flex-wrap items-center gap-3">
              {car.brand} {car.model}
              <span className="px-3 py-1 rounded-xl bg-primary/10 text-primary text-sm sm:text-base font-black uppercase tracking-widest border border-primary/20">
                {car.license_plate}
              </span>
            </h1>
          </div>
        </div>

        {/* Indicadores de Desempenho (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-5 border border-border-color shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-1">Total Faturado</p>
            <p className="text-2xl font-black text-primary">R$ {incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-success font-bold">
              <TrendUp className="w-3 h-3" /> Receita bruta acumulada
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border border-border-color shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-1">Total em Gastos</p>
            <p className="text-2xl font-black text-danger">R$ {expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-danger font-bold">
              <ArrowDownRight className="w-3 h-3" /> Saídas e manutenções
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border border-border-color shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-1">Saldo Líquido</p>
            <p className={`text-2xl font-black ${(incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) - expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)) >= 0 ? 'text-primary' : 'text-danger'}`}>
              R$ {(incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) - expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-olive font-bold">
              <CurrencyDollar className="w-3 h-3" /> Resultado do ativo
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border border-border-color shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-1">Quilometragem</p>
            <p className="text-2xl font-black text-main">{car.current_km?.toLocaleString() || '0'} <span className="text-xs font-medium text-muted-olive">km</span></p>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-accent font-bold">
              <MapPin className="w-3 h-3" /> Rodagem atual
            </div>
          </div>
        </div>

        {/* Painel de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
          {activeRental ? (
            <button onClick={() => setIsFinishModalOpen(true)} className="bg-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
              <CheckCircle className="w-5 h-5" /> Encerrar Aluguel
            </button>
          ) : car.status !== 'Manutenção' ? (
            <button onClick={() => setIsRentModalOpen(true)} className="bg-accent hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-black transition-all flex items-center gap-2 shadow-lg shadow-accent/20 border border-accent/30">
              <PlayCircle className="w-5 h-5" /> Iniciar Aluguel
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
          
          {/* Coluna Esquerda: Dados Técnicos */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Card Info do Carro */}
            <div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Car className="w-5 h-5 text-accent" />
                  Detalhes do Veículo
                </h3>
                <button 
                  onClick={() => setIsEditCarModalOpen(true)}
                  className="p-1.5 px-2.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                >
                  <PencilSimple className="w-3 h-3" /> Editar
                </button>
              </div>
              
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
                  Quilometragem
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
                  <p className="text-sm text-slate-500 text-center py-4">Nenhum registro.</p>
                ) : (
                  kmHistory.map((record) => (
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
            
          </div>

          {/* Coluna Direita: Operacional e Financeiro */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Aluguel Ativo (Destaque) */}
            {activeRental ? (
              <div className="bg-primary/5 dark:bg-primary-dark/20 border border-primary/20 rounded-2xl p-6 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h3 className="text-xl font-black flex items-center gap-2 text-main">
                    <CheckCircle className="w-6 h-6 text-primary" />
                    Contrato Atual
                  </h3>
                  <button 
                    onClick={() => setIsEditRentModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 border border-accent/20"
                  >
                    <PencilSimple className="w-4 h-4" /> Editar Contrato
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-lg font-black flex items-center gap-2">
                        <User className="w-5 h-5 text-accent" /> {activeRental.client_name}
                      </p>
                      <p className="text-sm text-main flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-olive" weight="fill" /> {activeRental.client_contact}
                      </p>
                      <p className="text-sm text-main flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-muted-olive" weight="fill" /> 
                        <span className="text-muted-olive font-bold">Documento:</span> {activeRental.client_document || '-'}
                      </p>
                    </div>
                    
                    <div className="pt-4 border-t border-accent/10">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { url: activeRental.uber_file_url, label: 'Uber' },
                          { url: activeRental.criminal_record_file_url, label: 'Criminal' },
                          { url: activeRental.cnh_ear_file_url, label: 'EAR' },
                          { url: activeRental.residence_proof_file_url, label: 'Endereço' },
                          { url: activeRental.sne_file_url, label: 'SNE' },
                        ].map(doc => doc.url && (
                          <a key={doc.label} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase border border-primary/20 hover:scale-105 transition-transform">
                            <FileText className="w-3.5 h-3.5" /> {doc.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/40 dark:bg-slate-950/40 p-4 rounded-xl border border-border-color">
                      <div>
                        <p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Vencimento Prox.</p>
                        <p className="font-black text-danger">{new Date(activeRental.expected_end_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Total Acordado</p>
                        <p className="font-black text-primary">R$ {Number(activeRental.total_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-12 border border-border-color text-center bg-primary/5">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4 opacity-30" />
                <h3 className="text-xl font-black mb-2 text-main">Disponível para Aluguel</h3>
                <p className="text-muted-olive mb-6 max-w-xs mx-auto">Este veículo está sem contrato ativo. Inicie um novo aluguel para gerar receita.</p>
                <button onClick={() => setIsRentModalOpen(true)} className="bg-primary hover:opacity-90 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary/20">
                  + Iniciar Novo Contrato
                </button>
              </div>
            )}

            {/* Abas de Fluxo Financeiro Detalhado */}
            <div className="glass rounded-2xl border border-border-color shadow-sm overflow-hidden">
              <div className="flex border-b border-border-color bg-bg-main/50">
                <button 
                  onClick={() => setActiveFinanceTab('gastos')}
                  className={`flex-1 py-4 px-6 text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeFinanceTab === 'gastos' ? 'bg-bg-card text-danger border-b-2 border-danger' : 'text-muted-olive hover:text-danger'}`}
                >
                  <Wrench className="w-4 h-4" /> Gastos
                </button>
                <button 
                  onClick={() => setActiveFinanceTab('receitas')}
                  className={`flex-1 py-4 px-6 text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeFinanceTab === 'receitas' ? 'bg-bg-card text-primary border-b-2 border-primary' : 'text-muted-olive hover:text-primary'}`}
                >
                  <CurrencyDollar className="w-4 h-4" /> Receitas
                </button>
              </div>

              <div className="p-0">
                {activeFinanceTab === 'gastos' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-bg-main/30 border-b border-border-color">
                        <tr className="text-[10px] uppercase font-black tracking-widest text-muted-olive">
                          <th className="py-3 px-6">Data</th>
                          <th className="py-3 px-6">Categoria</th>
                          <th className="py-3 px-6">Valor</th>
                          <th className="py-3 px-6">Nota</th>
                          <th className="py-3 px-6">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {expenses.length === 0 ? (
                          <tr><td colSpan="4" className="py-8 text-center italic text-muted-olive">Nenhum gasto registrado.</td></tr>
                        ) : (
                          expenses.map(exp => (
                            <tr key={exp.id} className="border-b border-border-color last:border-0 hover:bg-danger/5">
                              <td className="py-4 px-6">{new Date(exp.expense_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                              <td className="py-4 px-6">
                                <span className="px-2 py-0.5 rounded-md bg-danger/10 text-danger text-[10px] font-black uppercase">{exp.expense_type}</span>
                              </td>
                              <td className="py-4 px-6 font-bold text-danger">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="py-4 px-6 text-xs text-muted-olive max-w-[150px] truncate">{exp.description || '-'}</td>
                              <td className="py-4 px-6 text-right">
                                <button 
                                  onClick={() => setEditingExpense(exp)} 
                                  className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors shadow-sm border border-accent/10"
                                  title="Editar Despesa"
                                >
                                  <PencilSimple className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-bg-main/30 border-b border-border-color">
                        <tr className="text-[10px] uppercase font-black tracking-widest text-muted-olive">
                          <th className="py-3 px-6">Data</th>
                          <th className="py-3 px-6">Método</th>
                          <th className="py-3 px-6">Valor</th>
                          <th className="py-3 px-6">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {incomes.length === 0 ? (
                          <tr><td colSpan="4" className="py-8 text-center italic text-muted-olive">Nenhuma receita registrada.</td></tr>
                        ) : (
                          incomes.map(inc => (
                            <tr key={inc.id} className="border-b border-border-color last:border-0 hover:bg-primary/5">
                              <td className="py-4 px-6">{new Date(inc.payment_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                              <td className="py-4 px-6 font-medium">{inc.payment_method}</td>
                              <td className="py-4 px-6 font-bold text-primary">R$ {Number(inc.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="py-4 px-6">
                                <button onClick={() => setEditingIncome(inc)} className="text-[10px] font-black uppercase text-accent hover:underline">Editar</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de Aluguéis */}
            <div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-main">
                <ClockCounterClockwise className="w-5 h-5 text-muted-olive" />
                Histórico de Contratos
              </h3>
              
              {rentalsHistory.length === 0 ? (
                <p className="text-sm text-muted-olive py-4 text-center italic">Sem contratos anteriores.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-color text-[10px] uppercase font-black tracking-widest text-muted-olive">
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3">Período</th>
                        <th className="pb-3 text-right">Total</th>
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
                          </td>
                          <td className="py-4 text-xs text-muted-olive">
                            {new Date(rent.start_date).toLocaleDateString('pt-BR')} - {new Date(rent.actual_end_date || rent.expected_end_date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-4 text-right font-black text-primary">
                            R$ {Number(rent.total_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

        {/* Tabela de Despesas Detalhada */}
        <div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-black flex items-center gap-2 text-main">
              <Wrench className="w-6 h-6 text-danger" />
              Histórico Completo de Gastos
            </h3>
            <div className="bg-danger/10 px-4 py-2 rounded-xl border border-danger/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-danger block mb-0.5">Soma de Lançamentos</span>
              <span className="text-lg font-black text-danger">R$ {expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-olive py-12 text-center italic font-medium">Este veículo ainda não possui despesas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-color text-[10px] uppercase font-black tracking-widest text-muted-olive">
                    <th className="pb-3 px-4">Data</th>
                    <th className="pb-3 px-4">Categoria</th>
                    <th className="pb-3 px-4">Valor</th>
                    <th className="pb-3 px-4">Nota</th>
                    <th className="pb-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {expenses.map(exp => (
                    <tr key={exp.id} className="border-b border-border-color last:border-0 hover:bg-danger/5 transition-colors">
                      <td className="py-4 px-4 font-bold text-main">{new Date(exp.expense_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-danger/10 text-danger text-[10px] font-black uppercase tracking-wider border border-danger/10">
                          {exp.expense_type}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-black text-danger text-base">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 px-4 text-muted-olive text-xs leading-relaxed max-w-xs truncate hover:whitespace-normal transition-all">{exp.description || '-'}</td>
                      <td className="py-4 px-4 text-right">
                        <button 
                          onClick={() => setEditingExpense(exp)} 
                          className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors shadow-sm border border-accent/10"
                          title="Editar Despesa"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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

      {(isExpenseModalOpen || editingExpense) && (
        <ExpenseModal 
          car={car} 
          expense={editingExpense}
          onClose={() => {
            setIsExpenseModalOpen(false)
            setEditingExpense(null)
          }} 
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
