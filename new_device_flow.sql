-- 1. Función para el Administrador: Pre-registrar un dispositivo
CREATE OR REPLACE FUNCTION public.admin_create_device(p_mac_address TEXT, p_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario sea administrador
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden realizar esta acción.';
  END IF;

  -- Insertar el dispositivo como no asignado (user_id = NULL)
  INSERT INTO public.devices (mac_address, name, user_id)
  VALUES (p_mac_address, p_name, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_device TO authenticated;

-- 2. Función para el Usuario (Cliente): Reclamar (Vincular) un dispositivo pre-registrado
CREATE OR REPLACE FUNCTION public.claim_device(p_mac_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device_owner UUID;
BEGIN
  -- 1. Revisar si el dispositivo existe y recuperar su dueño actual
  SELECT user_id INTO v_device_owner 
  FROM public.devices 
  WHERE mac_address = p_mac_address;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este dispositivo no existe. El administrador debe registrarlo primero en el inventario.';
  END IF;

  -- 2. Revisar si ya está asignado a alguien
  IF v_device_owner IS NOT NULL THEN
    IF v_device_owner = auth.uid() THEN
      -- Si ya es el dueño que intenta reclamarlo de nuevo, solo completamos sin error
      RETURN;
    ELSE
      RAISE EXCEPTION 'Este dispositivo (MAC) ya se encuentra vinculado a otra cuenta.';
    END IF;
  END IF;

  -- 3. Si no tiene dueño (user_id IS NULL), proceder a asignarlo al usuario actual
  UPDATE public.devices 
  SET user_id = auth.uid(),
      name = 'Dispositivo de ' || COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Cliente')
  WHERE mac_address = p_mac_address;

END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_device TO authenticated;
