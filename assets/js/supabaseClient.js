
// Initialize Supabase Client
// Relies on the script tag in index.html: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = 'https://byvjywsdankbgvrhewav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dmp5d3NkYW5rYmd2cmhld2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjcyOTYsImV4cCI6MjA4NTc0MzI5Nn0.Pl37u0K0S9CHurl956EtJwWWw3cx48siI0isoAOpIgk';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase Client initialized');
