import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { 
  Car, MagnifyingGlass, Funnel, Plus, ArrowRight, 
  CheckCircle, WarningCircle, Clock, CircleNotch,
  ClockCounterClockwise, X
} from '@phosphor-icons/react'
import AddCarForm from '../components/AddCarForm'

export default function Cars() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const statusFromUrl = searchParams.get('status')

  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(statusFromUrl || 'Todos')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (user) {
      fetchCars()
    }
  }, [user?.id])

  // Sync state if URL changes
  useEffect(() => {
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl)
    }
  }, [statusFromUrl])

  const fetchCars = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*, rentals(*)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCars(data || [])
    } catch (error) {
      console.error('Erro ao buscar carros:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredCars = useMemo(() => {
    return cars.filter(car => {
      const matchesSearch = 
        car.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        car.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        car.license_plate.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'Todos' || car.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [cars, searchTerm, statusFilter])

  const stats = useMemo(() => {
    return {
      total: cars.length,
      available: cars.filter(c => c.status === 'Disponível').length,
      rented: cars.filter(c => c.status === 'Alugado').length,
      maintenance: cars.filter(c => c.status === 'Manutenção').length
    }
  }, [cars])

  if (loading && cars.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircleNotch className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-500">
      
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-main mb-2">Sua Frota</h1>
          <p className="text-muted-olive font-medium">Gerencie seus veículos e acompanhe o status de cada um.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white/40 dark:bg-slate-900/40 border border-border-color rounded-2xl px-5 py-3 flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-muted-olive mb-1">Total</p>
              <p className="text-xl font-black">{stats.total}</p>
            </div>
            <div className="w-px h-8 bg-border-color opacity-50"></div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-success mb-1">Livres</p>
              <p className="text-xl font-black text-success">{stats.available}</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-primary text-white px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
          >
            <Plus weight="bold" className="w-5 h-5" /> Novo Carro
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-10 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-olive w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por placa, modelo ou marca..." 
            className="w-full bg-white/40 dark:bg-slate-900/40 border border-border-color rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex bg-white/40 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-border-color overflow-x-auto w-full md:w-auto">
          {['Todos', 'Disponível', 'Alugado', 'Manutenção'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                statusFilter === f 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-muted-olive hover:text-primary'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredCars.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredCars.map((car) => (
              <Link 
                key={car.id} 
                to={`/car/${car.license_plate}`}
                className="group glass rounded-[2.5rem] p-6 border border-border-color hover:border-primary/50 transition-all hover:translate-y-[-8px] flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <Car weight="bold" className="w-6 h-6" />
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    car.status === 'Disponível' ? 'bg-success/10 text-success' : 
                    car.status === 'Alugado' ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'
                  }`}>
                    {car.status}
                  </span>
                </div>
                
                <div className="mb-6">
                  <h4 className="text-xl font-bold group-hover:text-primary transition-colors text-main">{car.brand} {car.model}</h4>
                  <p className="text-muted-olive text-sm font-medium mt-1">{car.year} • {car.color}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-6 border-t border-border-color mt-auto">
                  <div>
                    <p className="text-[10px] text-muted-olive uppercase tracking-widest mb-1 font-bold">Placa</p>
                    <p className="text-sm font-bold truncate text-main">{car.license_plate?.toUpperCase() || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-olive uppercase tracking-widest mb-1 font-bold">Aluguéis</p>
                    <p className="text-sm font-bold text-main">{car.rentals?.length || 0}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-olive flex items-center gap-1.5">
                    <ClockCounterClockwise className="w-3.5 h-3.5" />
                    Ver Detalhes
                  </span>
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center group-hover:bg-brand transition-colors">
                    <Plus className="w-4 h-4 text-white group-hover:rotate-45 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-4">
              <Car className="w-10 h-10 text-muted-olive" />
            </div>
            <h3 className="text-xl font-bold text-main">Nenhum carro encontrado</h3>
            <p className="text-muted-olive mt-2">Tente ajustar seus filtros ou cadastre um novo veículo.</p>
          </div>
        )}

      {/* Modal Add Car */}
      {showAddForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddForm(false)}></div>
          <div className="relative glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-main">Cadastrar Novo Veículo</h2>
              <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <AddCarForm onComplete={() => { setShowAddForm(false); fetchCars(); }} />
          </div>
        </div>
      )}
    </div>
  )
}
