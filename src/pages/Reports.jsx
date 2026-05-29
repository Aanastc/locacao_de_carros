import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import { 
  ChartBar, Funnel, CircleNotch, Calendar, CurrencyDollar, Clock, TrendUp, TrendDown
} from '@phosphor-icons/react'

export default function Reports() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  
  const [incomes, setIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [rentals, setRentals] = useState([])
  const [cars, setCars] = useState([])
  const [scheduledExpenses, setScheduledExpenses] = useState([])

  const [filterPeriod, setFilterPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedCarId, setSelectedCarId] = useState('all')
  const [selectedParcelCarId, setSelectedParcelCarId] = useState('all') // Filtro específico para Gastos Parcelados
  const [selectedParcelYear, setSelectedParcelYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState([])

  useEffect(() => {
    if (user) {
      fetchReportsData()
      fetchAvailablePeriods()
    }
  }, [user?.id, filterPeriod, selectedMonth, selectedYear, selectedParcelYear])

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

  const fetchReportsData = async () => {
    setLoading(true)
    try {
      let startDate, endDate
      if (filterPeriod === 'month') {
        startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString()
        endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString()
      } else {
        startDate = new Date(selectedYear, 0, 1).toISOString()
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString()
      }

      const [incRes, expRes, rentRes, carsRes] = await Promise.all([
        supabase.from('incomes').select('*, rentals(car_id)').eq('user_id', user.id).gte('payment_date', startDate).lte('payment_date', endDate),
        supabase.from('expenses').select('*, cars(brand, model)').eq('user_id', user.id).gte('expense_date', startDate).lte('expense_date', endDate),
        supabase.from('rentals').select('*, cars(brand, model)').eq('user_id', user.id).gte('start_date', startDate).lte('start_date', endDate),
        supabase.from('cars').select('*').eq('owner_id', user.id)
      ])

      const carsList = carsRes.data || []
      const carIds = carsList.map(c => c.id)

      let schedExpRes = { data: [] }
      if (carIds.length > 0) {
        const yearStart = new Date(selectedParcelYear, 0, 1).toISOString()
        const yearEnd = new Date(selectedParcelYear, 11, 31, 23, 59, 59).toISOString()
        schedExpRes = await supabase.from('scheduled_expenses').select('*').in('car_id', carIds).gte('due_date', yearStart).lte('due_date', yearEnd)
      }

      setIncomes(incRes.data || [])
      setExpenses(expRes.data || [])
      setRentals(rentRes.data || [])
      setCars(carsList)
      setScheduledExpenses(schedExpRes.data || [])
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    let fIncomes = incomes
    let fExpenses = expenses
    let fRentals = rentals
    let fScheduled = scheduledExpenses

    if (selectedCarId !== 'all') {
      fIncomes = incomes.filter(inc => inc.rentals?.car_id === selectedCarId)
      fExpenses = expenses.filter(exp => exp.car_id === selectedCarId)
      fRentals = rentals.filter(rent => rent.car_id === selectedCarId)
      fScheduled = scheduledExpenses.filter(exp => exp.car_id === selectedCarId)
    }

    return { incomes: fIncomes, expenses: fExpenses, rentals: fRentals, scheduledExpenses: fScheduled }
  }, [incomes, expenses, rentals, scheduledExpenses, selectedCarId])

  const financialChartData = useMemo(() => {
    const { incomes: fIncomes, expenses: fExpenses } = filteredData
    if (filterPeriod === 'month') {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const dayIncomes = fIncomes.filter(inc => new Date(inc.payment_date).getDate() === day)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        const dayExpenses = fExpenses.filter(exp => new Date(exp.expense_date).getDate() === day)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        return { name: day.toString().padStart(2, '0'), Receitas: dayIncomes, Despesas: dayExpenses }
      })
    } else {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      return months.map((m, i) => {
        const monthIncomes = fIncomes.filter(inc => new Date(inc.payment_date).getMonth() === i)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        const monthExpenses = fExpenses.filter(exp => new Date(exp.expense_date).getMonth() === i)
          .reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
        return { name: m, Receitas: monthIncomes, Despesas: monthExpenses }
      })
    }
  }, [filteredData, filterPeriod, selectedMonth, selectedYear])

  const expenseCategoryData = useMemo(() => {
    const { expenses: fExpenses } = filteredData
    const categories = {}
    fExpenses.forEach(exp => {
      categories[exp.expense_type] = (categories[exp.expense_type] || 0) + parseFloat(exp.amount)
    })
    return Object.entries(categories).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredData])

  const rentalDurationData = useMemo(() => {
    const { rentals: fRentals } = filteredData
    // Calculando média de dias por aluguel
    if (fRentals.length === 0) return []
    
    const durations = fRentals.map(r => {
      const start = new Date(r.start_date)
      const end = r.end_date ? new Date(r.end_date) : new Date()
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    })

    const ranges = {
      '1-7 dias': 0,
      '8-15 dias': 0,
      '16-30 dias': 0,
      '30+ dias': 0
    }

    durations.forEach(d => {
      if (d <= 7) ranges['1-7 dias']++
      else if (d <= 15) ranges['8-15 dias']++
      else if (d <= 30) ranges['16-30 dias']++
      else ranges['30+ dias']++
    })

    return Object.entries(ranges).map(([name, value]) => ({ name, value }))
  }, [filteredData])

  const scheduledExpensesTableData = useMemo(() => {
    const fScheduled = scheduledExpenses.filter(exp => 
        (selectedParcelCarId === 'all' || exp.car_id === selectedParcelCarId) &&
        (exp.description && /parcela/i.test(exp.description))
    )
    const grouped = {}

    fScheduled.forEach(exp => {
      let key = exp.expense_type
      if (exp.description) {
         // Regex para remover tanto "(Parcela 1/12)" quanto "- Parcela 1/12"
         key = exp.description.replace(/\s*[-\(]*\s*Parcela \d+\/\d+[\)]*\s*/i, '').trim()
      }

      if (!grouped[key]) {
        grouped[key] = { name: key, total: 0, months: Array(12).fill(0) }
      }

      const month = parseInt(exp.due_date.split('-')[1], 10) - 1
      const amount = parseFloat(exp.amount)
      
      grouped[key].months[month] += amount
      grouped[key].total += amount
    })

    return Object.values(grouped).sort((a, b) => b.total - a.total)
  }, [filteredData])

  const totalIncomes = filteredData.incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
  const totalExpenses = filteredData.expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
  const profit = totalIncomes - totalExpenses

  const COLORS = ['#ce0a31', '#b9d48b', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899']

  if (loading && incomes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircleNotch className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black">Relatórios & Insights</h1>
          <p className="text-muted-olive mt-1">Analise a saúde financeira e operacional da sua frota.</p>
        </div>

        {/* Filters */}
        <div className="glass rounded-2xl p-4 mb-8 border border-border-color flex flex-col sm:flex-row items-center gap-4 tour-reports-filters">
          <div className="flex bg-primary/5 rounded-xl p-1 border border-border-color w-full sm:w-auto">
            <button onClick={() => setFilterPeriod('month')} className={`flex-1 sm:flex-none px-6 py-2 text-[10px] font-black rounded-lg transition-all ${filterPeriod === 'month' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-olive hover:text-primary'}`}>MENSAL</button>
            <button onClick={() => setFilterPeriod('year')} className={`flex-1 sm:flex-none px-6 py-2 text-[10px] font-black rounded-lg transition-all ${filterPeriod === 'year' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-olive hover:text-primary'}`}>ANUAL</button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {filterPeriod === 'month' && (
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 sm:w-40 bg-white/5 border border-border-color text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            )}
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="flex-1 sm:w-32 bg-white/5 border border-border-color text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select 
              value={selectedCarId} 
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="flex-1 sm:w-64 bg-white/5 border border-border-color text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
            >
              <option value="all">Todos os Veículos</option>
              {cars.map(car => (
                <option key={car.id} value={car.id}>{car.brand} {car.model} ({car.license_plate})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass rounded-3xl p-6 border-l-4 border-l-success">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-success/10 rounded-2xl"><TrendUp className="w-6 h-6 text-success" /></div>
              <h3 className="text-sm font-bold text-muted-olive uppercase tracking-wider">Total Receitas</h3>
            </div>
            <p className="text-3xl font-black text-success">R$ {totalIncomes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="glass rounded-3xl p-6 border-l-4 border-l-danger">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-danger/10 rounded-2xl"><TrendDown className="w-6 h-6 text-danger" /></div>
              <h3 className="text-sm font-bold text-muted-olive uppercase tracking-wider">Total Despesas</h3>
            </div>
            <p className="text-3xl font-black text-danger">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className={`glass rounded-3xl p-6 border-l-4 ${profit >= 0 ? 'border-l-primary' : 'border-l-danger'}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/10 rounded-2xl"><CurrencyDollar className="w-6 h-6 text-primary" /></div>
              <h3 className="text-sm font-bold text-muted-olive uppercase tracking-wider">Lucro Líquido</h3>
            </div>
            <p className={`text-3xl font-black ${profit >= 0 ? 'text-primary' : 'text-danger'}`}>R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 tour-reports-charts">
          {/* Financial Performance */}
          <div className="glass rounded-3xl p-6 md:p-8 flex flex-col">
            <h3 className="text-xl font-black flex items-center gap-3 mb-8">
              <ChartBar className="w-6 h-6 text-accent" />
              Desempenho Financeiro
            </h3>
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={financialChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8d2036' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8d2036' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  />
                  <Bar dataKey="Receitas" fill="#b9d48b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#ce0a31" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expense Categories */}
          <div className="glass rounded-3xl p-6 md:p-8 flex flex-col">
            <h3 className="text-xl font-black flex items-center gap-3 mb-8">
              <Funnel className="w-6 h-6 text-danger" />
              Distribuição de Despesas
            </h3>
            <div className="h-[300px] w-full min-h-[300px] flex flex-col md:flex-row items-center">
              <div className="w-full h-full md:w-1/2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseCategoryData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-2 mt-4 md:mt-0">
                {expenseCategoryData.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-xs font-bold text-muted-olive">{item.name}</span>
                    </div>
                    <span className="text-xs font-black">R$ {item.value.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rental Duration */}
          <div className="glass rounded-3xl p-6 md:p-8 flex flex-col">
            <h3 className="text-xl font-black flex items-center gap-3 mb-8">
              <Clock className="w-6 h-6 text-primary" />
              Duração dos Aluguéis
            </h3>
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rentalDurationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeights: 'bold', fill: '#8d2036' }} width={80} />
                  <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                  <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Aluguéis" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="glass rounded-3xl p-6 md:p-8">
            <h3 className="text-xl font-black flex items-center gap-3 mb-8">
              <TrendUp className="w-6 h-6 text-accent" />
              Métricas Operacionais
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-primary/5 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-muted-olive uppercase tracking-wider">Ticket Médio (Receita)</p>
                  <h4 className="text-xl font-black">R$ {filteredData.rentals.length > 0 ? (totalIncomes / filteredData.rentals.length).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : 0}</h4>
                </div>
                <div className="p-3 bg-white/10 rounded-xl"><CurrencyDollar className="w-6 h-6 text-primary" /></div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-accent/5 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-muted-olive uppercase tracking-wider">Total de Aluguéis</p>
                  <h4 className="text-xl font-black">{filteredData.rentals.length} contratos</h4>
                </div>
                <div className="p-3 bg-white/10 rounded-xl"><Calendar className="w-6 h-6 text-accent" /></div>
              </div>

              <div className="flex justify-between items-center p-4 bg-danger/5 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-muted-olive uppercase tracking-wider">Custo Médio p/ Carro</p>
                  <h4 className="text-xl font-black">R$ {(selectedCarId === 'all' ? (cars.length > 0 ? totalExpenses / cars.length : 0) : totalExpenses).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h4>
                </div>
                <div className="p-3 bg-white/10 rounded-xl"><TrendDown className="w-6 h-6 text-danger" /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Gastos Parcelados */}
        <div className="glass rounded-3xl p-6 md:p-8 mt-8 border border-border-color">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <h3 className="text-xl font-black flex items-center gap-3">
              <Calendar className="w-6 h-6 text-danger" />
              Gastos Parcelados
            </h3>
            
            <div className="flex items-center gap-2">
              <select 
                value={selectedParcelYear} 
                onChange={(e) => setSelectedParcelYear(parseInt(e.target.value))}
                className="bg-white/5 border border-border-color text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
              >
                {availableYears.map(y => <option key={`parcel-year-${y}`} value={y}>{y}</option>)}
              </select>

              <select 
                value={selectedParcelCarId} 
                onChange={(e) => setSelectedParcelCarId(e.target.value)}
                className="bg-white/5 border border-border-color text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer"
              >
                <option value="all">Todos os Veículos</option>
                {cars.map(car => (
                  <option key={`parcel-${car.id}`} value={car.id}>{car.brand} {car.model} ({car.license_plate})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto pb-4 scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-4 border-b border-border-color font-black text-muted-olive uppercase tracking-widest text-xs min-w-[200px]">Despesa</th>
                  {MONTHS.map(m => (
                    <th key={m} className="p-4 border-b border-border-color font-black text-muted-olive uppercase tracking-widest text-xs text-right min-w-[100px]">{m.substring(0, 3)}</th>
                  ))}
                  <th className="p-4 border-b border-border-color font-black text-muted-olive uppercase tracking-widest text-xs text-right min-w-[120px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {scheduledExpensesTableData.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-muted-olive font-bold">Nenhum gasto parcelado registrado neste ano.</td>
                  </tr>
                ) : (
                  scheduledExpensesTableData.map((row, i) => (
                    <tr key={i} className="hover:bg-primary/5 transition-colors group">
                      <td className="p-4 border-b border-border-color/50 font-bold text-sm text-main">{row.name}</td>
                      {row.months.map((val, mIdx) => (
                        <td key={mIdx} className={`p-4 border-b border-border-color/50 text-right text-sm ${val > 0 ? 'font-black text-danger' : 'text-muted-olive font-medium'}`}>
                          {val > 0 ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                      ))}
                      <td className="p-4 border-b border-border-color/50 text-right font-black text-main">
                        R$ {row.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  )
}
