import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, CircleNotch } from '@phosphor-icons/react';

export default function EditScheduledExpenseModal({ expense, onClose, onSuccess }) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [formData, setFormData] = useState({
		amount: expense ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(expense.amount) : '',
		due_date: expense?.date || new Date().toISOString().split('T')[0],
	});

	const handleCurrencyChange = (e) => {
		const { value } = e.target;
		const numericValue = value.replace(/\D/g, '');
		if (!numericValue) {
			setFormData(prev => ({ ...prev, amount: '' }));
			return;
		}
		const floatValue = parseFloat(numericValue) / 100;
		const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(floatValue);
		setFormData(prev => ({ ...prev, amount: formatted }));
	};

	const parseMaskedValue = (val) => {
		if (!val) return 0;
		return parseFloat(val.replace(/\./g, '').replace(',', '.'));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');

		try {
			const { error: updateError } = await supabase
				.from('scheduled_expenses')
				.update({
					amount: parseMaskedValue(formData.amount),
					due_date: formData.due_date
				})
				.eq('id', expense.id);

			if (updateError) throw updateError;
			onSuccess();
			onClose();
		} catch (err) {
			console.error(err);
			setError('Erro ao atualizar cronograma.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden">
				<div className="flex justify-between items-center p-6 border-b border-border-color bg-slate-50/50 dark:bg-slate-950/20">
					<h2 className="text-xl font-black text-main">Editar Parcela</h2>
					<button onClick={onClose} className="text-muted-olive hover:text-main transition-colors">
						<X className="w-5 h-5" />
					</button>
				</div>
				<div className="p-6">
					{error && <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Valor (R$) *</label>
							<input required type="text" inputMode="numeric" value={formData.amount} onChange={handleCurrencyChange} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none font-bold" />
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black text-muted-olive uppercase tracking-widest ml-1">Data de Vencimento *</label>
							<input required type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-main focus:ring-2 focus:ring-accent outline-none dark:[color-scheme:dark]" />
						</div>
						<div className="pt-2 flex gap-3">
							<button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl text-muted-olive hover:text-main font-bold text-sm">Cancelar</button>
							<button type="submit" disabled={loading} className="flex-1 py-3 px-4 rounded-xl bg-accent text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20">
								{loading ? <CircleNotch className="w-5 h-5 animate-spin" /> : <span>Salvar</span>}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
