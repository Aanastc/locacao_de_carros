# Locação de Carros (Car Rental Manager)

Um sistema completo para gestão de frotas e locação de veículos, focado em simplificar a vida de proprietários e locadoras. Desenvolvido com uma interface moderna, rápida e responsiva.

## 🚀 Funcionalidades Principais

- **Gestão de Veículos**: Cadastro completo de carros (marca, modelo, placa, valor de compra, quilometragem, etc.), controle de status (Disponível, Alugado, Manutenção) e galeria de fotos.
- **Gestão de Locações**: Criação de contratos de aluguel (diário, semanal, mensal), controle de caução, registro de vistorias (com fotos) e acompanhamento do histórico do locatário.
- **Controle Financeiro**: Fluxo de caixa detalhado (receitas e despesas), contas a pagar/receber (agendamentos), cálculo automático de lucro por veículo e exportação de planilhas.
- **Dashboard Inteligente**: Visão geral do negócio com alertas automáticos para pagamentos atrasados, contratos vencendo e manutenções pendentes.
- **Gestão de Sinistros e Incidentes**: Registro de avarias, multas e deduções automáticas do caução no encerramento do contrato.
- **Controle de Manutenção e Seguro**: Acompanhamento de revisões, troca de óleo, renovação de seguro e registro de KM.

## 💻 Tecnologias Utilizadas

- **Frontend**: React.js, Vite, Tailwind CSS (para estilização rápida e responsiva), Phosphor Icons (ícones).
- **Backend/Banco de Dados**: Supabase (PostgreSQL, Autenticação, Storage para fotos).
- **Roteamento**: React Router.
- **Formatação de Dados**: Date-fns (datas), Intl (moedas).

## 🛠️ Como Executar o Projeto

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente (Crie um arquivo `.env` com as chaves do Supabase).
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 🔒 Segurança

O sistema conta com autenticação segura via Supabase, garantindo que cada proprietário tenha acesso exclusivo apenas aos seus próprios veículos e dados financeiros.
