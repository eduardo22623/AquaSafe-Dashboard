
-- Check table definition
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mediciones';

-- Check RLS enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'mediciones';
