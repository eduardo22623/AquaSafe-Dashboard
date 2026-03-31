-- =====================================================
-- FIX: Permitir que el ESP32 inserte solo TDS (sin ph ni turbidez)
-- El sensor solo mide TDS, pH y turbidez están deshabilitados.
-- =====================================================

-- 1. Quitar NOT NULL de ph y turbidez (si lo tienen)
ALTER TABLE public.mediciones ALTER COLUMN ph DROP NOT NULL;
ALTER TABLE public.mediciones ALTER COLUMN turbidez DROP NOT NULL;

-- 2. Poner valor default NULL (o 0 si prefieres)
ALTER TABLE public.mediciones ALTER COLUMN ph SET DEFAULT NULL;
ALTER TABLE public.mediciones ALTER COLUMN turbidez SET DEFAULT NULL;

-- 3. Asegurarnos que tds también tiene default por si acaso
ALTER TABLE public.mediciones ALTER COLUMN tds SET DEFAULT 0;

-- 4. Verificar que RLS en mediciones esté desactivado (el ESP32 usa anon key)
ALTER TABLE public.mediciones DISABLE ROW LEVEL SECURITY;

-- 5. Acceso total para anon (ESP32 usa anon key)
GRANT ALL ON TABLE public.mediciones TO anon;
GRANT ALL ON TABLE public.mediciones TO authenticated;

-- 6. Verificar la estructura final
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'mediciones'
ORDER BY ordinal_position;
