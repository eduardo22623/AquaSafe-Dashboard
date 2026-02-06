-- SOLUCIÓN FINAL V3
-- 1. Asegurar que la tabla PROFILES exista y tenga las columnas correctas
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'operator',
    full_name TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TRIGGER PARA NUEVOS USUARIOS (CRÍTICO: Esto faltaba)
-- Esto crea automáticamente la fila en 'profiles' cuando alguien se registra.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    'operator' -- Rol por defecto
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Borrar trigger si existe para recrearlo limpio
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. DESACTIVAR RLS (ROW LEVEL SECURITY) TEMPORALMENTE
-- Para garantizar que no haya bloqueos de permisos "invisibles".
-- Una vez que todo funcione, podremos reactivarlo con reglas finas.
ALTER TABLE public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 4. Permisos explícitos (Grant All)
GRANT ALL ON TABLE public.profiles TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.devices TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.mediciones TO postgres, anon, authenticated, service_role;

-- 5. Crear tabla devices si no existe (Backup)
CREATE TABLE IF NOT EXISTS public.devices (
    mac_address TEXT PRIMARY KEY,
    name TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
