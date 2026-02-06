-- 1. Crear tabla de Dispositivos
CREATE TABLE IF NOT EXISTS public.devices (
    mac_address TEXT PRIMARY KEY, -- Identificador único (Ej: A0:B1:C2:D3:E4:F5)
    name TEXT DEFAULT 'Dispositivo Sin Nombre',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Dueño del dispositivo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS (Row Level Security) en Devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para Devices
-- Los usuarios ven sus propios dispositivos
CREATE POLICY "Users can view own devices" ON public.devices
    FOR SELECT USING (auth.uid() = user_id);

-- Los usuarios pueden registrar dispositivos (o restringir solo a Admin si prefieres)
CREATE POLICY "Users can insert own devices" ON public.devices
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
-- Admins ven todo (requiere que tengas una funcion is_admin o checkear role en profiles)
-- Por simplicidad inicial, permitimos lectura pública o ajusta según necesidad.


-- 3. Modificar Tabla Mediciones para incluir el Dispositivo
ALTER TABLE public.mediciones 
ADD COLUMN IF NOT EXISTS device_id TEXT REFERENCES public.devices(mac_address);

-- 4. Actualizar Políticas de Mediciones (Opcional por ahora)
-- Asegurar que usuarios solo lean mediciones de sus dispositivos
-- DROP POLICY IF EXISTS "Public read access" ON public.mediciones;
-- CREATE POLICY "Users read own device measurements" ON public.mediciones
--   FOR SELECT USING (
--     device_id IN (SELECT mac_address FROM public.devices WHERE user_id = auth.uid())
--      OR 
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
--   );


-- DATA DE EJEMPLO (Opcional - Ejecutar solo si quieres probar ya)
-- Asumiendo que tu usuario tiene un UUID específico, podrias insertar:
-- INSERT INTO public.devices (mac_address, name, user_id) VALUES ('TEST-MAC-01', 'Simulador PC', 'TU_UUID_AQUI');
