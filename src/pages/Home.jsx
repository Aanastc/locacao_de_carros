import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowRight } from '@phosphor-icons/react'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-bg-main text-main selection:bg-accent selection:text-white flex flex-col items-center justify-center p-4">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_20%,rgba(206,10,49,0.08),transparent_70%)]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-3xl w-full relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">
        {/* Logo removida */}

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-5 py-2 rounded-full mb-4">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Sistema de Gestão Profissional</span>
        </div>
        
        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl font-black leading-[1.1] tracking-tighter">
          Controle sua frota com <br/>
          <span className="text-primary">precisão absoluta</span>
        </h1>
        
        {/* Description */}
        <p className="max-w-xl mx-auto text-muted-olive text-base sm:text-lg font-medium leading-relaxed">
          A solução definitiva para pequenos e grandes locadores. Gestão financeira, 
          contratos dinâmicos e controle de manutenção em um só lugar.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          {user ? (
            <Link to="/dashboard" className="w-full sm:w-auto bg-primary text-white px-10 py-4 rounded-2xl font-black text-lg transition-all hover:scale-105 shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-95">
              Acessar Painel <ArrowRight className="w-6 h-6" />
            </Link>
          ) : (
            <>
              <Link to="/register" className="w-full sm:w-auto bg-primary text-white px-10 py-4 rounded-2xl font-black text-lg transition-all hover:scale-105 shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-95">
                Criar Minha Conta <ArrowRight className="w-6 h-6" />
              </Link>
              <Link to="/login" className="w-full sm:w-auto glass border border-border-color px-10 py-4 rounded-2xl font-black text-lg transition-all hover:bg-bg-card active:scale-95 text-center">
                Acessar Sistema
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
