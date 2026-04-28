import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

import { 
  Car, Plus, MagnifyingGlass, Funnel, ClockCounterClockwise, CircleNotch, X
} from '@phosphor-icons/react'
import AddCarForm from '../components/AddCarForm'

export default function Cars() {
  const { user } = useAuth()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam && ['Disponível', 'Alugado', 'Manutenção'].includes(statusParam)) {
      setStatusFilter(statusParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (user) {
      fetchCars()
    }
  }, [user])

  const fetchCars = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*, rentals(id)')
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircleNotch className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black">Sua Frota</h1>
            <p className="text-muted-olive mt-1">Gerencie todos os seus veículos em um só lugar.</p>
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-accent hover:opacity-90 text-white px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Veículo</span>
          </button>
        </div>

        {/* Filters */}
        <div className="glass rounded-2xl p-4 mb-8 border border-border-color space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-olive" />
              <input 
                type="text" 
                placeholder="Buscar por marca, modelo ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-border-color rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-accent outline-none transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-olive hover:text-danger"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Funnel className="w-5 h-5 text-muted-olive hidden sm:block" />
              <div className="flex bg-primary/5 rounded-xl p-1 border border-border-color w-full md:w-auto">
                {['Todos', 'Disponível', 'Alugado', 'Manutenção'].map((status) => (
                  <button 
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-2 text-[10px] font-black rounded-lg transition-all flex-1 md:flex-none ${
                      statusFilter === status 
                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                        : 'text-muted-olive hover:text-primary'
                    }`}
                  >
                    {status.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cars Grid */}
        {filteredCars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCars.map(car => (
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
                
                <div className="grid grid-cols-2 gap-2 pt-6 border-t border-border-color">
                  <div>
                    <p className="text-[10px] text-muted-olive uppercase tracking-widest mb-1 font-bold">Placa</p>
                    <p className="text-sm font-bold truncate">{car.license_plate?.toUpperCase() || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-olive uppercase tracking-widest mb-1 font-bold">Aluguéis</p>
                    <p className="text-sm font-bold">{car.rentals?.length || 0}</p>
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
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-4">
              <Car className="w-10 h-10 text-muted-olive" />
            </div>
            <h3 className="text-xl font-bold">Nenhum carro encontrado</h3>
            <p className="text-muted-olive mt-2">Tente ajustar seus filtros ou cadastre um novo veículo.</p>
          </div>
        )}

      {/* Modal Add Car */}
      {showAddForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddForm(false)}></div>
          <div className="relative glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Cadastrar Novo Veículo</h2>
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
