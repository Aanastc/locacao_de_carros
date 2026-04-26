import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Car, Lock, Envelope, CircleNotch, ArrowRight } from '@phosphor-icons/react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    
    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-main bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.1),rgba(255,255,255,0))] p-4">
      <div className="w-full max-w-md glass rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        {/* Decorative blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-primary rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-40 h-40 bg-secondary rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
        
        <div className="relative z-10 flex flex-col items-center mb-8 text-center">
          <h2 className="text-3xl font-bold text-main text-center tracking-tight">Bem-vindo de volta</h2>
          <p className="text-muted-olive mt-2 text-sm text-center">Entre para gerenciar seus aluguéis de carros</p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-lg text-sm mb-6 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-olive ml-1 uppercase tracking-wider">Email</label>
            <div className="relative">
              <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-olive" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-olive/50"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-olive ml-1 uppercase tracking-wider">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-olive" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-primary/5 border border-border-color text-main rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-olive/50"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center group disabled:opacity-70 shadow-lg shadow-primary/20"
          >
            {loading ? (
              <CircleNotch className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-olive relative z-10 font-medium">
          Não tem uma conta?{' '}
          <Link to="/register" className="text-accent hover:text-accent/80 font-black transition-colors uppercase tracking-widest">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
