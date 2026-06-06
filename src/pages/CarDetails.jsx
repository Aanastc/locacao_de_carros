import { useState, useEffect, useMemo, useRef } from "react";
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
	PencilSimple,
	Trash,
	ArrowCounterClockwise,
	Camera,
	Envelope,
	X,
	WarningOctagon,
	CaretLeft,
	CaretRight
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
import InsuranceModal from "../components/InsuranceModal";
import IncidentModal from "../components/IncidentModal";
import EditScheduledExpenseModal from "../components/EditScheduledExpenseModal";


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
	const [insurances, setInsurances] = useState([]);
	const [scheduledExpenses, setScheduledExpenses] = useState([]);
	const [rentalIncidents, setRentalIncidents] = useState([]);
	const [kmLogs, setKmLogs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

	// Modals state
	const [isRentModalOpen, setIsRentModalOpen] = useState(false);
	const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);

	const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
	const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState(false);
	const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
	const [showInsuranceAlert, setShowInsuranceAlert] = useState(false);
	const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
	const [isEditCarModalOpen, setIsEditCarModalOpen] = useState(false);
	const [isEditRentModalOpen, setIsEditRentModalOpen] = useState(false);
	const [isAddKmModalOpen, setIsAddKmModalOpen] = useState(false);
	const [editingKm, setEditingKm] = useState(null);
    
    // Finance Tab State
    const [financeMonth, setFinanceMonth] = useState("all");
	const [financeYear, setFinanceYear] = useState(new Date().getFullYear());
	const [financeType, setFinanceType] = useState("all"); // Filtro de tipo no cronograma
    const [editingScheduledExpense, setEditingScheduledExpense] = useState(null);
	const [editingIncome, setEditingIncome] = useState(null);
	const [editingExpense, setEditingExpense] = useState(null);
	const [initialIncomeData, setInitialIncomeData] = useState(null);
	const [activeFinanceTab, setActiveFinanceTab] = useState("cronograma"); // cronograma, gastos, receitas

	const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);

	const handleNextImage = () => {
		setCurrentGalleryIndex((prev) => (prev + 1) % galleryImages.length);
	};

	const handlePrevImage = () => {
		setCurrentGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
	};

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

	const paymentSchedule = useMemo(() => {
		const unifiedSchedule = [];

		if (activeRental) {
			const rentalSchedule = generatePaymentSchedule(activeRental).map((sched) => {
				const matchedIncome = incomes.find(
					(inc) =>
						inc.rental_id === activeRental.id &&
						(inc.notes?.includes(`parcela ${sched.period}/${sched.totalPeriods}`) ||
							(inc.payment_date === sched.date && parseFloat(inc.amount) === parseFloat(sched.amount)))
				);
				return {
					...sched,
					isPaid: !!matchedIncome,
					paidAmount: matchedIncome ? parseFloat(matchedIncome.amount) : null,
					paidDate: matchedIncome ? matchedIncome.payment_date : null,
					incomeId: matchedIncome ? matchedIncome.id : null,
					type: 'Receita'
				};
			});
			unifiedSchedule.push(...rentalSchedule);
		}

		scheduledExpenses.forEach(exp => {
			unifiedSchedule.push({
				id: exp.id,
				date: exp.due_date,
				amount: exp.amount,
				isPaid: exp.status === 'Pago',
				paidDate: exp.status === 'Pago' ? exp.due_date : null,
				paidAmount: exp.status === 'Pago' ? exp.amount : 0,
				type: exp.expense_type === 'Reembolso Sinistro' ? 'Receita' : 'Despesa',
				description: exp.description,
				period: '-',
				totalPeriods: '-'
			});
		});

		return unifiedSchedule.sort((a, b) => new Date(a.date) - new Date(b.date));
	}, [activeRental, incomes, scheduledExpenses]);

    const filteredPaymentSchedule = useMemo(() => {
        return paymentSchedule.filter(sched => {
            const d = new Date(sched.date + 'T12:00:00');
            
            const matchYear = d.getFullYear() === financeYear;
            const matchMonth = financeMonth === 'all' ? true : (d.getMonth() + 1) === parseInt(financeMonth);
            const matchType = financeType === 'all' ? true : sched.type === financeType;

            return matchYear && matchMonth && matchType;
        });
    }, [paymentSchedule, financeMonth, financeYear, financeType]);

	const handlePayScheduledExpense = async (schedId) => {
		try {
			const expense = scheduledExpenses.find(e => e.id === schedId);
			if (!expense) return;

			setLoading(true);
			const { data: expData, error: expError } = await supabase.from('expenses').insert([{
				car_id: car.id,
				user_id: user.id,
				expense_type: expense.expense_type,
				amount: expense.amount,
				expense_date: expense.due_date,
				description: expense.description
			}]).select().single();

			if (expError) throw expError;

			const { error: updError } = await supabase.from('scheduled_expenses').update({
				status: 'Pago',
				expense_id: expData.id
			}).eq('id', schedId);

			if (updError) throw updError;

			fetchData();
		} catch (error) {
			console.error('Erro ao pagar despesa agendada', error);
			alert('Erro ao processar pagamento.');
		} finally {
			setLoading(false);
		}
	};

	const handleReceiveScheduledExpense = async (schedId) => {
		try {
			const expense = scheduledExpenses.find(e => e.id === schedId);
			if (!expense) return;

			if (!activeRental) {
				alert("É necessário ter um contrato ativo para vincular este recebimento agendado.");
				return;
			}

			setLoading(true);
			const { data: incData, error: incError } = await supabase.from('incomes').insert([{
				rental_id: activeRental.id,
				user_id: user.id,
				amount: expense.amount,
				payment_date: expense.due_date,
				payment_method: 'Pix',
				notes: expense.description || 'Recebimento de agendamento'
			}]).select().single();

			if (incError) throw incError;

			const { error: updError } = await supabase.from('scheduled_expenses').update({
				status: 'Pago'
			}).eq('id', schedId);

			if (updError) throw updError;

			fetchData();
		} catch (error) {
			console.error('Erro ao receber agendamento', error);
			alert('Erro ao processar recebimento.');
		} finally {
			setLoading(false);
		}
	};

	const handleRevertPayment = async (sched) => {
		if (!window.confirm("Deseja realmente reverter este pagamento? O registro correspondente (gasto ou entrada) será excluído.")) return;

		setLoading(true);
		try {
			if (sched.type === 'Despesa') {
				const { data: seData, error: seError } = await supabase.from('scheduled_expenses').select('expense_id').eq('id', sched.id).single();
				if (seError) throw seError;

				const { error: updError } = await supabase.from('scheduled_expenses').update({
					status: 'Pendente',
					expense_id: null
				}).eq('id', sched.id);
				if (updError) throw updError;

				if (seData.expense_id) {
					const { error: delError } = await supabase.from('expenses').delete().eq('id', seData.expense_id);
					if (delError) throw delError;
				}
			} else {
				if (sched.period === '-') {
					const { error: updError } = await supabase.from('scheduled_expenses').update({
						status: 'Pendente'
					}).eq('id', sched.id);
					if (updError) throw updError;
				} else if (sched.incomeId) {
					const { error: delError } = await supabase.from('incomes').delete().eq('id', sched.incomeId);
					if (delError) throw delError;
				}
			}

			fetchData();
		} catch (error) {
			console.error("Erro ao reverter pagamento", error);
			alert("Erro ao reverter pagamento.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (activeFinanceTab === "cronograma" && filteredPaymentSchedule.length > 0) {
			const lastPaidIndex = filteredPaymentSchedule.findLastIndex(s => s.isPaid);
			let targetItem = null;

			if (lastPaidIndex !== -1 && lastPaidIndex < filteredPaymentSchedule.length - 1) {
				targetItem = filteredPaymentSchedule[lastPaidIndex + 1];
			} else if (lastPaidIndex === -1 && filteredPaymentSchedule.length > 0) {
				targetItem = filteredPaymentSchedule[0];
			} else if (lastPaidIndex === filteredPaymentSchedule.length - 1) {
				targetItem = filteredPaymentSchedule[lastPaidIndex];
			}

			if (targetItem) {
				const rowId = `row-${targetItem.id}`;
				setTimeout(() => {
					const element = document.getElementById(rowId);
					const container = document.getElementById("cronograma-container");
					if (element && container) {
						const containerRect = container.getBoundingClientRect();
						const elementRect = element.getBoundingClientRect();
						const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2) + (elementRect.height / 2);
						container.scrollTo({ top: scrollTop, behavior: "smooth" });
					}
				}, 100);
			}
		}
	}, [activeFinanceTab, filteredPaymentSchedule]);

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
			setCar(carData);

			// 2. Get Rentals
			const { data: rentalsData, error: rentalsError } = await supabase
				.from("rentals")
				.select("*")
				.eq("car_id", carData.id)
				.order("created_at", { ascending: false });

			let activeRentalData = null;
			if (!rentalsError && rentalsData) {
				activeRentalData = rentalsData.find((r) => r.status === "active");
				setActiveRental(activeRentalData || null);
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

			// 6. Get Insurances
			const { data: insurancesData } = await supabase
				.from("insurances")
				.select("*")
				.eq("car_id", carData.id)
				.order("created_at", { ascending: false });

			if (insurancesData) setInsurances(insurancesData);

			// 7. Get Scheduled Expenses
			const { data: scheduledData } = await supabase
				.from("scheduled_expenses")
				.select("*")
				.eq("car_id", carData.id)
				.order("due_date", { ascending: true });

			if (scheduledData) setScheduledExpenses(scheduledData);

			// 8. Get Rental Incidents
			if (activeRentalData) {
				const { data: incidentsData } = await supabase
					.from("rental_incidents")
					.select("*")
					.eq("rental_id", activeRentalData.id)
					.order("incident_date", { ascending: false });
				
				if (incidentsData) setRentalIncidents(incidentsData);
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

    const galleryImages = useMemo(() => {
		const images = [];
		if (car?.image_url) images.push({ url: car.image_url, label: "Principal" });
        if (car?.gallery_urls) {
            car.gallery_urls.forEach((url, i) => images.push({ url, label: `Foto ${i + 1}` }));
        }
        
        const allRentals = [...rentalsHistory];
        if (activeRental) allRentals.push(activeRental);

        allRentals.forEach(r => {
            if (r.start_inspection_urls) {
                r.start_inspection_urls.forEach(url => images.push({ url, label: `Vistoria Início - ${new Date(r.start_date).toLocaleDateString('pt-BR')}` }));
            }
            if (r.start_inspection_photo_url) {
                images.push({ url: r.start_inspection_photo_url, label: `Vistoria Início - ${new Date(r.start_date).toLocaleDateString('pt-BR')}` });
            }
            if (r.end_inspection_urls) {
                r.end_inspection_urls.forEach(url => images.push({ url, label: `Vistoria Fim - ${new Date(r.expected_end_date).toLocaleDateString('pt-BR')}` }));
            }
            if (r.end_inspection_photo_url) {
                images.push({ url: r.end_inspection_photo_url, label: `Vistoria Fim - ${new Date(r.expected_end_date).toLocaleDateString('pt-BR')}` });
            }
        });

		return images;
	}, [car, activeRental, rentalsHistory]);

    const handleUploadGalleryImage = async (e) => {
		try {
			const file = e.target.files[0];
			if (!file) return;
			setLoading(true);

			const fileExt = file.name.split(".").pop();
			const fileName = `${Math.random()}.${fileExt}`;
			const filePath = `${user.id}/${car.id}/gallery/${fileName}`;

			const { error: uploadError } = await supabase.storage
				.from("rentals") 
				.upload(filePath, file);

			if (uploadError) throw uploadError;

			const { data: publicUrlData } = supabase.storage
				.from("rentals")
				.getPublicUrl(filePath);

			const newUrl = publicUrlData.publicUrl;
            const updatedGallery = [...(car.gallery_urls || []), newUrl];
            
            const { error: updateError } = await supabase.from('cars').update({ gallery_urls: updatedGallery }).eq('id', car.id);
            if (updateError) throw updateError;
            
            fetchData();
		} catch (error) {
			console.error("Erro ao subir imagem:", error);
			alert("Erro ao fazer upload da imagem.");
		} finally {
			setLoading(false);
		}
	};

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
				realId: log.id,
				date: log.date,
				km: log.km,
				label: log.notes ? `Avulso: ${log.notes}` : `Lançamento Avulso`,
				type: "avulso",
				originalNotes: log.notes || ""
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

	const totalExpenses = useMemo(() => {
		const paid = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
		const pending = scheduledExpenses
			.filter((e) => e.status === "Pendente" && e.expense_type !== "Reembolso Sinistro")
			.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
		return paid + pending;
	}, [expenses, scheduledExpenses]);

	const totalIncomes = useMemo(() => {
		let total = incomes.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
		
		const pendingReceitas = scheduledExpenses
			.filter((e) => e.status === "Pendente" && e.expense_type === "Reembolso Sinistro")
			.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
		
		total += pendingReceitas;

		const allRentals = [...rentalsHistory];
		if (activeRental) allRentals.push(activeRental);

		allRentals.forEach(rental => {
			const received = incomes.filter(inc => inc.rental_id === rental.id).reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
			const pending = parseFloat(rental.total_price) - received;
			if (pending > 0) total += pending;
		});

		return total;
	}, [incomes, scheduledExpenses, activeRental, rentalsHistory]);

	const allRentalsSorted = useMemo(() => {
		const arr = [...rentalsHistory];
		if (activeRental) arr.push(activeRental);
		return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
	}, [rentalsHistory, activeRental]);

	const getContractNumber = (id) => {
		const index = allRentalsSorted.findIndex(r => r.id === id);
		return index >= 0 ? index + 1 : null;
	};

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
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
				<div className="w-full md:w-auto">
					<Link
						to="/dashboard"
						className="inline-flex items-center gap-2 text-muted-olive hover:text-main text-sm font-black uppercase tracking-widest transition-colors mb-2 group">
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

				<div className="flex flex-wrap items-center gap-3 w-full md:w-auto tour-car-actions">
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
						onClick={() => setIsInsuranceModalOpen(true)}
						className="bg-accent hover:opacity-90 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 w-full sm:w-auto">
						<ShieldCheck className="w-5 h-5" /> Cadastrar Seguro
					</button>

					<button
						onClick={handleExportAnnual}
						className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-main px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-border-color/50 w-full sm:w-auto shadow-sm">
						<DownloadSimple className="w-5 h-5" />
						Exportar
					</button>
				</div>
			</div>



			{showInsuranceAlert && (
				<div className="bg-accent/10 border border-accent/20 p-5 rounded-3xl mb-8 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
					<div className="p-3 bg-accent/20 rounded-2xl text-accent hidden sm:block">
						<ShieldCheck className="w-6 h-6" />
					</div>
					<div className="flex-1">
						<h3 className="text-lg font-black text-main flex items-center gap-2 mb-1">
							<ShieldCheck className="w-5 h-5 text-accent sm:hidden" /> Novo Módulo de Seguros!
						</h3>
						<p className="text-sm font-medium text-muted-olive leading-relaxed mb-3">
							Notamos que você já possui lançamentos de "Seguro". Centralizamos isso! Use o botão <strong className="text-accent">Cadastrar Seguro</strong> ali em cima. 
							A partir de agora, os seguros ganham um card próprio abaixo do contrato, permitindo que você atrele os **Sinistros** diretamente à apólice ou desconte do caução.
						</p>
						<button onClick={() => {
							setShowInsuranceAlert(false);
							localStorage.setItem('seen_insurance_popup', 'true');
						}} className="text-xs font-black uppercase tracking-widest text-accent hover:text-main transition-colors">
							Ok, entendi!
						</button>
					</div>
					<button onClick={() => {
						setShowInsuranceAlert(false);
						localStorage.setItem('seen_insurance_popup', 'true');
					}} className="text-muted-olive hover:text-main transition-colors p-1">
						<X className="w-5 h-5" />
					</button>
				</div>
			)}

			{/* Indicadores de Desempenho (KPIs) */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 tour-car-kpis">
				<div className="glass rounded-3xl p-6 border border-border-color/50 shadow-sm relative group hover:-translate-y-1 transition-transform">
					<p className="text-[10px] font-black uppercase tracking-widest text-muted-olive mb-2">
						Total Faturado
					</p>
					<p className="text-3xl font-black text-success">
						<span className="text-sm font-bold mr-1">R$</span>
						{totalIncomes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
						{totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
						className={`text-3xl font-black ${totalIncomes - totalExpenses >= 0 ? "text-primary" : "text-danger"}`}>
						<span className="text-sm font-bold mr-1">R$</span>
						{(totalIncomes - totalExpenses).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
						<div className="flex justify-between items-center mb-6">
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

						{/* Galeria de Fotos Miniatura */}
						<div className="mb-6">
							<div className="flex items-center justify-between mb-3">
								<h4 className="text-[10px] font-black uppercase tracking-widest text-muted-olive flex items-center gap-1.5">
									<Camera className="w-3 h-3" /> Galeria
								</h4>
								<label className="cursor-pointer px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
									<Camera className="w-2.5 h-2.5" /> ADD
									<input type="file" accept="image/*" onChange={handleUploadGalleryImage} className="hidden" />
								</label>
							</div>
							
							{galleryImages.length > 0 ? (
								<div className="relative w-full h-44 rounded-xl overflow-hidden group bg-slate-100 dark:bg-slate-800 border border-border-color/50 shadow-sm">
									<img 
										src={galleryImages[currentGalleryIndex]?.url} 
										alt={galleryImages[currentGalleryIndex]?.label} 
										className="w-full h-full object-cover transition-opacity duration-300"
									/>
									
									{/* Label Overlay & Indicators */}
									<div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-end">
										<p className="text-[10px] text-white font-bold uppercase tracking-widest leading-tight mb-2 text-center drop-shadow-md">
											{galleryImages[currentGalleryIndex]?.label}
										</p>
										
										{/* Indicators */}
										{galleryImages.length > 1 && (
											<div className="flex gap-1.5 items-center">
												{galleryImages.map((_, i) => (
													<button 
														key={i} 
														onClick={() => setCurrentGalleryIndex(i)}
														className={`h-1.5 rounded-full transition-all duration-300 ${i === currentGalleryIndex ? 'w-5 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
													/>
												))}
											</div>
										)}
									</div>

									{/* Navigation Arrows */}
									{galleryImages.length > 1 && (
										<>
											<button 
												onClick={handlePrevImage}
												className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-md">
												<CaretLeft weight="bold" className="w-5 h-5" />
											</button>
											<button 
												onClick={handleNextImage}
												className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-md">
												<CaretRight weight="bold" className="w-5 h-5" />
											</button>
										</>
									)}
								</div>
							) : (
								<div className="glass rounded-xl p-4 border border-border-color text-center border-dashed">
									<p className="text-[10px] text-muted-olive font-medium">Nenhuma foto adicionada.</p>
								</div>
							)}
						</div>

						<div className="space-y-4 pt-2 border-t border-border-color">
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
										className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3 rounded-xl bg-primary/5 border border-border-color">
										<div className="flex-shrink-0 whitespace-nowrap">
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
										<div className="flex flex-1 items-center gap-2 w-full justify-start sm:justify-end min-w-0">
											<span
												className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md text-left sm:text-right break-words whitespace-normal line-clamp-2 max-w-full ${record.type === "start" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}
												title={record.label}>
												{record.label}
											</span>
                                            {record.type === "avulso" && (
                                                <button 
                                                    onClick={() => setEditingKm(record)}
                                                    className="p-1.5 rounded-lg bg-bg-main border border-border-color text-muted-olive hover:text-main transition-colors shrink-0">
                                                    <PencilSimple className="w-3 h-3" />
                                                </button>
                                            )}
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
									Contrato Atual <span className="text-xs font-black uppercase text-muted-olive tracking-widest ml-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">nº {String(getContractNumber(activeRental.id)).padStart(2, '0')}</span>
								</h3>
								<div className="flex gap-2">
									<button
										onClick={() => setSelectedHistoryRent(activeRental)}
										className="px-3 py-1.5 rounded-lg bg-bg-main hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-olive hover:text-main font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 border border-border-color">
										<FileText className="w-4 h-4" /> Detalhes
									</button>
									<button
										onClick={() => setIsEditRentModalOpen(true)}
										className="px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 border border-accent/20">
										<PencilSimple className="w-4 h-4" /> Editar
									</button>
								</div>
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
										const now = new Date();
										const start = new Date(activeRental.start_date.includes('T') ? activeRental.start_date : activeRental.start_date + 'T12:00:00');
										const end = new Date(activeRental.expected_end_date.includes('T') ? activeRental.expected_end_date : activeRental.expected_end_date + 'T12:00:00');
										const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
										const daysPassed = (now - start) / (1000 * 60 * 60 * 24);
										const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

										const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
										let timeLeftText = "";
										let isOverdue = false;
										if (daysLeft < 0) {
											timeLeftText = `Atrasado há ${Math.abs(daysLeft)} dias`;
											isOverdue = true;
										} else if (daysLeft === 0) {
											timeLeftText = "Termina hoje";
										} else if (daysLeft < 7) {
											timeLeftText = `Faltam ${daysLeft} dia(s)`;
										} else {
											const weeksLeft = Math.floor(daysLeft / 7);
											const extraDays = daysLeft % 7;
											timeLeftText = `Faltam ${weeksLeft} sem e ${extraDays} dias`;
										}

										return (
											<div className="space-y-4">
												{/* Progresso do Contrato */}
												<div className="bg-white/5 p-4 rounded-xl border border-border-color">
													<div className="flex justify-between items-center mb-2">
														<p className="text-[10px] uppercase font-black tracking-widest text-muted-olive">Progresso do Contrato</p>
														<p className={`text-[10px] font-black uppercase tracking-widest ${isOverdue ? 'text-danger' : 'text-primary'}`}>
															{timeLeftText}
														</p>
													</div>
													<div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
														<div 
															className={`h-full rounded-full ${isOverdue ? 'bg-danger' : 'bg-primary'}`} 
															style={{ width: `${progressPercent}%` }}
														></div>
													</div>
													<div className="flex justify-between items-center mt-2 text-xs font-bold text-main">
														<span>{start.toLocaleDateString('pt-BR')}</span>
														<span>{end.toLocaleDateString('pt-BR')}</span>
													</div>
												</div>
												
												{/* Valor Total do Contrato */}
												<div className="bg-white/5 p-3 rounded-xl border border-border-color/50 flex justify-between items-center">
													<p className="text-[10px] uppercase font-black tracking-widest text-muted-olive flex items-center gap-1.5"><CurrencyDollar className="w-3.5 h-3.5" /> Valor Total do Contrato</p>
													<p className="font-black text-primary text-sm">R$ {Number(activeRental.total_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
												</div>

												{/* Caução se existir */}
												{activeRental.security_deposit > 0 && (
													<div className="bg-white/5 p-3 rounded-xl border border-border-color/50 flex justify-between items-center">
														<p className="text-[10px] uppercase font-black tracking-widest text-muted-olive">Caução Retido</p>
														<p className="font-bold text-main text-sm">R$ {Number(activeRental.security_deposit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
													</div>
												)}
											</div>
										);
									})()}

									{/* Rental Incidents (Sinistros) */}
									{rentalIncidents.length > 0 && (
										<div className="mt-4 pt-4 border-t border-border-color">
											<p className="text-[10px] uppercase font-black tracking-widest text-danger mb-3 flex items-center gap-1">
												<WarningOctagon className="w-3 h-3" /> Sinistros Registrados neste Aluguel
											</p>
											<div className="space-y-2">
												{rentalIncidents.map(incident => (
													<div key={incident.id} className="bg-danger/5 border border-danger/20 p-3 rounded-xl flex justify-between items-center">
														<div>
															<p className="text-xs font-bold text-main">{incident.description}</p>
															<p className="text-[10px] text-muted-olive">{new Date(incident.incident_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
														</div>
														<p className="text-sm font-black text-danger">
															- R$ {parseFloat(incident.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
														</p>
													</div>
												))}
											</div>
										</div>
									)}
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

					{/* Card de Seguro */}
					{insurances.length > 0 && (() => {
						const currentInsurance = insurances[0];
						const isExpired = new Date(currentInsurance.end_date + 'T23:59:59') < new Date();

						return (
							<div className="glass rounded-2xl p-6 border border-border-color shadow-sm mt-8">
								<div className="flex justify-between items-center mb-6">
									<h3 className="text-lg font-semibold flex items-center gap-2">
										<ShieldCheck className="w-5 h-5 text-accent" />
										Seguro do Veículo
									</h3>
									{!isExpired && (
										<button
											onClick={() => setIsIncidentModalOpen(true)}
											className="p-1.5 px-3 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest border border-danger/20">
											<WarningOctagon className="w-3 h-3"/> Registrar Sinistro
										</button>
									)}
								</div>
								
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-accent/5 p-4 rounded-2xl border border-accent/10">
									<div>
										<p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Seguradora</p>
										<p className="font-bold text-main text-lg">{currentInsurance.company_name}</p>
									</div>
									<div>
										<p className="text-[10px] uppercase font-black tracking-widest text-muted-olive mb-1">Período de Cobertura</p>
										<p className={`font-bold text-sm ${isExpired ? 'text-danger' : 'text-main'}`}>
											{new Date(currentInsurance.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(currentInsurance.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}
											{isExpired && ' (Vencido)'}
										</p>
										<p className="text-xs text-muted-olive mt-0.5">Total: R$ {parseFloat(currentInsurance.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
									</div>
                                    
                                    {currentInsurance.payment_type === 'Parcelado' && (
                                        <div className="sm:col-span-2 pt-2 border-t border-accent/10 mt-2">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-olive">Parcelamento</p>
                                                    <p className="text-[10px] font-bold text-main mt-0.5">
                                                        {currentInsurance.installments_count || scheduledExpenses.filter(e => e.insurance_id === currentInsurance.id).length}x de R$ {(parseFloat(currentInsurance.total_amount) / (currentInsurance.installments_count || scheduledExpenses.filter(e => e.insurance_id === currentInsurance.id).length || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                                <p className="text-[10px] font-bold text-accent">
                                                    {scheduledExpenses.filter(e => e.insurance_id === currentInsurance.id && e.status === 'Pago').length} / {currentInsurance.installments_count || scheduledExpenses.filter(e => e.insurance_id === currentInsurance.id).length} pagas
                                                </p>
                                            </div>
                                            <div className="w-full bg-border-color/30 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="bg-accent h-full rounded-full transition-all duration-500"
                                                    style={{ 
                                                        width: `${Math.min(100, ((scheduledExpenses.filter(e => e.insurance_id === currentInsurance.id && e.status === 'Pago').length) / (currentInsurance.installments_count || scheduledExpenses.filter(e => e.insurance_id === currentInsurance.id).length || 1)) * 100)}%` 
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
								</div>

                                {/* Lista de Sinistros Atrelados (do Contrato Atual) */}
                                {rentalIncidents.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-danger px-1">Sinistros Acionados (Contrato Atual)</p>
                                        {rentalIncidents.map(inc => (
                                            <div key={inc.id} className="flex items-start justify-between bg-danger/5 border border-danger/10 p-3 rounded-xl">
                                                <div>
                                                    <p className="text-xs font-bold text-main">{inc.description}</p>
                                                    <p className="text-[10px] text-muted-olive font-bold mt-0.5">{new Date(inc.incident_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                                </div>
                                                <span className="text-xs font-black text-danger bg-danger/10 px-2 py-1 rounded-lg">
                                                    R$ {parseFloat(inc.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
							</div>
						)
					})()}

				</div>
			</div>

					{/* Abas de Fluxo Financeiro Detalhado */}
					<div className="glass rounded-3xl p-6 border border-border-color shadow-sm tour-car-finance">
						<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                                <button
                                    onClick={() => setActiveFinanceTab("cronograma")}
                                    className={`flex-1 py-3 px-4 text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl whitespace-nowrap ${activeFinanceTab === "cronograma" ? "bg-white dark:bg-slate-700 text-accent shadow-sm" : "text-muted-olive hover:text-accent hover:bg-white/50"}`}>
                                    <Calendar className="w-4 h-4" /> Cronograma
                                </button>
                                <button
                                    onClick={() => setActiveFinanceTab("gastos")}
                                    className={`flex-1 py-3 px-4 text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl whitespace-nowrap ${activeFinanceTab === "gastos" ? "bg-white dark:bg-slate-700 text-danger shadow-sm" : "text-muted-olive hover:text-danger hover:bg-white/50"}`}>
                                    <Wrench className="w-4 h-4" /> Gastos
                                </button>
                                <button
                                    onClick={() => setActiveFinanceTab("receitas")}
                                    className={`flex-1 py-3 px-4 text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl whitespace-nowrap ${activeFinanceTab === "receitas" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-muted-olive hover:text-primary hover:bg-white/50"}`}>
                                    <CurrencyDollar className="w-4 h-4" /> Receitas
                                </button>
                            </div>
                            
                            {activeFinanceTab === "cronograma" && (
                                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                                    <select value={financeType} onChange={e => setFinanceType(e.target.value)} className="flex-1 sm:w-auto bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-bold text-main outline-none focus:ring-2 focus:ring-accent cursor-pointer dark:[color-scheme:dark]">
                                        <option value="all">Todos</option>
                                        <option value="Receita">Receitas</option>
                                        <option value="Despesa">Despesas</option>
                                    </select>
                                    <select value={financeMonth} onChange={e => setFinanceMonth(e.target.value)} className="flex-1 sm:w-auto bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-bold text-main outline-none focus:ring-2 focus:ring-accent cursor-pointer dark:[color-scheme:dark]">
                                        <option value="all">Ano Todo</option>
                                        <option value="1">Janeiro</option>
                                        <option value="2">Fevereiro</option>
                                        <option value="3">Março</option>
                                        <option value="4">Abril</option>
                                        <option value="5">Maio</option>
                                        <option value="6">Junho</option>
                                        <option value="7">Julho</option>
                                        <option value="8">Agosto</option>
                                        <option value="9">Setembro</option>
                                        <option value="10">Outubro</option>
                                        <option value="11">Novembro</option>
                                        <option value="12">Dezembro</option>
                                    </select>
                                    <select value={financeYear} onChange={e => setFinanceYear(parseInt(e.target.value))} className="flex-1 sm:w-auto bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-bold text-main outline-none focus:ring-2 focus:ring-accent cursor-pointer dark:[color-scheme:dark]">
                                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                        <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                                        <option value={new Date().getFullYear() + 2}>{new Date().getFullYear() + 2}</option>
                                    </select>
                                </div>
                            )}
						</div>

						<div className="p-0 bg-white/60 dark:bg-slate-950/40 rounded-2xl overflow-hidden border border-border-color/50">
							{activeFinanceTab === "cronograma" ? (
								<div id="cronograma-container" className="overflow-auto max-h-[500px] scrollbar-thin">
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
											{filteredPaymentSchedule.length === 0 ? (
												<tr>
													<td
														colSpan="5"
														className="py-8 text-center italic text-muted-olive">
														Nenhum lançamento encontrado para este período.
													</td>
												</tr>
											) : (
												filteredPaymentSchedule.map((sched) => (
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
															{sched.period === '-' ? (
                                                                <span className="break-words whitespace-normal max-w-[200px] inline-block leading-snug">{sched.description || sched.type}</span>
                                                            ) : (
                                                                `${sched.period}/${sched.totalPeriods}`
                                                            )}
														</td>
														<td className={`py-4 px-6 font-bold ${sched.type === 'Despesa' ? 'text-danger' : 'text-primary'}`}>
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
                                                            <div className="mt-1 text-[9px] uppercase font-black tracking-widest text-muted-olive">{sched.type === 'Despesa' ? 'Saída' : 'Entrada'}</div>
														</td>
														<td className="py-4 px-6">
															{!sched.isPaid ? (
                                                                sched.period === '-' ? (
                                                                    sched.type === 'Despesa' ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => handlePayScheduledExpense(sched.id)}
                                                                                className="bg-danger hover:bg-danger/90 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm shadow-danger/20 transition-all flex items-center gap-1">
                                                                                <CheckCircle className="w-3 h-3" /> Pagar
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => setEditingScheduledExpense(sched)}
                                                                                className="p-1.5 rounded-lg bg-bg-main border border-border-color text-muted-olive hover:text-main transition-colors">
                                                                                <PencilSimple className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleReceiveScheduledExpense(sched.id)}
                                                                            className="bg-accent hover:bg-accent/90 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm shadow-accent/20 transition-all flex items-center gap-1">
                                                                            <CheckCircle className="w-3 h-3" /> Receber
                                                                        </button>
                                                                    )
                                                                ) : (
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
                                                                        <CurrencyDollar className="w-3 h-3" /> Receber
                                                                    </button>
                                                                )
															) : (
																<div className="flex items-center gap-2">
																	<span className="text-[10px] uppercase font-bold text-muted-olive">
																		Confirmado
																	</span>
																	<button 
																		onClick={() => handleRevertPayment(sched)}
																		className="p-1.5 rounded-lg bg-bg-main border border-border-color text-muted-olive hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-all"
																		title="Reverter Pagamento">
																		<ArrowCounterClockwise className="w-3.5 h-3.5" />
																	</button>
																</div>
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
													<p className="font-bold text-main flex flex-col">
														<span>{rent.client_name}</span>
														<span className="text-[10px] text-muted-olive uppercase font-black tracking-widest mt-0.5">Contrato nº {String(getContractNumber(rent.id)).padStart(2, '0')}</span>
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
					realCurrentKm={kmLogs.length > 0 ? kmLogs[0].km : car.current_km}
					onClose={() => {
						setIsExpenseModalOpen(false);
						setEditingExpense(null);
					}}
					onSuccess={fetchData}
				/>
			)}

			{isInsuranceModalOpen && (
				<InsuranceModal
					car={car}
					onClose={() => setIsInsuranceModalOpen(false)}
					onSuccess={fetchData}
				/>
			)}

			{isIncidentModalOpen && (
				<IncidentModal
					car={car}
					activeRental={activeRental}
					onClose={() => setIsIncidentModalOpen(false)}
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

			{editingScheduledExpense && (
				<EditScheduledExpenseModal
					expense={editingScheduledExpense}
					onClose={() => setEditingScheduledExpense(null)}
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
					contractNumber={getContractNumber(selectedHistoryRent.id)}
					onClose={() => setSelectedHistoryRent(null)}
				/>
			)}

			{(isAddKmModalOpen || editingKm) && (
				<AddKmModal
					car={car}
                    kmLog={editingKm}
					onClose={() => {
                        setIsAddKmModalOpen(false);
                        setEditingKm(null);
                    }}
					onSuccess={fetchData}
				/>
			)}
		</div>
	);
}
