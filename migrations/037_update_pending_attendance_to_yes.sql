-- Convert any existing pending tournament attendance rows to confirmed yes
UPDATE tournament_players
SET attending_status = 'yes',
    response_date = COALESCE(response_date, NOW())
WHERE attending_status = 'pending';
