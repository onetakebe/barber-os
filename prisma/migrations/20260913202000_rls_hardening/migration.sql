-- Ajustes do advisor de segurança do Supabase após o T4.
ALTER FUNCTION app.current_tenant() SET search_path = '';
ALTER FUNCTION app.bypass() SET search_path = '';
-- Gatilho do Supabase que liga RLS automaticamente em tabelas novas: não deve ser chamável pela API.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable') THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
