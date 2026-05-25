import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
	ArrowLeft,
	Car,
	Calendar,
	CurrencyDollar,
	Wrench,
	FileText,
	User,
	CircleNotch,
	CheckCircle,
	PlayCircle,
	MapPin,
	ShieldCheck,
	Phone,
	DownloadSimple,
	CaretDown,
	WarningCircle,
	Files,
	Plus,
	ClockCounterClockwise,
	TrendUp,
	ArrowDownRight,
} from "@phosphor-icons/react";

import * as XLSX from "xlsx-js-style";
import { applyStylesToSheet } from "../utils/excel";
import RentCarModal from "../components/RentCarModal";
import FinishRentModal from "../components/FinishRentModal";
import ExpenseModal from "../components/ExpenseModal";
import IncomeModal from "../components/IncomeModal";
import EditIncomeModal from "../components/EditIncomeModal";
import EditCarModal from "../components/EditCarModal";
import EditRentModal from "../components/EditRentModal";
import RentDetailsModal from "../components/RentDetailsModal";
import AddKmModal from "../components/AddKmModal";
import { PencilSimple, Camera, Envelope } from "@phosphor-icons/react";

export default function CarDetails() {
	const { plate } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { theme, toggleTheme } = useTheme();

	const [car, setCar] = useState(null);
	const [activeRental, setActiveRental] = useState(null);
	const [rentalsHistory, setRentalsHistory] = useState([]);
	const [selectedHistoryRent, setSelectedHistoryRent] = useState(null);
	const [expenses, setExpenses] = useState([]);
	const [incomes, setIncomes] = useState([]);
	const [kmLogs, setKmLogs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

	// Modals state
	const [isRentModalOpen, setIsRentModalOpen] = useState(false);
	const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);

	const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
	const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
	const [isEditCarModalOpen, setIsEditCarModalOpen] = useState(false);
	const [isEditRentModalOpen, setIsEditRentModalOpen] = useState(false);
	const [isAddKmModalOpen, setIsAddKmModalOpen] = useState(false);
	const [editingIncome, setEditingIncome] = useState(null);
	const [editingExpense, setEditingExpense] = useState(null);
	const [initialIncomeData, setInitialIncomeData] = useState(null);
	const [activeFinanceTab, setActiveFinanceTab] = useState("cronograma"); // cronograma, gastos, receitas

	const generatePaymentSchedule = (rental) => {
		if (!rental) return [];
		const dates = [];
		let currentDate = new Date(rental.start_date);
		const endDate = new Date(rental.expected_end_date);

		let diffMs = endDate - new Date(rental.start_date);
		if (diffMs < 0) diffMs = 0;
		const diffHours = diffMs / (1000 * 60 * 60);
		const diffDays = Math.max(1, Math.ceil(diffHours / 24));

		let multiplier = diffDays;
		let increment = { days: 1 };

		if (rental.rental_model === "Por Semana") {
			multiplier = Math.ceil(diffDays / 7);
			increment = { days: 7 };
		} else if (rental.rental_model === "Por Mês") {
			multiplier = Math.ceil(diffDays / 30);
			increment = { months: 1 };
		}

		const amountPerPeriod = Number(rental.total_price) / multiplier;

		for (let i = 0; i < multiplier; i++) {
			if (i === 0 && rental.first_payment_date) {
				const parts = rental.first_payment_date.split("-");
				currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
			} else {
				if (increment.months) {
					currentDate.setMonth(currentDate.getMonth() + increment.months);
				} else {
					currentDate.setDate(currentDate.getDate() + increment.days);
				}
			}

			let paymentDate = new Date(currentDate);

			dates.push({
				id: `sched-${i}`,
				date: paymentDate.toISOString().split("T")[0],
				amount: amountPerPeriod,
				period: i + 1,
				totalPeriods: multiplier,
			});
		}

		return dates;
	};

	const paymentSchedule = activeRental
		? generatePaymentSchedule(activeRental).map((sched) => {
				const matchedIncome = incomes.find(
					(inc) =>
						inc.rental_id === activeRental.id &&
						(inc.notes?.includes(
							`parcela ${sched.period}/${sched.totalPeriods}`,
						) ||
							(inc.payment_date === sched.date &&
								parseFloat(inc.amount) === parseFloat(sched.amount))),
				);
				return {
					...sched,
					isPaid: !!matchedIncome,
					paidAmount: matchedIncome ? parseFloat(matchedIncome.amount) : null,
					paidDate: matchedIncome ? matchedIncome.payment_date : null,
				};
			})
		: [];

	useEffect(() => {
		if (paymentSchedule.length > 0) {
			const firstUnpaidIndex = paymentSchedule.findIndex((s) => !s.isPaid);
			if (firstUnpaidIndex !== -1) {
				const rowId = `row-sched-${firstUnpaidIndex}`;
				const element = document.getElementById(rowId);
				if (element) {
					element.scrollIntoView({ behavior: "smooth", block: "nearest" });
				}
			}
		}
	}, [incomes, activeRental?.id]);

	const fetchData = async () => {
		if (!user || !plate) return;
		setLoading(true);
		try {
			// 1. Get Car details
			const { data: carsData, error: carError } = await supabase
				.from("cars")
				.select("*")
				.ilike("license_plate", plate)
				.eq("owner_id", user.id);

			if (carError) {
				console.error("Car fetch error:", carError);
				throw carError;
			}

			if (!carsData || carsData.length === 0) {
				console.error("Car not found");
				navigate("/dashboard");
				return;
			}

			const carData = carsData[0];
			console.log("Car found:", carData);
			setCar(carData);

			// 2. Get Rentals
			const { data: rentalsData, error: rentalsError } = await supabase
				.from("rentals")
				.select("*")
				.eq("car_id", carData.id)
				.order("created_at", { ascending: false });

			if (!rentalsError && rentalsData) {
				const active = rentalsData.find((r) => r.status === "active");
				setActiveRental(active || null);
				setRentalsHistory(rentalsData.filter((r) => r.status !== "active"));
			}

			// 3. Get Expenses
			const { data: expensesData, error: expensesError } = await supabase
				.from("expenses")
				.select("*")
				.eq("car_id", carData.id)
				.order("expense_date", { ascending: false });

			if (!expensesError && expensesData) {
				setExpenses(expensesData);
			}

			// 4. Get All Incomes for this car through its rentals
			const { data: incomesData, error: incomesError } = await supabase
				.from("incomes")
				.select("*, rentals(car_id, client_name)")
				.eq("user_id", user.id)
				.order("payment_date", { ascending: true });

			if (!incomesError && incomesData) {
				// Filter incomes that belong to this car's rentals
				const filteredIncomes = incomesData.filter(
					(inc) => inc.rentals?.car_id === carData.id,
				);
				setIncomes(filteredIncomes);
			} else if (incomesError) {
				console.error("Incomes fetch error:", incomesError);
			}

			// 5. Get KM Logs
			const { data: kmLogsData, error: kmLogsError } = await supabase
				.from("km_logs")
				.select("*")
				.eq("car_id", carData.id)
				.order("created_at", { ascending: false });

			if (!kmLogsError && kmLogsData) {
				setKmLogs(kmLogsData);
			}
		} catch (error) {
			console.error("Erro ao buscar detalhes do carro:", error);
			navigate("/dashboard");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, [plate, user?.id]);

	const handleExportAnnual = () => {
		const months = [
			"Janeiro",
			"Fevereiro",
			"Março",
			"Abril",
			"Maio",
			"Junho",
			"Julho",
			"Agosto",
			"Setembro",
			"Outubro",
			"Novembro",
			"Dezembro",
		];
		const year = new Date().getFullYear();

		// Categorias Dinâmicas iguais ao Dashboard
		const incomeCategories = ["Aluguel", "Calção"];
		const expenseCategories = Array.from(new Set((expenses || []).map(e => e.expense_type))).filter(Boolean).sort();

		const matrix = [];
		matrix.push([`PLANO ANUAL - ${car.brand} ${car.model} (${year})`]);
		matrix.push([]);
		matrix.push([null, "CATEGORIA", ...months, "TOTAL"]);

		const getMonthData = (data, monthIndex, category, type) => {
			return data
				.filter((item) => {
					const date = new Date(
						type === "income" ? item.payment_date : item.expense_date,
					);
					if (date.getFullYear() !== year) return false;
					if (date.getMonth() !== monthIndex) return false;

					if (type === "income") {
						if (category === "Aluguel")
							return !item.notes?.toLowerCase().includes("calção");
						if (category === "Calção")
							return item.notes?.toLowerCase().includes("calção");
						return false;
					} else {
						return item.expense_type === category;
					}
				})
				.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
		};

		matrix.push(["RECEITAS"]);
		incomeCategories.forEach((cat) => {
			const row = [null, cat];
			let rowTotal = 0;
			months.forEach((_, i) => {
				const val = getMonthData(incomes, i, cat, "income");
				row.push(val);
				rowTotal += val;
			});
			row.push(rowTotal);
			matrix.push(row);
		});
		matrix.push([]);

		matrix.push(["AUTOMÓVEL"]);
		expenseCategories.forEach((cat) => {
			const row = [null, cat];
			let rowTotal = 0;
			months.forEach((_, i) => {
				const val = getMonthData(expenses, i, cat, "expense");
				row.push(val);
				rowTotal += val;
			});
			row.push(rowTotal);
			matrix.push(row);
		});
		matrix.push([]);

		matrix.push([null, "TOTAIS", ...months, "TOTAL"]);

		const rendimentosRow = [null, "Rendimentos"];
		const gastosRow = [null, "Gastos"];
		const saldoRow = [null, "Saldo do Mês"];
		const acumuladoRow = [null, "Saldo Acumulado"];

		let totalRendimentos = 0;
		let totalGastos = 0;
		let saldoAcumulado = 0;

		months.forEach((_, i) => {
			const mExpenses = expenses
				.filter((exp) => {
					const d = new Date(exp.expense_date);
					return d.getFullYear() === year && d.getMonth() === i;
				})
				.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

			const mIncomes = incomes
				.filter((inc) => {
					const d = new Date(inc.payment_date);
					return d.getFullYear() === year && d.getMonth() === i;
				})
				.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

			rendimentosRow.push(mIncomes);
			gastosRow.push(mExpenses);
			const saldoMes = mIncomes - mExpenses;
			saldoRow.push(saldoMes);
			saldoAcumulado += saldoMes;
			acumuladoRow.push(saldoAcumulado);

			totalRendimentos += mIncomes;
			totalGastos += mExpenses;
		});

		rendimentosRow.push(totalRendimentos);
		gastosRow.push(totalGastos);
		saldoRow.push(totalRendimentos - totalGastos);
		acumuladoRow.push(saldoAcumulado);

		matrix.push(rendimentosRow);
		matrix.push(gastosRow);
		matrix.push(saldoRow);
		matrix.push(acumuladoRow);

		const ws = XLSX.utils.aoa_to_sheet(matrix);
		
		// Aplica cores e bordas!
		applyStylesToSheet(ws);

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, car.license_plate ? car.license_plate.toUpperCase() : "Plano Anual");
		XLSX.writeFile(wb, `PLANO_ANUAL_${car.brand}_${car.model}_${year}.xlsx`);
	};

	const calculateDaysRented = (startDate) => {
		const start = new Date(startDate);
		const today = new Date();
		const diffTime = Math.abs(today - start);
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	};

	const kmHistory = useMemo(() => {
		const history = [];
		const allRentals = [...rentalsHistory];
		if (activeRental) allRentals.push(activeRental);

		allRentals.forEach((rent) => {
			if (rent.initial_km) {
				history.push({
					id: `start-${rent.id}`,
					date: rent.start_date,
					km: rent.initial_km,
					label: `Início: ${rent.client_name.split(" ")[0]}`,
					type: "start",
				});
			}
			if (rent.final_km && rent.actual_end_date) {
				history.push({
					id: `end-${rent.id}`,
					date: rent.actual_end_date,
					km: rent.final_km,
					label: `Fim: ${rent.client_name.split(" ")[0]}`,
					type: "end",
				});
			}
		});

		kmLogs.forEach((log) => {
			history.push({
				id: `log-${log.id}`,
				date: log.date,
				km: log.km,
				label: log.notes ? `Avulso: ${log.notes}` : `Lançamento Avulso`,
				type: "avulso",
			});
		});

		return history.sort((a, b) => new Date(b.date) - new Date(a.date));
	}, [activeRental, rentalsHistory, kmLogs]);

	const realCurrentKm = useMemo(() => {
		const baseKm = car?.current_km || 0;
		if (!kmHistory || kmHistory.length === 0) return baseKm;
		const maxHistoryKm = Math.max(...kmHistory.map(h => h.km || 0));
		return Math.max(baseKm, maxHistoryKm);
	}, [car?.current_km, kmHistory]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<CircleNotch className="w-8 h-8 text-primary animate-spin" />
			</div>
		);
	}

	if (!car) return null;

	return (
		<div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
			{/* Cabeçalho da Página e Ações Rápidas integradas */}
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-6 glass p-6 rounded-3xl border border-border-color shadow-sm">
				<div>
					<Link
						to="/dashboard"
						className="inline-flex items-center gap-2 text-muted-olive hover:text-primary transition-colors mb-2 text-sm font-bold group">
						<ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
						Voltar ao Dashboard
					</Link>
					<h1 className="text-3xl sm:text-4xl font-black text-main flex flex-wrap items-center gap-3">
						{car.brand} {car.model}
						<span className="px-3 py-1 rounded-xl bg-primary/10 text-primary text-sm sm:text-base font-black uppercase tracking-widest border border-primary/20">
							{car.license_plate}
						</span>
					</h1>
				</div>

				<div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
					{activeRental ? (
						<button
							onClick={() => setIsFinishModalOpen(true)}
							className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 w-full sm:w-auto">
							<CheckCircle className="w-5 h-5" /> Encerrar Aluguel
						</button>
					) : car.status !== "Manutenção" ? (
						<button
							onClick={() => setIsRentModalOpen(true)}
							className="bg-accent hover:opacity-90 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 w-full sm:w-auto">
							<PlayCircle className="w-5 h-5" /> Iniciar Aluguel
						</button>
					) : null}

					<button
						onClick={() => setIsExpenseModalOpen(true)}
						className="bg-danger hover:bg-danger-hover text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-danger/20 w-full sm:w-auto">
						<CurrencyDollar className="w-5 h-5" /> Lançar Despesa
					</button>

					<button
						onClick={handleExportAnnual}
						className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-main px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-border-color/50 w-full sm:w-auto shadow-sm">
						<DownloadSimple className="w-5 h-5" />
						Exportar
					</button>
				</div>
			</div>

			{/* Indicadores de Desempenho (KPIs) */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
				<div className="glass rounded-3xl p-6 border border-border-color/50 shadow-sm relative group hover:-translate-y-1 transition-transform">
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-2">
						Total Faturado
					</p>
					<p className="text-3xl font-black text-success">
						<span className="text-sm font-bold mr-1">R$</span>
						{incomes
							.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
							.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
					</p>
					<div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-lg bg-success/10 text-[10px] text-success font-bold w-max">
						<TrendUp className="w-3.5 h-3.5" /> Receita Bruta Acumulada
					</div>
				</div>

				<div className="glass rounded-3xl p-6 border border-border-color/50 shadow-sm relative group hover:-translate-y-1 transition-transform">
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-2">
						Total em Gastos
					</p>
					<p className="text-3xl font-black text-danger">
						<span className="text-sm font-bold mr-1">R$</span>
						{expenses
							.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
							.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
					</p>
					<div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-lg bg-danger/10 text-[10px] text-danger font-bold w-max">
						<ArrowDownRight className="w-3.5 h-3.5" /> Saídas e Manutenções
					</div>
				</div>

				<div className="glass rounded-3xl p-6 border border-border-color/50 shadow-sm relative group hover:-translate-y-1 transition-transform">
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-2">
						Saldo Líquido
					</p>
					<p
						className={`text-3xl font-black ${incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) - expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) >= 0 ? "text-primary" : "text-danger"}`}>
						<span className="text-sm font-bold mr-1">R$</span>
						{(
							incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) -
							expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
						).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
					</p>
					<div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-lg bg-primary/10 text-[10px] text-primary font-bold w-max">
						<CurrencyDollar className="w-3.5 h-3.5" /> Resultado do Ativo
					</div>
				</div>

				<div className="glass rounded-3xl p-6 border border-border-color/50 shadow-sm relative group hover:-translate-y-1 transition-transform">
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-2">
						Quilometragem
					</p>
					<p className="text-3xl font-black text-main">
						{realCurrentKm.toLocaleString("pt-BR")}{" "}
						<span className="text-xs font-medium text-muted-olive">km</span>
					</p>
					<div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-lg bg-accent/10 text-[10px] text-accent font-bold w-max">
						<MapPin className="w-3.5 h-3.5" /> Rodagem Atual
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Coluna Esquerda: Dados Técnicos */}
				<div className="lg:col-span-1 space-y-8">
					{/* Card Info do Carro */}
					<div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold flex items-center gap-2">
								<Car className="w-5 h-5 text-accent" />
								Detalhes do Veículo
							</h3>
							<button
								onClick={() => setIsEditCarModalOpen(true)}
								className="p-1.5 px-2.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
								<PencilSimple className="w-3 h-3" /> Editar
							</button>
						</div>

						<div className="space-y-4">
							<div className="flex justify-between items-center pb-3 border-b border-border-color">
								<span className="text-muted-olive text-sm font-medium">
									Ano
								</span>
								<span className="font-bold">{car.year}</span>
							</div>
							<div className="flex justify-between items-center pb-3 border-b border-border-color">
								<span className="text-muted-olive text-sm font-medium">
									Status
								</span>
								<span
									className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
										car.status === "Disponível"
											? "bg-accent/20 text-accent border border-accent/30"
											: car.status === "Alugado"
												? "bg-primary/20 text-primary border border-primary/20"
												: "bg-danger/20 text-danger border border-danger/20"
									}`}>
									{car.status}
								</span>
							</div>
							<div className="flex justify-between items-center pb-3 border-b border-border-color">
								<span className="text-muted-olive text-sm font-medium">
									Cor
								</span>
								<span className="font-bold">{car.color || "-"}</span>
							</div>
							<div className="flex justify-between items-center pb-3 border-b border-border-color">
								<span className="text-muted-olive text-sm font-medium">
									Valor de Compra
								</span>
								<span className="font-bold">
									R${" "}
									{car.purchase_price?.toLocaleString("pt-BR", {
										minimumFractionDigits: 2,
									})}
								</span>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-muted-olive text-sm font-medium">
									Renavam
								</span>
								<span className="font-bold">{car.renavam || "-"}</span>
							</div>
						</div>
					</div>

					{/* Histórico de Quilometragem */}
					<div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-bold flex items-center gap-2">
								<MapPin className="w-5 h-5 text-accent" />
								Quilometragem
							</h3>
							<button
								onClick={() => setIsAddKmModalOpen(true)}
								className="p-1.5 px-2.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
								<Plus className="w-3 h-3" /> Lançar
							</button>
						</div>

						<div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
							{kmHistory.length === 0 ? (
								<p className="text-sm text-muted-olive text-center py-4">
									Nenhum registro.
								</p>
							) : (
								kmHistory.map((record) => (
									<div
										key={record.id}
										className="flex flex-wrap justify-between items-center gap-2 p-3 rounded-xl bg-primary/5 border border-border-color">
										<div>
											<p className="font-bold text-main">
												{record.km.toLocaleString()}{" "}
												<span className="text-xs font-medium text-muted-olive">
													km
												</span>
											</p>
											<p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mt-1">
												{new Date(record.date).toLocaleDateString("pt-BR")}
											</p>
										</div>
										<div className="text-left mt-1 sm:mt-0 sm:text-right">
											<span
												className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md inline-block whitespace-nowrap ${record.type === "start" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}>
												{record.label}
											</span>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				{/* Coluna Direita: Operacional e Financeiro */}
				<div className="lg:col-span-2 space-y-8">
					{/* Aluguel Ativo (Destaque) */}
					{activeRental ? (
						<div className="bg-primary/5 dark:bg-primary-dark/20 border border-primary/20 rounded-2xl p-6 relative overflow-hidden shadow-sm">
							<div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl"></div>
							<div className="flex justify-between items-center mb-6 relative z-10">
								<h3 className="text-xl font-black flex items-center gap-2 text-main">
									<CheckCircle className="w-6 h-6 text-primary" />
									Contrato Atual
								</h3>
								<button
									onClick={() => setIsEditRentModalOpen(true)}
									className="px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 border border-accent/20">
									<PencilSimple className="w-4 h-4" /> Editar Contrato
								</button>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
								<div className="space-y-5">
									<div className="space-y-3">
										<p className="text-lg font-black flex items-center gap-2">
											<User className="w-5 h-5 text-accent" />{" "}
											{activeRental.client_name}
										</p>
										<p className="text-sm text-main flex items-center gap-2">
											<Phone
												className="w-4 h-4 text-muted-olive"
												weight="fill"
											/>{" "}
											{activeRental.client_contact}
										</p>
										{activeRental.client_email && (
											<p className="text-sm text-main flex items-center gap-2">
												<Envelope
													className="w-4 h-4 text-muted-olive"
													weight="fill"
												/>{" "}
												{activeRental.client_email}
											</p>
										)}
										<p className="text-sm text-main flex items-center gap-2">
											<ShieldCheck
												className="w-4 h-4 text-muted-olive"
												weight="fill"
											/>
											<span className="text-muted-olive font-bold">
												Documento:
											</span>{" "}
											{activeRental.client_document || "-"}
										</p>
									</div>

									<div className="pt-4 border-t border-accent/10">
										<div className="flex flex-wrap gap-2">
											{[
												{ url: activeRental.uber_file_url, label: "Uber" },
												{
													url: activeRental.criminal_record_file_url,
													label: "Criminal",
												},
												{ url: activeRental.cnh_ear_file_url, label: "EAR" },
												{
													url: activeRental.residence_proof_file_url,
													label: "Endereço",
												},
												{ url: activeRental.sne_file_url, label: "SNE" },
											].map(
												(doc) =>
													doc.url && (
														<a
															key={doc.label}
															href={doc.url}
															target="_blank"
															rel="noopener noreferrer"
															className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase border border-primary/20 hover:scale-105 transition-transform">
															<FileText className="w-3.5 h-3.5" /> {doc.label}
														</a>
													),
											)}
										</div>
									</div>

									{/* Vistoria Inicial (Nova Seção) */}
									{activeRental.start_inspection_urls?.length > 0 && (
										<div className="pt-4 border-t border-accent/10 space-y-3">
											<div className="flex items-center justify-between">
												<p className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2">
													<Camera className="w-4 h-4" /> Vistoria de Retirada
												</p>
											</div>
											<div className="flex flex-wrap gap-2">
												{activeRental.start_inspection_urls.map((url, idx) => (
													<a
														key={idx}
														href={url}
														target="_blank"
														rel="noopener noreferrer"
														className="w-12 h-12 rounded-lg overflow-hidden border border-accent/20 hover:border-accent transition-colors shadow-sm">
														<img
															src={url}
															alt={`Vistoria ${idx}`}
															className="w-full h-full object-cover"
														/>
													</a>
												))}
											</div>
											{activeRental.start_inspection_notes && (
												<p className="text-[10px] text-muted-olive italic bg-white/30 dark:bg-slate-950/30 p-2 rounded-lg border border-border-color/50">
													"{activeRental.start_inspection_notes}"
												</p>
											)}
										</div>
									)}
								</div>

								<div className="space-y-4">
									{(() => {
										const rentStart = new Date(activeRental.start_date);
										const rentEnd = new Date(activeRental.expected_end_date);
										const today = new Date();
                                        
                                        const totalDays = Math.max(1, Math.ceil((rentEnd - rentStart) / (1000 * 60 * 60 * 24)));
                                        const currentDays = Math.max(0, Math.ceil((today - rentStart) / (1000 * 60 * 60 * 24)));
                                        const progressPercent = Math.min(100, Math.max(0, (currentDays / totalDays) * 100));

										return (
											<div className="bg-white/60 dark:bg-slate-900/60 p-5 rounded-2xl border border-border-color shadow-sm space-y-4">
												<div className="flex justify-between items-center">
													<div>
														<p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Início do Contrato</p>
														<p className="font-black text-main">{rentStart.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
													</div>
													<div className="text-right">
														<p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Devolução Prevista</p>
														<p className="font-black text-main">{rentEnd.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
													</div>
												</div>
                                                
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[10px] font-bold text-muted-olive uppercase">
                                                        <span>Progresso do Aluguel</span>
                                                        <span>{Math.floor(progressPercent)}% concluído</span>
                                                    </div>
                                                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                        <div className="bg-primary h-2 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                                                    </div>
                                                    <p className="text-right text-[10px] font-bold text-muted-olive">Restam {Math.max(0, totalDays - currentDays)} dias</p>
                                                </div>

												<div className="pt-3 border-t border-border-color/50 flex justify-between items-center">
													<div>
														<p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Status</p>
														<p className="font-black text-accent">Em Andamento</p>
													</div>
													<div className="text-right">
														<p className="text-[10px] text-muted-olive uppercase font-bold mb-1">Valor Total</p>
														<p className="font-black text-primary text-lg">R$ {Number(activeRental.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
													</div>
												</div>
											</div>
										)
									})()}
								</div>
							</div>
						</div>
					) : (
						<div className="glass rounded-2xl p-12 border border-border-color text-center bg-primary/5">
							<CheckCircle className="w-12 h-12 text-primary mx-auto mb-4 opacity-30" />
							<h3 className="text-xl font-black mb-2 text-main">
								Disponível para Aluguel
							</h3>
							<p className="text-muted-olive mb-6 max-w-xs mx-auto">
								Este veículo está sem contrato ativo. Inicie um novo aluguel
								para gerar receita.
							</p>
							<button
								onClick={() => setIsRentModalOpen(true)}
								className="bg-primary hover:opacity-90 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary/20">
								+ Iniciar Novo Contrato
							</button>
						</div>
					)}


				</div>
			</div>

					{/* Abas de Fluxo Financeiro Detalhado */}
					<div className="glass rounded-3xl p-6 border border-border-color shadow-sm">
                        <div className="flex flex-col sm:flex-row bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-6 gap-1">
							<button
								onClick={() => setActiveFinanceTab("cronograma")}
								className={`flex-1 py-3 px-4 text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl ${activeFinanceTab === "cronograma" ? "bg-white dark:bg-slate-700 text-accent shadow-sm" : "text-muted-olive hover:text-accent hover:bg-white/50"}`}>
								<Calendar className="w-4 h-4" /> Cronograma
							</button>
							<button
								onClick={() => setActiveFinanceTab("gastos")}
								className={`flex-1 py-3 px-4 text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl ${activeFinanceTab === "gastos" ? "bg-white dark:bg-slate-700 text-danger shadow-sm" : "text-muted-olive hover:text-danger hover:bg-white/50"}`}>
								<Wrench className="w-4 h-4" /> Gastos
							</button>
							<button
								onClick={() => setActiveFinanceTab("receitas")}
								className={`flex-1 py-3 px-4 text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl ${activeFinanceTab === "receitas" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-muted-olive hover:text-primary hover:bg-white/50"}`}>
								<CurrencyDollar className="w-4 h-4" /> Receitas
							</button>
						</div>

						<div className="p-0 bg-white/60 dark:bg-slate-950/40 rounded-2xl overflow-hidden border border-border-color/50">
							{activeFinanceTab === "cronograma" ? (
								<div className="overflow-x-auto">
									<table className="w-full text-left">
										<thead className="bg-bg-main/30 border-b border-border-color">
											<tr className="text-[10px] uppercase font-black tracking-widest text-muted-olive">
												<th className="py-3 px-6">Vencimento</th>
												<th className="py-3 px-6">Parcela</th>
												<th className="py-3 px-6">Valor</th>
												<th className="py-3 px-6">Status</th>
												<th className="py-3 px-6">Ação</th>
											</tr>
										</thead>
										<tbody className="text-sm">
											{paymentSchedule.length === 0 ? (
												<tr>
													<td
														colSpan="5"
														className="py-8 text-center italic text-muted-olive">
														Nenhum contrato ativo para gerar cronograma.
													</td>
												</tr>
											) : (
												paymentSchedule.map((sched) => (
													<tr
														key={sched.id}
														id={`row-${sched.id}`}
														className={`border-b border-border-color last:border-0 hover:bg-accent/5 ${sched.isPaid ? "opacity-50" : ""}`}>
														<td className="py-4 px-6 font-bold text-main">
															{sched.isPaid && sched.paidDate !== sched.date ? (
																<div className="flex flex-col leading-tight">
																	<span className="line-through text-[10px] text-muted-olive">
																		{new Date(sched.date).toLocaleDateString(
																			"pt-BR",
																			{ timeZone: "UTC" },
																		)}
																	</span>
																	<span className="text-success">
																		{new Date(
																			sched.paidDate,
																		).toLocaleDateString("pt-BR", {
																			timeZone: "UTC",
																		})}
																	</span>
																</div>
															) : (
																new Date(sched.date).toLocaleDateString(
																	"pt-BR",
																	{ timeZone: "UTC" },
																)
															)}
														</td>
														<td className="py-4 px-6 text-muted-olive text-xs">
															{sched.period}/{sched.totalPeriods}
														</td>
														<td className="py-4 px-6 font-bold text-main">
															{sched.isPaid &&
															sched.paidAmount !== sched.amount ? (
																<div className="flex flex-col leading-tight">
																	<span className="line-through text-[10px] text-muted-olive">
																		R${" "}
																		{Number(sched.amount).toLocaleString(
																			"pt-BR",
																			{ minimumFractionDigits: 2 },
																		)}
																	</span>
																	<span className="text-success">
																		R${" "}
																		{Number(sched.paidAmount).toLocaleString(
																			"pt-BR",
																			{ minimumFractionDigits: 2 },
																		)}
																	</span>
																</div>
															) : (
																<span>
																	R${" "}
																	{Number(sched.amount).toLocaleString(
																		"pt-BR",
																		{ minimumFractionDigits: 2 },
																	)}
																</span>
															)}
														</td>
														<td className="py-4 px-6">
															{sched.isPaid ? (
																<span className="px-2.5 py-1 rounded-lg bg-success/10 text-success text-[10px] font-black uppercase border border-success/20 flex items-center gap-1 w-max">
																	<CheckCircle className="w-3 h-3" /> Pago
																</span>
															) : (
																<span className="px-2.5 py-1 rounded-lg bg-warning/10 text-warning text-[10px] font-black uppercase border border-warning/20 flex items-center gap-1 w-max">
																	<ClockCounterClockwise className="w-3 h-3" />{" "}
																	Pendente
																</span>
															)}
														</td>
														<td className="py-4 px-6">
															{!sched.isPaid ? (
																<button
																	onClick={() => {
																		setInitialIncomeData({
																			date: sched.date,
																			amount: sched.amount,
																			notes: `Pagamento da parcela ${sched.period}/${sched.totalPeriods} do aluguel ativo.`,
																		});
																		setIsIncomeModalOpen(true);
																	}}
																	className="bg-accent hover:bg-accent/90 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm shadow-accent/20 transition-all flex items-center gap-1">
																	<CurrencyDollar className="w-3 h-3" /> Lançar
																</button>
															) : (
																<span className="text-[10px] uppercase font-bold text-muted-olive">
																	Confirmado
																</span>
															)}
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							) : activeFinanceTab === "gastos" ? (
								<div className="overflow-x-auto">
									<table className="w-full text-left">
										<thead className="bg-bg-main/30 border-b border-border-color">
											<tr className="text-[10px] uppercase font-black tracking-widest text-muted-olive">
												<th className="py-3 px-6">Data</th>
												<th className="py-3 px-6">Categoria</th>
												<th className="py-3 px-6">Valor</th>
												<th className="py-3 px-6">Nota</th>
												<th className="py-3 px-6">Ação</th>
											</tr>
										</thead>
										<tbody className="text-sm">
											{expenses.length === 0 ? (
												<tr>
													<td
														colSpan="4"
														className="py-8 text-center italic text-muted-olive">
														Nenhum gasto registrado.
													</td>
												</tr>
											) : (
												expenses.map((exp) => (
													<tr
														key={exp.id}
														className="border-b border-border-color last:border-0 hover:bg-danger/5">
														<td className="py-4 px-6">
															{new Date(exp.expense_date).toLocaleDateString(
																"pt-BR",
																{ timeZone: "UTC" },
															)}
														</td>
														<td className="py-4 px-6">
															<span className="px-2 py-0.5 rounded-md bg-danger/10 text-danger text-[10px] font-black uppercase">
																{exp.expense_type}
															</span>
														</td>
														<td className="py-4 px-6 font-bold text-danger">
															R${" "}
															{Number(exp.amount).toLocaleString("pt-BR", {
																minimumFractionDigits: 2,
															})}
														</td>
														<td className="py-4 px-6 text-xs text-muted-olive max-w-[200px] sm:max-w-xs break-words whitespace-normal leading-relaxed">
															{exp.description || "-"}
														</td>
														<td className="py-4 px-6 text-right">
															<button
																onClick={() => setEditingExpense(exp)}
																className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors shadow-sm border border-accent/10"
																title="Editar Despesa">
																<PencilSimple className="w-4 h-4" />
															</button>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-left">
										<thead className="bg-bg-main/30 border-b border-border-color">
											<tr className="text-[10px] uppercase font-black tracking-widest text-muted-olive">
												<th className="py-3 px-6">Data</th>
												<th className="py-3 px-6">Método</th>
												<th className="py-3 px-6">Valor</th>
												<th className="py-3 px-6">Nota</th>
												<th className="py-3 px-6 text-right">Ação</th>
											</tr>
										</thead>
										<tbody className="text-sm">
											{incomes.length === 0 ? (
												<tr>
													<td
														colSpan="5"
														className="py-8 text-center italic text-muted-olive">
														Nenhuma receita registrada.
													</td>
												</tr>
											) : (
												incomes.map((inc) => (
													<tr
														key={inc.id}
														className="border-b border-border-color last:border-0 hover:bg-primary/5">
														<td className="py-4 px-6">
															{new Date(inc.payment_date).toLocaleDateString(
																"pt-BR",
																{ timeZone: "UTC" },
															)}
														</td>
														<td className="py-4 px-6 font-medium">
															{inc.payment_method}
														</td>
														<td className="py-4 px-6 font-bold text-primary">
															R${" "}
															{Number(inc.amount).toLocaleString("pt-BR", {
																minimumFractionDigits: 2,
															})}
														</td>
														<td className="py-4 px-6 text-xs text-muted-olive max-w-[200px] sm:max-w-xs break-words whitespace-normal leading-relaxed">
															{inc.notes || "-"}
														</td>
														<td className="py-4 px-6 text-right">
															<button
																onClick={() => setEditingIncome(inc)}
																className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors shadow-sm border border-accent/10"
																title="Editar Receita">
																<PencilSimple className="w-4 h-4" />
															</button>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
					{/* Histórico de Aluguéis */}
					<div className="glass rounded-2xl p-6 border border-border-color shadow-sm">
						<h3 className="text-lg font-black mb-6 flex items-center gap-2 text-main">
							<ClockCounterClockwise className="w-5 h-5 text-muted-olive" />
							Histórico de Contratos
						</h3>

						{rentalsHistory.length === 0 ? (
							<p className="text-sm text-muted-olive py-4 text-center italic">
								Sem contratos anteriores.
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse">
									<thead>
										<tr className="border-b border-border-color text-[10px] uppercase font-black tracking-widest text-muted-olive">
											<th className="pb-3">Cliente</th>
											<th className="pb-3">Período</th>
											<th className="pb-3 text-right">Total</th>
										</tr>
									</thead>
									<tbody className="text-sm">
										{rentalsHistory.map((rent) => (
											<tr
												key={rent.id}
												onClick={() => setSelectedHistoryRent(rent)}
												className="border-b border-border-color last:border-0 hover:bg-primary/5 transition-colors cursor-pointer">
												<td className="py-4">
													<p className="font-bold text-main">
														{rent.client_name}
													</p>
												</td>
												<td className="py-4 text-xs text-muted-olive">
													{new Date(rent.start_date).toLocaleDateString(
														"pt-BR",
													)}{" "}
													-{" "}
													{new Date(
														rent.actual_end_date || rent.expected_end_date,
													).toLocaleDateString("pt-BR")}
												</td>
												<td className="py-4 text-right font-black text-primary">
													R${" "}
													{Number(rent.total_price).toLocaleString("pt-BR", {
														minimumFractionDigits: 2,
													})}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>

			{/* Modals */}
			{isRentModalOpen && (
				<RentCarModal
					car={car}
					onClose={() => setIsRentModalOpen(false)}
					onSuccess={fetchData}
				/>
			)}

			{isFinishModalOpen && activeRental && (
				<FinishRentModal
					rental={activeRental}
					car={car}
					onClose={() => setIsFinishModalOpen(false)}
					onSuccess={fetchData}
				/>
			)}

			{(isExpenseModalOpen || editingExpense) && (
				<ExpenseModal
					car={car}
					expense={editingExpense}
					onClose={() => {
						setIsExpenseModalOpen(false);
						setEditingExpense(null);
					}}
					onSuccess={fetchData}
				/>
			)}

			{isIncomeModalOpen && activeRental && (
				<IncomeModal
					rental={activeRental}
					initialData={initialIncomeData}
					onClose={() => {
						setIsIncomeModalOpen(false);
						setInitialIncomeData(null);
					}}
					onSuccess={fetchData}
				/>
			)}

			{isEditCarModalOpen && car && (
				<EditCarModal
					car={car}
					onClose={() => setIsEditCarModalOpen(false)}
					onSuccess={(newPlate) => {
						if (newPlate !== car.license_plate) {
							navigate(`/car/${newPlate}`);
						} else {
							fetchData();
						}
					}}
				/>
			)}

			{isEditRentModalOpen && activeRental && (
				<EditRentModal
					rental={activeRental}
					car={car}
					onClose={() => setIsEditRentModalOpen(false)}
					onSuccess={fetchData}
				/>
			)}

			{editingIncome && (
				<EditIncomeModal
					income={editingIncome}
					onClose={() => setEditingIncome(null)}
					onSuccess={fetchData}
				/>
			)}
			{selectedHistoryRent && (
				<RentDetailsModal
					rental={selectedHistoryRent}
					onClose={() => setSelectedHistoryRent(null)}
				/>
			)}

			{isAddKmModalOpen && (
				<AddKmModal
					car={car}
					onClose={() => setIsAddKmModalOpen(false)}
					onSuccess={fetchData}
				/>
			)}
		</div>
	);
}
