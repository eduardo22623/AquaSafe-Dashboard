-- PROCEDIMIENTOS ALMACENADOS PARA ADMINISTRADORES (ELIMINAR USUARIOS Y DISPOSITIVOS)
-- ¡IMPORTANTE! Ejecuta este archivo en la pestaña "SQL Editor" de tu proyecto Supabase.

-- 1. Función para Eliminar un Dispositivo
CREATE OR REPLACE FUNCTION public.admin_delete_device(p_mac_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios elevados
AS $$
BEGIN
  -- Verificar si el usuario que ejecuta la función es admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden realizar esta acción.';
  END IF;

  -- Eliminar el dispositivo (la base de datos se encarga de eliminar mediciones si hay ON DELETE CASCADE, 
  -- de lo contrario eliminamos mediciones primero)
  DELETE FROM public.mediciones WHERE device_id = p_mac_address;
  DELETE FROM public.devices WHERE mac_address = p_mac_address;

END;
$$;


-- 2. Función para Eliminar un Usuario (y sus dispositivos)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Se requiere esto para poder acceder a auth.users con permisos de superusuario o admin
SET search_path = public, auth
AS $$
BEGIN
  -- Verificar si el usuario que ejecuta la función es admin y no se está borrando a sí mismo por error
  IF auth.uid() = p_user_id THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta de administrador.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden realizar esta acción.';
  END IF;

  -- 1. Eliminar mediciones de los dispositivos de este usuario
  DELETE FROM public.mediciones 
  WHERE device_id IN (SELECT mac_address FROM public.devices WHERE user_id = p_user_id);

  -- 2. Eliminar los dispositivos del usuario
  DELETE FROM public.devices WHERE user_id = p_user_id;

  -- 3. Eliminar la cuenta del perfil (public.profiles)
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 4. Eliminar el usuario del sistema de autenticación de Supabase (auth.users)
  -- NOTA: auth.users normalmente requiere el rol supabase_admin, pero al ser SECURITY DEFINER
  -- tomará los permisos de quien creó la función (usualmente postgres que es superusuario).
  DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

-- Otorgar los permisos a usuarios autenticados para que puedan LLAMAR la función
-- (La seguridad y verificación se hace internamente en el código de la función)
GRANT EXECUTE ON FUNCTION public.admin_delete_device TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
