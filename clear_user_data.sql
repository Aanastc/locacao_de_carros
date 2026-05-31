DO $$
DECLARE
    target_user_id UUID := '4cc94597-92e5-41b0-a34b-f2a54b961aa8';
BEGIN
    -- Deletar incidentes de locação
    DELETE FROM rental_incidents WHERE rental_id IN (
        SELECT id FROM rentals WHERE user_id = target_user_id OR car_id IN (SELECT id FROM cars WHERE owner_id = target_user_id)
    );

    -- Deletar despesas agendadas
    DELETE FROM scheduled_expenses WHERE rental_id IN (
        SELECT id FROM rentals WHERE user_id = target_user_id OR car_id IN (SELECT id FROM cars WHERE owner_id = target_user_id)
    ) OR car_id IN (SELECT id FROM cars WHERE owner_id = target_user_id);

    -- Deletar seguros
    DELETE FROM insurances WHERE car_id IN (SELECT id FROM cars WHERE owner_id = target_user_id);

    -- Deletar locações
    DELETE FROM rentals WHERE user_id = target_user_id OR car_id IN (SELECT id FROM cars WHERE owner_id = target_user_id);

    -- Deletar recebimentos
    DELETE FROM incomes WHERE user_id = target_user_id;

    -- Deletar despesas
    DELETE FROM expenses WHERE user_id = target_user_id;

    -- Deletar histórico de KM
    DELETE FROM km_logs WHERE user_id = target_user_id;

    -- Deletar carros do usuário (owner_id)
    DELETE FROM cars WHERE owner_id = target_user_id;

    -- Nota: A tabela principal de usuários (auth.users ou public.users) NÃO foi tocada.
END $$;
