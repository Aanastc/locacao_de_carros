import { Link } from 'react-router-dom'
import { Envelope, CheckCircle, ArrowLeft } from '@phosphor-icons/react'

export default function VerifyEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-main bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.1),rgba(255,255,255,0))] p-4">
      <div className="w-full max-w-md glass rounded-3xl p-10 relative overflow-hidden text-center shadow-2xl">
        {/* Decorative blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-primary rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6 bg-success text-white p-4 rounded-full shadow-lg border-2 border-main">
            <CheckCircle className="w-8 h-8" weight="fill" />
          </div>
          
          <h2 className="text-3xl font-bold text-main tracking-tight mb-4">Verifique seu Email</h2>
          
          <p className="text-muted-olive text-base mb-8 leading-relaxed font-medium">
            Nós enviamos um link de confirmação para o seu email. Por favor, clique no link para ativar sua conta e começar a usar nosso sistema.
          </p>
          
          <div className="p-4 bg-primary/5 border border-border-color rounded-xl mb-8">
            <p className="text-xs text-muted-olive font-bold uppercase tracking-wider">
              Não recebeu o email? Verifique sua caixa de spam ou lixo eletrônico.
            </p>
          </div>

          <Link 
            to="/login"
            className="flex items-center justify-center gap-2 text-accent hover:text-accent/80 font-black transition-colors uppercase tracking-widest text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  )
}
