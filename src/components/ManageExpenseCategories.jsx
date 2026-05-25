import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, CircleNotch, ArrowsMerge, Trash } from '@phosphor-icons/react'

export default function ManageExpenseCategories({ user, onClose, onCategoriesUpdated }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState([])
  const [error, setError] = useState('')
  const [mergingCategory, setMergingCategory] = useState(null)
  const [targetCategory, setTargetCategory] = useState('')
  const [deleting, setDeleting] = useState(false)

  const defaultCategories = ['Troca de óleo', 'Manutenção', 'Seguro', 'Alinhamento', 'Multas']

  const fetchStats = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('expense_type')
      .eq('user_id', user.id)

    if (error) {
      setError('Erro ao carregar categorias.')
      setLoading(false)
      return
    }

    const counts = {}
    data.forEach(item => {
      counts[item.expense_type] = (counts[item.expense_type] || 0) + 1
    })

    // Include defaults even if count is 0, unless hidden
    const hidden = JSON.parse(localStorage.getItem(`hiddenExpenseCategories_${user.id}`) || '[]')
    
    defaultCategories.forEach(cat => {
      if (!counts[cat] && !hidden.includes(cat)) {
        counts[cat] = 0
      }
    })

    // Exclude hidden ones if count is 0
    const list = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .filter(c => c.count > 0 || !hidden.includes(c.name))
      .sort((a, b) => b.count - a.count)

    setStats(list)
    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [user.id])

  const handleMerge = async (e) => {
    e.preventDefault()
    if (!targetCategory || targetCategory === mergingCategory.name) return

    setDeleting(true)
    setError('')

    try {
      if (mergingCategory.count > 0) {
        const { error: updError } = await supabase
          .from('expenses')
          .update({ expense_type: targetCategory })
          .eq('user_id', user.id)
          .eq('expense_type', mergingCategory.name)

        if (updError) throw updError
      }

      // Se for uma categoria padrão, ocultamos no localStorage
      if (defaultCategories.includes(mergingCategory.name)) {
        const hidden = JSON.parse(localStorage.getItem(`hiddenExpenseCategories_${user.id}`) || '[]')
        hidden.push(mergingCategory.name)
        localStorage.setItem(`hiddenExpenseCategories_${user.id}`, JSON.stringify(hidden))
      }

      setMergingCategory(null)
      setTargetCategory('')
      await fetchStats()
      onCategoriesUpdated() // Tell parent to reload categories list
    } catch (err) {
      console.error(err)
      setError('Erro ao mesclar categorias.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteEmpty = async (category) => {
    // Apenas oculta se for default (pois count é 0)
    if (defaultCategories.includes(category.name)) {
      const hidden = JSON.parse(localStorage.getItem(`hiddenExpenseCategories_${user.id}`) || '[]')
      hidden.push(category.name)
      localStorage.setItem(`hiddenExpenseCategories_${user.id}`, JSON.stringify(hidden))
      await fetchStats()
      onCategoriesUpdated()
    }
    // Se fosse custom, count = 0 significa que ela já não existe no DB, 
    // mas o fetchStats nem retornaria ela se count = 0 e não for default.
  }

  const allAvailableCategories = stats.map(s => s.name)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        <div className="flex justify-between items-center p-6 border-b border-border-color bg-slate-50/50 dark:bg-slate-950/20">
          <div>
            <h2 className="text-xl font-black text-main">Gerenciar Tipos</h2>
            <p className="text-xs text-muted-olive font-bold mt-1">Substitua ou exclua categorias</p>
          </div>
          <button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          {loading ? (
            <div className="flex justify-center p-8">
              <CircleNotch className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : mergingCategory ? (
            <div className="animate-in fade-in slide-in-from-right-4">
              <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl mb-6">
                <p className="text-sm font-medium text-main">
                  A categoria <span className="font-black text-warning">"{mergingCategory.name}"</span> possui <strong>{mergingCategory.count}</strong> lançamento(s).
                </p>
                <p className="text-xs text-muted-olive mt-1">Para excluí-la, escolha outra categoria para assumir esses lançamentos.</p>
              </div>

              <form onSubmit={handleMerge} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Substituir por *</label>
                  <select required value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-main font-bold focus:ring-2 focus:ring-accent outline-none">
                    <option value="" disabled>Selecione uma categoria...</option>
                    {allAvailableCategories.filter(c => c !== mergingCategory.name).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setMergingCategory(null)} className="flex-1 py-3 px-4 rounded-xl text-muted-olive hover:text-main font-bold text-sm">
                    Voltar
                  </button>
                  <button type="submit" disabled={deleting || !targetCategory} className="flex-1 py-3 px-4 rounded-xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50">
                    {deleting ? <CircleNotch className="w-5 h-5 animate-spin" /> : <span>Confirmar</span>}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.map(stat => (
                <div key={stat.name} className="flex items-center justify-between p-3 rounded-xl bg-bg-main border border-border-color">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-main">{stat.name}</span>
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-olive mt-0.5">{stat.count} {stat.count === 1 ? 'uso' : 'usos'}</span>
                  </div>
                  {stat.name !== 'Troca de óleo' && (
                    <button 
                      onClick={() => stat.count > 0 ? setMergingCategory(stat) : handleDeleteEmpty(stat)}
                      className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors flex items-center gap-1 border border-transparent hover:border-danger/20"
                      title="Excluir/Substituir"
                    >
                      {stat.count > 0 ? <ArrowsMerge className="w-4 h-4" /> : <Trash className="w-4 h-4" />}
                      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{stat.count > 0 ? 'Substituir' : 'Excluir'}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
