import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { 
  Car, SignOut, User, Sun, Moon, ChartBar, Layout, List, X, House
} from '@phosphor-icons/react'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [userProfile, setUserProfile] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
  }, [user])

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setUserProfile(data)
    } catch (e) {
      // ignore
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const userEmail = user?.email || 'Usuário'
  const userName = userProfile?.full_name || user?.user_metadata?.full_name || userEmail.split('@')[0]
  const firstName = userName.split(' ')[0]
  const avatar = userProfile?.avatar_url || user?.user_metadata?.avatar_url || null

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: House },
    { name: 'Ver Carros', path: '/cars', icon: Car },
    { name: 'Relatórios', path: '/reports', icon: ChartBar },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <nav className="glass fixed top-0 left-0 w-full z-40 border-b border-border-color">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Desktop Nav */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-3 active:scale-95 transition-transform">
              <img src="/logo.jpeg" alt="Logo" className="h-10 w-auto object-contain rounded-lg" />
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive(link.path)
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-muted-olive hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <link.icon weight={isActive(link.path) ? "fill" : "bold"} className="w-5 h-5" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* User Actions & Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle Premium */}
            <button 
              onClick={toggleTheme}
              className="relative p-2.5 rounded-2xl bg-bg-main border border-border-color shadow-sm hover:scale-110 active:scale-95 transition-all group overflow-hidden"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              <div className="relative z-10">
                {theme === 'dark' ? (
                  <Sun weight="fill" className="w-5 h-5 text-yellow-500 transition-transform group-hover:rotate-90 duration-500" />
                ) : (
                  <Moon weight="fill" className="w-5 h-5 text-base-brown transition-transform group-hover:-rotate-12 duration-500" />
                )}
              </div>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>

            {/* Profile Link */}
            <Link 
              to="/profile" 
              className={`flex items-center gap-2 text-sm transition-colors bg-white/40 dark:bg-slate-900/40 p-1 sm:py-1.5 sm:px-3 rounded-full border hover:border-primary/50 ${
                isActive('/profile') ? 'border-primary/50 text-primary' : 'border-border-color text-muted-olive'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border-color">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User weight="bold" className="w-4 h-4 text-muted-olive" />
                )}
              </div>
              <span className="hidden sm:inline font-black text-main">
                Olá, <span className="text-primary">{firstName}</span>
              </span>
            </Link>

            {/* Logout Button (Desktop) */}
            <button 
              onClick={handleSignOut}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-danger hover:bg-danger/10 transition-all font-black text-sm uppercase tracking-wider"
              title="Sair do sistema"
            >
              <SignOut weight="bold" className="w-5 h-5" />
              <span>Sair</span>
            </button>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-primary/10 transition-colors text-muted-olive"
            >
              {isMobileMenuOpen ? <X weight="bold" className="w-6 h-6" /> : <List weight="bold" className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden glass border-t border-border-color animate-in slide-in-from-top duration-300">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all ${
                  isActive(link.path)
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-muted-olive hover:bg-primary/10 hover:text-primary'
                }`}
              >
                <link.icon weight={isActive(link.path) ? "fill" : "bold"} className="w-6 h-6" />
                {link.name}
              </Link>
            ))}
            <div className="pt-4 border-t border-border-color">
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-danger hover:bg-danger/10 transition-all font-black text-base"
              >
                <SignOut weight="bold" className="w-6 h-6" />
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
