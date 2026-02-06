-- VISTA DE MONITOR DE DISPOSITIVOS PARA ADMIN (V2)
-- Agregado: Direccion (Address) y TDS

DROP VIEW IF EXISTS public.admin_device_monitor;

CREATE OR REPLACE VIEW public.admin_device_monitor AS
SELECT 
    d.mac_address,
    d.name as device_name,
    p.full_name as client_name,
    COALESCE(p.phone, p.email) as contact_info,
    p.address as client_address, -- NUEVO
    m_latest.ph as last_ph,
    m_latest.turbidez as last_turbidity,
    m_latest.tds as last_tds, -- NUEVO
    m_latest.es_potable as is_potable,
    m_latest.created_at as last_reading_at
FROM 
    public.devices d
LEFT JOIN 
    public.profiles p ON d.user_id = p.id
LEFT JOIN LATERAL (
    SELECT ph, turbidez, tds, es_potable, created_at
    FROM public.mediciones
    WHERE device_id = d.mac_address
    ORDER BY created_at DESC
    LIMIT 1
) m_latest ON true;

-- Permisos
GRANT SELECT ON public.admin_device_monitor TO authenticated;
GRANT SELECT ON public.admin_device_monitor TO service_role;
