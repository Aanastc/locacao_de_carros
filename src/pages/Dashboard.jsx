// Dashboard Component - Operational View
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import AddCarForm from '../components/AddCarForm'


import * as XLSX from 'xlsx'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'
import { 
  Car, SignOut, Gear, Calendar, ClockCounterClockwise, User, 
  CircleNotch, Plus, Sun, Moon, DownloadSimple, Funnel, ChartBar, 
  CaretDown, FileText, WarningCircle, ArrowUpRight, ArrowDownRight, 
  TrendUp, CheckCircle, Clock
} from '@phosphor-icons/react'
import { format, addDays, isAfter, isBefore, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'


export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  
  const [cars, setCars] = useState([])
  const [loadingCars, setLoadingCars] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  
  // Filtros Dinâmicos
  const [filterPeriod, setFilterPeriod] = useState('month') // month, year
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState([])
  
  const [userProfile, setUserProfile] = useState(null)
  
  // Novos estados para Dashboard operacional
  const [alerts, setAlerts] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [fleetStats, setFleetStats] = useState({
    utilization: 0,
    maintenanceCount: 0,
    available: 0,
    rented: 0,
    maintenance: 0
  })

  // Financial Panorama States
  const [financialStats, setFinancialStats] = useState({
    periodExpenses: 0,
    periodRevenue: 0,
    periodProfit: 0
  })

  const [selectedCarForRent, setSelectedCarForRent] = useState(null)

  useEffect(() => {
    if (user) {
      fetchDashboardData()
      fetchUserProfile()
      fetchAvailablePeriods()
    }
  }, [user?.id, filterPeriod, selectedMonth, selectedYear])

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setUserProfile(data)
    } catch (e) {
      // ignore
    }
  }

  const fetchAvailablePeriods = async () => {
    try {
      const { data: expDates } = await supabase.from('expenses').select('expense_date').eq('user_id', user.id)
      const { data: incDates } = await supabase.from('incomes').select('payment_date').eq('user_id', user.id)
      
      const dates = [
        ...(expDates || []).map(d => new Date(d.expense_date)),
        ...(incDates || []).map(d => new Date(d.payment_date))
      ]
      
      const years = [...new Set(dates.map(d => d.getFullYear()))].sort((a, b) => b - a)
      if (years.length === 0) years.push(new Date().getFullYear())
      setAvailableYears(years)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchDashboardData = async () => {
    setLoadingCars(true)
    try {
      // 1. Fetch Cars & Rentals
      const { data: carsData, error: carsError } = await supabase
        .from('cars')
        .select('*, rentals(*)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (carsError) throw carsError
      setCars(carsData || [])

      // 2. Determine available periods
      let startDate, endDate
      if (filterPeriod === 'month') {
        startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString()
        endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString()
      } else {
        startDate = new Date(selectedYear, 0, 1).toISOString()
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString()
      }

      // 3. Fetch Financials
      const [expRes, incRes] = await Promise.all([
        supabase.from('expenses').select('*, cars(brand, model)').eq('user_id', user.id).gte('expense_date', startDate).lte('expense_date', endDate),
        supabase.from('incomes').select('*, rentals(client_name)').eq('user_id', user.id).gte('payment_date', startDate).lte('payment_date', endDate)
      ])
      
      const expData = expRes.data || []
      const incData = incRes.data || []
      setExpenses(expData)
      setIncomes(incData)

      // 4. Calculate Alerts & Activity
      const newAlerts = []
      const activeRentals = []
      
      carsData?.forEach(car => {
        // Maintenance Alert (Simple check: every 10k km)
        if (car.current_km && car.current_km % 10000 > 9000) {
          newAlerts.push({
            type: 'maintenance',
            title: 'Revisão Próxima',
            desc: `${car.brand} ${car.model} está com ${car.current_km.toLocaleString()} km`,
            carPlate: car.license_plate
          })
        }

        const active = car.rentals?.find(r => r.status === 'active')
        if (active) {
          activeRentals.push(active)
          // Rental Expiring Alert
          const expDate = new Date(active.expected_end_date)
          const today = new Date()
          const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
          
          if (diffDays <= 2 && diffDays >= 0) {
            newAlerts.push({
              type: 'rental_end',
              title: 'Aluguel Vencendo',
              desc: `${active.client_name.split(' ')[0]} entrega o ${car.brand} ${diffDays === 0 ? 'hoje' : `em ${diffDays}d`}`,
              carPlate: car.license_plate
            })
          }
        }
      })
      setAlerts(newAlerts)

      // Recent Activity (Merge and Sort)
      const activity = [
        ...incData.map(i => ({ ...i, activityType: 'income' })),
        ...expData.map(e => ({ ...e, activityType: 'expense' }))
      ].sort((a, b) => new Date(b.payment_date || b.expense_date) - new Date(a.payment_date || a.expense_date))
      .slice(0, 5)
      
      setRecentActivity(activity)

      // Fleet Stats
      const utilization = carsData.length > 0 ? (activeRentals.length / carsData.length) * 100 : 0
      
      const availableCount = carsData.filter(c => c.status === 'Disponível').length
      const rentedCount = carsData.filter(c => c.status === 'Alugado').length
      const maintenanceCount = carsData.filter(c => c.status === 'Manutenção').length

      setFleetStats({
        utilization,
        maintenanceCount: newAlerts.filter(a => a.type === 'maintenance').length,
        available: availableCount,
        rented: rentedCount,
        maintenance: maintenanceCount
      })

      // 5. Calculate Financial Panorama (Based on Selected Period)
      const periodExpenses = (expData || []).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
      const periodRevenue = (incData || []).reduce((acc, curr) => acc + parseFloat(curr.amount), 0)

      setFinancialStats({
        periodExpenses,
        periodRevenue,
        periodProfit: periodRevenue - periodExpenses
      })

      // 6. Payment Alerts (Enhanced)
      const paymentAlerts = []
      const activeRents = carsData?.flatMap(c => c.rentals || []).filter(r => r.status === 'active')
      
      activeRents.forEach(rent => {
        if (rent.payment_status === 'Pendente') {
          const car = carsData.find(c => c.id === rent.car_id)
          paymentAlerts.push({
            type: 'payment_pending',
            title: 'Pagamento Pendente',
            desc: `${rent.client_name} - ${car?.brand} ${car?.model}`,
            carPlate: car?.license_plate,
            lessee: rent.client_name,
            amount: rent.total_price
          })
        }
      })
      
      setAlerts([...newAlerts, ...paymentAlerts])

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error.message)
    } finally {
      setLoadingCars(false)
    }
  }

  const chartData = useMemo(() => {
    if (filterPeriod === 'month') {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
      const data = []
      for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = i.toString().padStart(2, '0')
        const dayIncomes = incomes.filter(inc => new Date(inc.payment_date).getDate() === i)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        const dayExpenses = expenses.filter(exp => new Date(exp.expense_date).getDate() === i)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        
        data.push({
          name: dayStr,
          Receitas: dayIncomes,
          Despesas: dayExpenses
        })
      }
      return data
    } else {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      return months.map((m, i) => {
        const monthIncomes = incomes.filter(inc => new Date(inc.payment_date).getMonth() === i)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        const monthExpenses = expenses.filter(exp => new Date(exp.expense_date).getMonth() === i)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        
        return {
          name: m,
          Receitas: monthIncomes,
          Despesas: monthExpenses
        }
      })
    }
  }, [incomes, expenses, filterPeriod, selectedMonth, selectedYear])

  const prepareReportData = () => {
    const rows = [
      ...incomes.map(inc => ({
        Tipo: 'Receita',
        Data: new Date(inc.payment_date).toLocaleDateString('pt-BR'),
        Descricao: inc.rentals?.client_name || 'Aluguel',
        Valor: parseFloat(inc.amount)
      })),
      ...expenses.map(exp => ({
        Tipo: 'Despesa',
        Data: new Date(exp.expense_date).toLocaleDateString('pt-BR'),
        Descricao: `${exp.expense_type}${exp.cars ? ` - ${exp.cars.brand} ${exp.cars.model}` : ''}`,
        Valor: parseFloat(exp.amount)
      }))
    ]
    return rows
  }

  const createMatrix = (carData = null, title = 'PLANO ANUAL') => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const year = selectedYear
    
    const incomeCategories = ['Aluguel', 'Calção', 'Juros de investimentos', 'Outros']
    const expenseCategories = [
      'Prestação', 'Pneu', 'Bateria', 'Funilaria', 'Mecânico', 
      'Oleo', 'Seguro carro', 'IPVA/LICENC/Vistoria', 'Ar-condicionado', 'Multa', 'Outros'
    ]

    const matrix = []
    matrix.push([`${title} - ${year}`])
    matrix.push([])
    matrix.push([null, 'CATEGORIA', ...months, 'TOTAL'])

    const getMonthData = (data, monthIndex, category, type) => {
      let filtered = data.filter(item => {
        const date = new Date(type === 'income' ? item.payment_date : item.expense_date)
        return date.getFullYear() === year && date.getMonth() === monthIndex
      })

      if (carData) {
        filtered = filtered.filter(item => item.car_id === carData.id || item.rentals?.car_id === carData.id)
      }

      return filtered.filter(item => {
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
      let mIncomes = incomes.filter(inc => {
        const d = new Date(inc.payment_date)
        return d.getFullYear() === year && d.getMonth() === i
      })
      let mExpenses = expenses.filter(exp => {
        const d = new Date(exp.expense_date)
        return d.getFullYear() === year && d.getMonth() === i
      })

      if (carData) {
        mIncomes = mIncomes.filter(inc => inc.car_id === carData.id || inc.rentals?.car_id === carData.id)
        mExpenses = mExpenses.filter(exp => exp.car_id === carData.id)
      }

      const mIncomesSum = mIncomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
      const mExpensesSum = mExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
      
      rendimentosRow.push(mIncomesSum)
      gastosRow.push(mExpensesSum)
      const saldoMes = mIncomesSum - mExpensesSum
      saldoRow.push(saldoMes)
      saldoAcumulado += saldoMes
      acumuladoRow.push(saldoAcumulado)
      
      totalRendimentos += mIncomesSum
      totalGastos += mExpensesSum
    })
    
    rendimentosRow.push(totalRendimentos)
    gastosRow.push(totalGastos)
    saldoRow.push(totalRendimentos - totalGastos)
    acumuladoRow.push(saldoAcumulado)

    matrix.push(rendimentosRow)
    matrix.push(gastosRow)
    matrix.push(saldoRow)
    matrix.push(acumuladoRow)

    return matrix
  }

  const handleExportAnnual = () => {
    const wb = XLSX.utils.book_new()
    
    // 1. Resumo Geral
    const matrixGeneral = createMatrix(null, 'RESUMO GERAL')
    const wsGeneral = XLSX.utils.aoa_to_sheet(matrixGeneral)
    XLSX.utils.book_append_sheet(wb, wsGeneral, 'Resumo Geral')
    
    // 2. Abas por Carro
    cars.forEach(car => {
      const matrixCar = createMatrix(car, `${car.brand} ${car.model}`)
      const wsCar = XLSX.utils.aoa_to_sheet(matrixCar)
      const sheetName = `${car.brand} ${car.model}`.substring(0, 31)
      XLSX.utils.book_append_sheet(wb, wsCar, sheetName)
    })

    XLSX.writeFile(wb, `PLANO_ANUAL_${selectedYear}.xlsx`)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleCarAdded = () => {
    setShowAddForm(false)
    fetchDashboardData()
  }

  const userEmail = user?.email || 'Usuário'
  const userName = userProfile?.full_name || user?.user_metadata?.full_name || userEmail.split('@')[0]
  const avatar = userProfile?.avatar_url || user?.user_metadata?.avatar_url || null

  if (loadingCars && cars.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircleNotch className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  const isFirstAccess = cars.length === 0

  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-700">
        
        {showAddForm ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-black">Adicionar Veículo</h1>
              <button onClick={() => setShowAddForm(false)} className="text-muted-olive hover:text-primary font-bold">Cancelar</button>
            </div>
            <AddCarForm onComplete={handleCarAdded} />
          </div>
        ) : (
          <>
            {/* Header com Boas-vindas */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">Visão Geral</p>
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-main">
                    Olá, {userName.split(' ')[0]}
                  </h1>
                  <button 
                    onClick={toggleTheme}
                    className="p-3 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-border-color/50 hover:scale-110 transition-all active:scale-95 shadow-xl shadow-black/5"
                  >
                    {theme === 'dark' ? (
                      <Sun weight="fill" className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Moon weight="fill" className="w-5 h-5 text-indigo-600" />
                    )}
                  </button>
                </div>
                <p className="text-muted-olive mt-2 font-medium opacity-70">Sua frota está operando com {fleetStats.utilization.toFixed(0)}% de capacidade hoje.</p>
              </div>

              {/* Filtros de Período Dinâmicos */}
              <div className="flex flex-wrap items-center gap-3 bg-white/30 dark:bg-slate-900/30 p-2 rounded-[2rem] border border-border-color/50">
                <div className="flex bg-primary/5 rounded-2xl p-1">
                  <button onClick={() => setFilterPeriod('month')} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${filterPeriod === 'month' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-olive hover:text-primary'}`}>MENSAL</button>
                  <button onClick={() => setFilterPeriod('year')} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${filterPeriod === 'year' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-olive hover:text-primary'}`}>ANUAL</button>
                </div>

                <div className="flex items-center gap-2">
                  {filterPeriod === 'month' && (
                    <select 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-main outline-none cursor-pointer py-1 pr-8"
                    >
                      {MONTHS.map((m, i) => <option key={m} value={i + 1} className="dark:bg-slate-900">{m}</option>)}
                    </select>
                  )}
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-main outline-none cursor-pointer py-1 pr-8"
                  >
                    {availableYears.map(y => <option key={y} value={y} className="dark:bg-slate-900">{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={handleExportAnnual} className="p-3 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-border-color/50 hover:bg-primary/10 hover:text-primary transition-all active:scale-95 shadow-lg shadow-black/5" title="Exportar Excel">
                  <DownloadSimple weight="bold" className="w-5 h-5" />
                </button>
                <button onClick={() => setShowAddForm(true)} className="bg-primary text-white px-6 py-4 rounded-3xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:translate-y-[-2px] transition-all flex items-center gap-2">
                  <Plus weight="bold" className="w-4 h-4" /> Novo Veículo
                </button>
              </div>
            </div>

            {/* Quick Stats - Minimalist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="relative group p-6 bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-border-color/50">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-olive mb-3">Gastos {filterPeriod === 'month' ? '(Mês)' : '(Ano)'}</p>
                <h3 className="text-3xl font-black tracking-tighter text-danger">
                  <span className="text-sm font-bold mr-1">R$</span>
                  {financialStats.periodExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="relative group p-6 bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-border-color/50">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-olive mb-3">Renda {filterPeriod === 'month' ? '(Mês)' : '(Ano)'}</p>
                <h3 className="text-3xl font-black tracking-tighter text-success">
                  <span className="text-sm font-bold mr-1">R$</span>
                  {financialStats.periodRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="relative group p-6 bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-border-color/50">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-olive mb-3">Lucro {filterPeriod === 'month' ? '(Mês)' : '(Ano)'}</p>
                <h3 className="text-3xl font-black tracking-tighter text-primary">
                  <span className="text-sm font-bold mr-1">R$</span>
                  {financialStats.periodProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="relative group p-6 bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-border-color/50">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-olive mb-3">Pendências</p>
                <h3 className={`text-3xl font-black tracking-tighter ${alerts.length > 0 ? 'text-orange-500' : 'text-success'}`}>
                  {alerts.length} <span className="text-xs font-bold">alertas</span>
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              {/* Financial Section */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white/40 dark:bg-slate-900/40 rounded-[2.5rem] p-6 sm:p-10 border border-border-color/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight mb-1 text-main">Fluxo Financeiro</h3>
                      <p className="text-xs text-muted-olive font-medium">Comparativo entre receitas e despesas operacionais.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-success`}></div>
                      <p className="text-xs text-muted-olive font-medium">Dados atualizados para o período selecionado.</p>
                    </div>
                  </div>
                  
                  <div className="h-[320px] w-full min-h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '700', fill: 'var(--text-muted)' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '700', fill: 'var(--text-muted)' }} />
                        <Tooltip 
                          cursor={{ fill: 'var(--primary)', opacity: 0.03 }}
                          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '16px', background: 'var(--bg-card)', color: 'var(--text-main)' }} 
                        />
                        <Bar dataKey="Receitas" fill="var(--success)" radius={[6, 6, 0, 0]} barSize={filterPeriod === 'month' ? 8 : 32} />
                        <Bar dataKey="Despesas" fill="var(--danger)" radius={[6, 6, 0, 0]} barSize={filterPeriod === 'month' ? 8 : 32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Fleet Summary - Extra Clean */}
                <div className="bg-white/40 dark:bg-slate-900/40 rounded-[2.5rem] p-6 sm:p-10 border border-border-color/50">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black tracking-tight text-main">Frota</h3>
                    <Link to="/cars" className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2">
                      Ver Mais <ArrowUpRight weight="bold" className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                    <div className="text-center sm:text-left">
                      <p className="text-[9px] font-black text-muted-olive uppercase tracking-[0.2em] mb-2">Disponíveis</p>
                      <p className="text-3xl font-black text-brand">{fleetStats.available}</p>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-[9px] font-black text-muted-olive uppercase tracking-[0.2em] mb-2">Alugados</p>
                      <p className="text-3xl font-black text-primary">{fleetStats.rented}</p>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-[9px] font-black text-muted-olive uppercase tracking-[0.2em] mb-2">Manutenção</p>
                      <p className="text-3xl font-black text-danger">{fleetStats.maintenance}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operations Column */}
              <div className="space-y-8">
                {/* Alerts Section - Enhanced */}
                <div className="bg-white/40 dark:bg-slate-900/40 rounded-[2rem] p-8 border border-border-color/50 shadow-lg shadow-black/5">
                  <div className="flex items-center gap-3 mb-6">
                    <WarningCircle className="w-6 h-6 text-danger" weight="bold" />
                    <h3 className="text-lg font-black uppercase tracking-[0.1em] text-danger">Alertas</h3>
                  </div>
                  <div className="space-y-4">
                    {alerts.length === 0 ? (
                      <p className="text-sm font-bold text-muted-olive/70 text-center py-8 italic">Nenhuma pendência hoje.</p>
                    ) : (
                      alerts.map((alert, idx) => (
                        <div key={idx} className="group p-5 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-border-color/30 hover:border-danger/50 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm">
                          <p className="text-xs font-black uppercase tracking-widest text-danger/80 mb-2">{alert.title}</p>
                          <p className="text-base font-bold text-main mb-3">{alert.desc}</p>
                          <Link to={`/car/${alert.carPlate}`} className="text-xs font-black text-primary hover:text-primary/80 transition-all flex items-center gap-1">GERENCIAR <ArrowUpRight weight="bold" className="w-3 h-3" /></Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Activity - Extra Clean */}
                <div className="bg-white/20 dark:bg-slate-900/20 rounded-[2rem] p-6 border border-border-color/30">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-main">Atividade</h3>
                  <div className="space-y-6">
                    {recentActivity.length === 0 ? (
                      <p className="text-[10px] font-bold text-muted-olive/50 text-center py-6 italic">Sem atividades recentes.</p>
                    ) : (
                      recentActivity.map((act, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-1.5 h-1.5 rounded-full ${act.activityType === 'income' ? 'bg-success shadow-[0_0_8px_rgba(var(--success),0.5)]' : 'bg-danger'}`}></div>
                            <div>
                              <p className="text-xs font-black truncate max-w-[100px] text-main">{act.rentals?.client_name || act.expense_type}</p>
                              <p className="text-[9px] text-muted-olive font-bold uppercase">{format(new Date(act.payment_date || act.expense_date), 'dd MMM', { locale: ptBR })}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-black ${act.activityType === 'income' ? 'text-success' : 'text-danger'}`}>
                            {act.activityType === 'income' ? '+' : '-'} R$ {act.amount}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  )
}
