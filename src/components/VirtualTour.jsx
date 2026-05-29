import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Joyride, STATUS, EVENTS } from 'react-joyride';

export default function VirtualTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState(false);
  
  // Efeito principal para ligar o tour nas páginas se estiver ativo
  useEffect(() => {
    const isTourActive = localStorage.getItem('isTourActive') === 'true';
    if (isTourActive) {
      // Delay pequeno para garantir que a página renderizou os componentes (ex: bolinhas de loading)
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setRun(false);
    }
  }, [location.pathname]);

  // Evento global para disparar o tour
  useEffect(() => {
    const handleStartTour = () => {
      localStorage.setItem('isTourActive', 'true');
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
      } else {
        setRun(false);
        setTimeout(() => setRun(true), 500);
      }
    };
    
    // Auto-start para o primeiro acesso
    const hasSeenTour = localStorage.getItem('hasSeenVirtualTour');
    if (!hasSeenTour && location.pathname === '/dashboard') {
      localStorage.setItem('hasSeenVirtualTour', 'true');
      handleStartTour();
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setRun(false);
        localStorage.removeItem('isTourActive');
      }
    };

    window.addEventListener('start-tour', handleStartTour);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('start-tour', handleStartTour);
      window.removeEventListener('keydown', handleEscape);
    }
  }, [location.pathname, navigate]);

  // Passos isolados por página (evita bugs de "target_not_found" entre rotas)
  const dashboardSteps = [
    {
      target: '.tour-navbar-logo',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Bem-vindo(a)! 🚗</h3>
          <p className="text-sm text-muted-olive">Este é o menu principal. Aqui você navega por todas as telas do sistema.</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '.tour-dashboard-stats',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Dashboard Financeiro</h3>
          <p className="text-sm text-muted-olive">Aqui fica o resumo rápido das suas Receitas, Despesas e Lucro.</p>
        </div>
      ),
    },
    {
      target: '.tour-cars-list',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Resumo da Frota</h3>
          <p className="text-sm text-muted-olive">Acompanhe quantos carros estão livres ou alugados.<br/><br/><i>Vamos conhecer a aba de Carros!</i></p>
        </div>
      ),
    }
  ];

  const carsSteps = [
    {
      target: '.tour-cars-add',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Comece por aqui</h3>
          <p className="text-sm text-muted-olive">Clique aqui para registrar novos veículos na sua frota.</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '.tour-cars-search',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Busca Inteligente</h3>
          <p className="text-sm text-muted-olive">Filtre rapidamente pelos seus carros.<br/><br/><i>Próxima parada: Relatórios!</i></p>
        </div>
      ),
    }
  ];

  const reportsSteps = [
    {
      target: '.tour-reports-filters',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Filtros Avançados</h3>
          <p className="text-sm text-muted-olive">Cruze dados por mês, ano e veículo específico.</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '.tour-reports-charts',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Análise Profunda</h3>
          <p className="text-sm text-muted-olive">Gráficos operacionais para tomar as melhores decisões financeiras.<br/><br/><i>Vamos para o seu Perfil!</i></p>
        </div>
      ),
    }
  ];

  const profileSteps = [
    {
      target: '.tour-profile-avatar',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Sua Identidade</h3>
          <p className="text-sm text-muted-olive">Aqui você pode alterar sua foto de perfil para personalizar sua conta.</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '.tour-profile-form',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Seus Dados</h3>
          <p className="text-sm text-muted-olive">Mantenha seu nome, e-mail e senha sempre atualizados.</p>
        </div>
      ),
    },
    {
      target: '.tour-profile-save',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Tudo pronto! 🎉</h3>
          <p className="text-sm text-muted-olive">O tour principal acaba aqui. Mas lembre-se: você pode clicar no botão de "Tour" no menu sempre que entrar em uma página nova (como nos Detalhes do Carro) para ver mais dicas!</p>
        </div>
      ),
    }
  ];

  const carDetailsSteps = [
    {
      target: '.tour-car-actions',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Ações Rápidas</h3>
          <p className="text-sm text-muted-olive">Inicie aluguéis, lance despesas ou cadastre seguros diretamente por aqui.</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '.tour-car-kpis',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Desempenho do Veículo</h3>
          <p className="text-sm text-muted-olive">Acompanhe se este carro específico está dando lucro ou prejuízo.</p>
        </div>
      ),
    },
    {
      target: '.tour-car-finance',
      content: (
        <div className="text-left space-y-2">
          <h3 className="font-bold text-main">Controle Financeiro</h3>
          <p className="text-sm text-muted-olive">Navegue pelas abas para gerenciar o cronograma de pagamentos, gastos de manutenção e receitas avulsas.</p>
        </div>
      ),
    }
  ];

  let steps = [];
  if (location.pathname === '/dashboard') steps = dashboardSteps;
  if (location.pathname === '/cars') steps = carsSteps;
  if (location.pathname === '/reports') steps = reportsSteps;
  if (location.pathname === '/profile') steps = profileSteps;
  if (location.pathname.startsWith('/car/')) steps = carDetailsSteps;

  const handleJoyrideCallback = (data) => {
    const { status, type } = data;

    // Se o usuário fechar ou pular o tour, encerramos tudo imediatamente
    if ([STATUS.SKIPPED].includes(status) || type === EVENTS.TOUR_END) {
        setRun(false);
        localStorage.removeItem('isTourActive');
        return;
    }

    // Se o passo atual terminar com sucesso, avança para a próxima página
    if (status === STATUS.FINISHED) {
      setRun(false); // Pausa momentaneamente
      if (location.pathname === '/dashboard') {
        navigate('/cars');
      } else if (location.pathname === '/cars') {
        navigate('/reports');
      } else if (location.pathname === '/reports') {
        navigate('/profile');
      } else {
        localStorage.removeItem('isTourActive');
      }
    }

    // Aborta de forma limpa caso a página demore muito e os elementos sumam
    if (type === EVENTS.TARGET_NOT_FOUND) {
      console.warn('Alvo não encontrado. Abortando tour para evitar travamento.');
      setRun(false);
      localStorage.removeItem('isTourActive');
    }
  };

  if (steps.length === 0) return null;

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton={false}
      run={run}
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#4F46E5',
          textColor: 'inherit',
          backgroundColor: '#FFFFFF',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
        },
        tooltip: {
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        },
        buttonNext: {
            backgroundColor: '#4F46E5',
            borderRadius: '8px',
            fontWeight: 'bold',
            padding: '8px 16px',
        },
        buttonBack: {
            marginRight: '8px',
            color: '#64748B',
        },
        buttonSkip: {
            color: '#64748B',
            fontWeight: '600',
        }
      }}
      locale={{
        back: 'Anterior',
        close: 'Fechar',
        last: (location.pathname === '/profile' || location.pathname.startsWith('/car/')) ? 'Concluir' : 'Continuar',
        next: 'Próximo',
        skip: 'Pular Tour',
      }}
    />
  );
}
