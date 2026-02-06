-- 1. Habilitar RLS explícitamente (por si acaso)
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediciones ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Users can view own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
DROP POLICY IF EXISTS "Public view devices" ON public.devices;

DROP POLICY IF EXISTS "Users can insert measurements" ON public.mediciones;
DROP POLICY IF EXISTS "Public read measurements" ON public.mediciones;

-- 3. Políticas para DEVICES
-- LECTURA: Permitir que TODOS los usuarios autenticados vean TODOS los dispositivos
-- Esto es necesario para verificar si una MAC ya existe antes de registrarla.
CREATE POLICY "Authenticated users can view all devices" ON public.devices
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: Usuarios autenticados pueden registrar dispositivos si ellos son el dueño
CREATE POLICY "Users can insert own devices" ON public.devices
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuarios solo pueden editar SU propio dispositivo
CREATE POLICY "Users can update own devices" ON public.devices
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. Políticas para MEDICIONES
-- INSERT: Usuarios autenticados pueden insertar mediciones
-- (Idealmente verificaríamos que el device_id les pertenezca, pero para el simulador simplificamos)
CREATE POLICY "Users can insert measurements" ON public.mediciones
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Permitir si el dispositivo en la medición pertenece al usuario actual
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE mac_address = device_id 
            AND user_id = auth.uid()
        )
    );

-- SELECT: Ver mediciones (puedes ajustar si quieres privacidad total o compartida)
CREATE POLICY "Users view measurements of own devices" ON public.mediciones
    FOR SELECT
    TO authenticated
    USING (
        -- Ver mediciones de mis dispositivos O si soy admin
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE mac_address = device_id 
            AND user_id = auth.uid()
        )
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
