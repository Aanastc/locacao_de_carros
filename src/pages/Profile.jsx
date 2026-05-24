import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { 
  ArrowLeft, User, Envelope, Camera, CircleNotch, FloppyDisk, 
  CheckCircle, WarningCircle, Lock
} from '@phosphor-icons/react'



export default function Profile() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [profile, setProfile] = useState({
    full_name: '',
    avatar_url: '',
    email: user?.email || '',
    new_password: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [user?.id])

  const fetchProfile = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      if (data) {
        setProfile(prev => ({
          ...prev,
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          email: user.email
        }))
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // 1. Atualizar Profile (Nome e Foto)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Atualizar Auth (Email e Senha)
      const updateData = {}
      if (profile.email !== user.email) updateData.email = profile.email
      if (profile.new_password) updateData.password = profile.new_password

      if (Object.keys(updateData).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(updateData)
        if (authError) throw authError
        if (updateData.email) setSuccessMsg('Perfil e E-mail atualizados! Verifique seu novo e-mail para confirmar.')
        else setSuccessMsg('Perfil e Senha atualizados!')
      } else {
        setSuccessMsg('Perfil atualizado com sucesso!')
      }
      
      setProfile(prev => ({ ...prev, new_password: '' }))
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (error) {
      console.error(error)
      setErrorMsg(error.message || 'Erro ao salvar o perfil. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = async (event) => {
    try {
      setUploading(true)
      setErrorMsg('')

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você precisa selecionar uma imagem.')
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
           throw new Error('O Bucket "avatars" não existe. Crie-o no Supabase Storage.')
        }
        throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const publicUrl = data.publicUrl
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }))

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      
      setSuccessMsg('Foto atualizada!')
      setTimeout(() => setSuccessMsg(''), 3000)

    } catch (error) {
      console.error(error)
      setErrorMsg(error.message || 'Erro ao fazer upload da imagem.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <CircleNotch className="w-8 h-8 text-accent animate-spin" />
        <span className="text-slate-400 font-medium">Carregando perfil...</span>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="glass rounded-3xl p-8 sm:p-12 border border-border-color shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 p-32 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
          
          {successMsg && (
            <div className="mb-8 p-4 bg-success/10 border border-success/20 text-success rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="w-5 h-5" />
              {successMsg}
            </div>
          )}
          
          {errorMsg && (
            <div className="mb-8 p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <WarningCircle className="w-5 h-5" />
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-12 items-start">
            
            <div className="flex flex-col items-center space-y-4">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full border-4 border-border-color bg-primary/5 overflow-hidden flex items-center justify-center shadow-xl">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-muted-olive" />
                  )}
                </div>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-full text-white cursor-pointer"
                >
                  {uploading ? <CircleNotch className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6 mb-1" />}
                  <span className="text-xs font-medium">{uploading ? 'Enviando...' : 'Trocar Foto'}</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={uploadAvatar} 
                />
              </div>
              <p className="text-[10px] text-muted-olive text-center max-w-[150px] font-bold uppercase">
                JPEG ou PNG. Recomendado 400x400.
              </p>
            </div>

            <form onSubmit={handleSave} className="flex-1 space-y-6 w-full relative z-10">
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-olive flex items-center gap-2">
                  <User className="w-4 h-4" /> Nome Completo
                </label>
                <input 
                  type="text" 
                  name="full_name" 
                  value={profile.full_name} 
                  onChange={handleChange} 
                  className="w-full bg-primary/5 border border-border-color rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent outline-none transition-all" 
                  placeholder="Seu nome completo" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-olive flex items-center gap-2">
                  <Envelope className="w-4 h-4" /> Endereço de E-mail
                </label>
                <input 
                  type="email" 
                  name="email"
                  value={profile.email} 
                  onChange={handleChange}
                  className="w-full bg-primary/5 border border-border-color rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent outline-none transition-all opacity-70" 
                />
                <p className="text-[10px] text-muted-olive italic font-medium">Ao mudar o e-mail, você precisará confirmar no novo endereço.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-olive flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Nova Senha
                </label>
                <input 
                  type="password" 
                  name="new_password"
                  value={profile.new_password} 
                  onChange={handleChange}
                  className="w-full bg-primary/5 border border-border-color rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent outline-none transition-all" 
                  placeholder="Deixe em branco para não alterar"
                />
              </div>
              
              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70"
                >
                  {saving ? <CircleNotch className="w-5 h-5 animate-spin" /> : <FloppyDisk className="w-5 h-5" />}
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>

            </form>
          </div>
        </div>
    </div>
  )
}
