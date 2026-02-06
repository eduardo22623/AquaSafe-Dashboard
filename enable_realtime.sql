-- Habilitar Realtime para la tabla mediciones
-- Esto es crucial para que el Dashboard se actualice automáticamente.
ALTER PUBLICATION supabase_realtime ADD TABLE mediciones;

-- Opcional: Verificar si devices necesita realtime (probablemente no)
-- ALTER PUBLICATION supabase_realtime ADD TABLE devices;
