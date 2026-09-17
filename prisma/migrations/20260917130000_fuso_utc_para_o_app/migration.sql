-- O adapter pg do Prisma envia timestamptz como texto UTC sem offset e o Postgres interpreta
-- no TimeZone da sessão. No Supabase a sessão já é UTC; num Postgres local em Europe/Brussels
-- o instante era gravado deslocado (bug aberto desde 08/09: só o SQL cru discordava do app).
-- Fixar o fuso no papel do app deixa qualquer ambiente igual à produção.
ALTER ROLE barber_app SET timezone = 'UTC';
