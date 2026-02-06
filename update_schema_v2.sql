-- 1. Agregar columnas a profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Crear Vista Maestra para Admin
-- Esta vista une Dispositivos + Dueño + Última Medición
CREATE OR REPLACE VIEW admin_device_monitor AS
SELECT 
    d.mac_address,
    d.name as device_name,
    p.full_name as client_name,
    p.email as client_email,
    p.phone as client_phone,
    p.address as client_address,
    m.ph as last_ph,
    m.turbidez as last_turbidity,
    m.tds as last_tds,
    m.es_potable,
    m.created_at as last_reading_at
FROM 
    public.devices d
LEFT JOIN 
    public.profiles p ON d.user_id = p.id
LEFT JOIN LATERAL (
    SELECT * FROM public.mediciones 
    WHERE device_id = d.mac_address 
    ORDER BY created_at DESC 
    LIMIT 1
) m ON true;

-- IMPORTANTE: Dar permisos
GRANT SELECT ON admin_device_monitor TO authenticated;
GRANT SELECT ON admin_device_monitor TO service_role;
