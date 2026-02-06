-- SCRIPT DE LIMPIEZA (OPCIONAL)
-- Úsalo si quieres borrar todos los datos de pruebas anteriores.

-- 1. Borrar todas las mediciones
TRUNCATE TABLE public.mediciones CASCADE;

-- 2. Borrar todos los dispositivos (para poder registrar las MACs de nuevo con otros usuarios)
TRUNCATE TABLE public.devices CASCADE;

-- 3. Borrar perfiles (se borrarán solos si borras el usuario desde Auth, pero esto asegura limpieza)
TRUNCATE TABLE public.profiles CASCADE;

-- NOTA: Para borrar los USUARIOS (Login), ve a:
-- Supabase Dashboard -> Authentication -> Users
-- Selecciona todos y dale a "Delete".
