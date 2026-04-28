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
  CircleNotch, Plus, Sun, Moon, DownloadSimple, Funnel, ChartBar, CaretDown, FileText
} from '@phosphor-icons/react'

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
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchDashboardData()
      fetchUserProfile()
      fetchAvailablePeriods()
    }
  }, [user, filterPeriod, selectedMonth, selectedYear])

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
      const { data: carsData, error: carsError } = await supabase
        .from('cars')
        .select('*, rentals(id)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (carsError) throw carsError
      setCars(carsData || [])

      let startDate, endDate
      
      if (filterPeriod === 'month') {
        startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString()
        endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString()
      } else {
        startDate = new Date(selectedYear, 0, 1).toISOString()
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString()
      }

      const { data: expData } = await supabase
        .from('expenses')
        .select('*, cars(brand, model)')
        .eq('user_id', user.id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
      
      setExpenses(expData || [])

      const { data: incData } = await supabase
        .from('incomes')
        .select('*, rentals(client_name)')
        .eq('user_id', user.id)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)

      setIncomes(incData || [])

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
    setIsExportDropdownOpen(false)
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

  const totalIncomes = incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
  const totalExpenses = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
  const netProfit = totalIncomes - totalExpenses

  const availableCars = cars.filter(c => c.status === 'Disponível').length
  const rentedCars = cars.filter(c => c.status === 'Alugado').length
  const maintenanceCars = cars.filter(c => c.status === 'Manutenção').length

  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Header Premium */}
      <header className="glass sticky top-0 z-50 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src="/logo.jpeg" alt="Logo" className="h-10 w-auto object-contain" />
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-4">
              {/* Theme Toggle - Hidden for now
              <button 
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-primary/10 transition-colors text-muted-olive hover:text-accent"
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 sm:w-6 sm:h-6" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
              */}

              <Link to="/profile" className="flex items-center gap-2 text-sm text-muted-olive hover:text-primary transition-colors bg-primary/5 p-1 sm:py-1.5 sm:px-3 rounded-full border border-border-color hover:border-accent/50">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-muted-olive" />}
                </div>
                <span className="hidden sm:inline font-medium text-xs sm:text-sm">Olá, <strong className="text-primary">{userName.split(' ')[0]}</strong></span>
              </Link>

              <button 
                onClick={handleSignOut}
                className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 rounded-xl text-danger hover:bg-danger/10 transition-all font-bold text-sm"
                title="Sair do sistema"
              >
                <SignOut className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="hidden md:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {(isFirstAccess || showAddForm) ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black">
                  {isFirstAccess ? 'Bem-vindo ao CarRental! 👋' : 'Adicionar Veículo'}
                </h1>
                <p className="text-muted-olive mt-1">
                  {isFirstAccess 
                    ? 'Para começar a gerenciar sua locadora, precisamos que você cadastre seu primeiro veículo.' 
                    : 'Preencha os detalhes para incluir mais um veículo na sua frota.'}
                </p>
              </div>
              {!isFirstAccess && (
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="text-muted-olive hover:text-primary transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
            <AddCarForm onComplete={handleCarAdded} />
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black">Dashboard</h1>
                <p className="text-slate-400 mt-1 text-sm sm:text-base">Gerencie seus aluguéis e explore sua frota.</p>
              </div>
              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
                <button 
                  onClick={handleExportAnnual}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <DownloadSimple className="w-5 h-5" />
                  <span className="text-xs">Baixar Planilha</span>
                </button>

                <button 
                  onClick={() => setShowAddForm(true)}
                  className="bg-accent hover:opacity-90 text-white px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20 active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs">Novo Veículo</span>
                </button>
              </div>
            </div>

            {/* Painel de Filtros */}
            <div className="glass rounded-2xl p-4 mb-8 border border-border-color flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 text-muted-olive">
                <Funnel className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Filtros:</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex bg-primary/5 rounded-xl p-1 border border-border-color">
                  <button onClick={() => setFilterPeriod('month')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${filterPeriod === 'month' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-olive hover:text-primary'}`}>MENSAL</button>
                  <button onClick={() => setFilterPeriod('year')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${filterPeriod === 'year' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-olive hover:text-primary'}`}>ANUAL</button>
                </div>

                <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                  {filterPeriod === 'month' && (
                    <select 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="flex-1 sm:flex-initial bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer dark:[color-scheme:dark]"
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  )}
                  
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="flex-1 sm:flex-initial bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer dark:[color-scheme:dark]"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Painel Analítico: Gráfico & Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-12">
              
              {/* Gráfico de Rendimento */}
              <div className="xl:col-span-3 glass rounded-2xl p-4 sm:p-6 border border-border-color flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
                    <ChartBar className="w-5 h-5 text-accent" />
                    Desempenho Financeiro
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent"></div>
                      <span className="text-muted-olive uppercase tracking-widest text-[9px]">Receitas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-danger"></div>
                      <span className="text-muted-olive uppercase tracking-widest text-[9px]">Despesas</span>
                    </div>
                  </div>
                </div>
                
                <div className="w-full h-[250px] sm:h-[300px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 0, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} opacity={0.2} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#4B5563', fontSize: 9, fontWeight: 'bold' }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#4B5563', fontSize: 9, fontWeight: 'bold' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme === 'dark' ? '#111827' : '#FFFFFF', 
                          borderColor: theme === 'dark' ? '#374151' : '#E5E7EB', 
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.2)',
                          fontSize: '12px'
                        }}
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      />
                      <Bar 
                        dataKey="Receitas" 
                        fill={theme === 'dark' ? '#22C55E' : '#16A34A'} 
                        radius={[4, 4, 0, 0]} 
                        barSize={chartData.length > 12 ? 8 : 24}
                      />
                      <Bar 
                        dataKey="Despesas" 
                        fill={theme === 'dark' ? '#EF4444' : '#DC2626'} 
                        radius={[4, 4, 0, 0]} 
                        barSize={chartData.length > 12 ? 8 : 24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cards Financeiros Laterais */}
              <div className="space-y-6">
                <div className="glass rounded-2xl p-6 bg-gradient-to-br hover:from-green-500/5 transition-all group">
                  <h4 className="text-muted-olive text-xs font-bold uppercase tracking-wider mb-1">Receitas</h4>
                  <p className="text-2xl font-black text-success">R$ {totalIncomes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <div className="mt-4 h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-success w-full animate-in slide-in-from-left duration-1000"></div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-6 bg-gradient-to-br hover:from-danger/5 transition-all">
                  <h4 className="text-muted-olive text-xs font-bold uppercase tracking-wider mb-1">Despesas</h4>
                  <p className="text-2xl font-black text-danger">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <div className="mt-4 h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-danger w-full animate-in slide-in-from-left duration-1000"></div>
                  </div>
                </div>

                <div className={`glass rounded-2xl p-6 transition-all ${netProfit >= 0 ? 'border-accent/20 hover:from-accent/5' : 'border-danger/20 hover:from-danger/5'}`}>
                  <h4 className="text-muted-olive text-xs font-bold uppercase tracking-wider mb-1">Lucro Líquido</h4>
                  <p className={`text-3xl font-black ${netProfit >= 0 ? 'text-primary' : 'text-danger'}`}>
                    R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-olive mt-2 italic font-medium">Período Selecionado</p>
                </div>
              </div>

            </div>

            <div className="mb-12">
              <h3 className="text-xl sm:text-2xl font-black mb-6 flex items-center gap-3">
                <Car className="w-7 h-7 sm:w-8 sm:h-8 text-accent" />
                Sua Frota
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {/* Card Resumo Frota */}
                <div className={`glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-br transition-all relative overflow-hidden group border-none shadow-xl self-start ${
                  theme === 'dark' ? 'from-primary to-accent/40' : 'from-primary to-accent/20'
                }`}>
                  <div className="absolute top-0 right-0 p-12 sm:p-16 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all"></div>
                  <div className="relative z-10">
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">Total de Veículos</p>
                    <h4 className="text-4xl sm:text-5xl font-black text-white">{cars.length}</h4>
                  </div>
                  <div className="mt-8 space-y-4 relative z-10">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/80 flex items-center gap-2 font-medium"><span className="w-2 h-2 rounded-full bg-accent"></span> Disponíveis</span>
                      <span className="font-black text-white">{availableCars}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/80 flex items-center gap-2 font-medium"><span className="w-2 h-2 rounded-full bg-white/50"></span> Alugados</span>
                      <span className="font-black text-white">{rentedCars}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/80 flex items-center gap-2 font-medium"><span className="w-2 h-2 rounded-full bg-danger"></span> Manutenção</span>
                      <span className="font-black text-white">{maintenanceCars}</span>
                    </div>
                  </div>
                </div>

                {/* Grid de Carros */}
                <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cars.map(car => (
                    <Link 
                      to={`/car/${car.license_plate}`} 
                      key={car.id} 
                      className="glass rounded-3xl p-6 block hover:border-accent/50 hover:shadow-2xl hover:shadow-accent/5 transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="bg-primary/10 p-3 rounded-2xl group-hover:bg-accent/20 transition-colors">
                          <Car className="w-6 h-6 text-accent" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                          car.status === 'Disponível' ? 'bg-accent/20 text-white border border-accent/20' :
                          car.status === 'Alugado' ? 'bg-primary/20 text-white border border-primary/20' :
                          'bg-danger/20 text-white border border-danger/20'
                        }`}>
                          {car.status}
                        </span>
                      </div>
                      
                      <div className="mb-6">
                        <h4 className="text-xl font-bold group-hover:text-accent transition-colors">{car.brand} {car.model}</h4>
                        <p className="text-muted-olive text-sm font-medium mt-1">{car.year} • {car.color}</p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 pt-6 border-t border-border-color">
                        <div>
                          <p className="text-[10px] text-muted-olive uppercase tracking-widest mb-1 font-bold">Placa</p>
                          <p className="text-sm font-bold truncate">{car.license_plate?.toUpperCase() || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-olive uppercase tracking-widest mb-1 font-bold">Aluguéis</p>
                          <p className="text-sm font-bold">{car.rentals?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-olive uppercase tracking-widest mb-1 font-bold">KM</p>
                          <p className="text-sm font-bold truncate">{car.current_km ? `${car.current_km.toLocaleString()}` : '-'}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-olive flex items-center gap-1.5">
                          <ClockCounterClockwise className="w-3.5 h-3.5" />
                          Ver Detalhes
                        </span>
                        <div className="w-8 h-8 rounded-full bg-primary-dark flex items-center justify-center group-hover:bg-accent transition-colors">
                          <Plus className="w-4 h-4 text-white group-hover:rotate-45 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  )
}
