
// Main Application Logic

// DOM Elements
const views = {
    landing: document.getElementById('landing-view'),
    auth: document.getElementById('auth-view'),
    dashboard: document.getElementById('dashboard-view'),
    settings: document.getElementById('settings-view')
};

const sidebar = document.getElementById('sidebar');
const sidebarTitle = document.getElementById('sidebar-title');
const sidebarLabels = document.querySelectorAll('.sidebar-label');

// State
let currentUser = null;
let currentReadings = [];
let dbStatus = 'connecting';

// --- Navigation ---
function showView(viewName) {
    // Hide all
    Object.values(views).forEach(el => el.classList.add('hidden'));

    // Show requested
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }

    // Manage Sidebar visibility
    if (viewName === 'dashboard' || viewName === 'settings') {
        sidebar.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
    }

    // Update active state in sidebar
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-cyan-900/30', 'text-neon-blue', 'border-cyan-500/30');
        btn.classList.add('text-gray-500');
        if (btn.dataset.target === viewName) {
            btn.classList.add('bg-cyan-900/30', 'text-neon-blue', 'border-cyan-500/30');
            btn.classList.remove('text-gray-500');
        }
    });

    // Special init for charts if entering dashboard
    if (viewName === 'dashboard') {
        // slight delay to allow layout to settle
        setTimeout(() => {
            if (currentReadings.length > 0) updateCharts(currentReadings);
        }, 100);
    }
}

// --- Sidebar Toggle ---
let isSidebarOpen = true;
function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    const sidebarEl = document.getElementById('sidebar-content');

    if (isSidebarOpen) {
        sidebarEl.classList.remove('w-20');
        sidebarEl.classList.add('w-64');
        sidebarTitle.style.display = 'block';
        sidebarLabels.forEach(l => l.style.display = 'inline');
    } else {
        sidebarEl.classList.remove('w-64');
        sidebarEl.classList.add('w-20');
        sidebarTitle.style.display = 'none';
        sidebarLabels.forEach(l => l.style.display = 'none');
    }
}

// --- Auth ---

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    handleAuthChange(session);
}

async function handleAuthChange(session) {
    if (session?.user) {
        // Fetch full profile
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        currentUser = {
            id: session.user.id,
            email: session.user.email,
            name: profile?.full_name || session.user.email.split('@')[0],
            role: profile?.role || 'operator'
        };

        updateUserUI();
        showView('dashboard');
        initRealtime();
    } else {
        currentUser = null;
        showView('landing');
    }
}

function updateUserUI() {
    if (!currentUser) return;
    document.getElementById('user-name-display').textContent = currentUser.name;
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-email').value = currentUser.email;
    document.getElementById('profile-role').innerText = currentUser.role.toUpperCase();

    // Show Admin tab if admin
    const adminBtn = document.getElementById('btn-tab-admin');
    if (currentUser.role === 'admin') {
        adminBtn.classList.remove('hidden');
    } else {
        adminBtn.classList.add('hidden');
    }
}

async function login(email, password) {
    // Basic validation
    if (!email || !password) {
        alert('Ingrese email y contraseña');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check role requirement? 
        // The original code checked role vs requested role. 
        // Here we just login and show dashboard, logic will handle features.

        checkSession();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    handleAuthChange(null);
}

// --- Data ---

async function initRealtime() {
    fetchData(); // Initial load

    // Subscribe
    const channel = supabaseClient
        .channel('mediciones_updates')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mediciones' }, payload => {
            console.log('New reading!', payload.new);
            addReading(payload.new);
        })
        .subscribe(status => {
            if (status === 'SUBSCRIBED') {
                updateDbStatus('connected');
            } else {
                updateDbStatus('error');
            }
        });
}

async function fetchData() {
    updateDbStatus('checking');
    try {
        const { data, error } = await supabaseClient
            .from('mediciones')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (data) {
            // Process data
            const formatted = data.reverse().map(d => formatReading(d));
            currentReadings = formatted;
            updateDashboard();
            updateDbStatus('connected');
        }
    } catch (e) {
        console.error(e);
        updateDbStatus('error');
    }
}

function formatReading(d) {
    return {
        timestamp: new Date(d.created_at).toLocaleTimeString(),
        ph: (d.ph || 0).toFixed(2),
        turbidity: (d.turbidez || 0).toFixed(1),
        tds: (d.tds || 0).toFixed(0),
        status: d.es_potable ? 'Potable' : 'No Potable'
    };
}

function addReading(raw) {
    const reading = formatReading(raw);
    currentReadings.push(reading);
    if (currentReadings.length > 20) currentReadings.shift();
    updateDashboard();
}

function updateDbStatus(status) {
    dbStatus = status;
    const el = document.getElementById('db-status');
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');

    // Reset classes
    el.className = 'flex items-center space-x-2 text-xs font-bold uppercase border px-3 py-2 rounded bg-opacity-10 shadow-[0_0_10px_rgba(0,0,0,0.2)] transition-colors';
    dot.className = 'w-2 h-2 rounded-full';

    if (status === 'connected') {
        el.classList.add('text-green-500', 'border-green-500', 'bg-green-500');
        dot.classList.add('bg-green-500', 'animate-pulse');
        text.textContent = 'CONEXIÓN: EXITOSA';
    } else if (status === 'error') {
        el.classList.add('text-red-500', 'border-red-500', 'bg-red-500');
        dot.classList.add('bg-red-500');
        text.textContent = 'ERROR DE CONEXIÓN';
    } else {
        el.classList.add('text-yellow-500', 'border-yellow-500', 'bg-yellow-500');
        dot.classList.add('bg-yellow-500', 'animate-bounce');
        text.textContent = 'CONECTANDO...';
    }
}

function updateDashboard() {
    if (currentReadings.length === 0) return;

    const latest = currentReadings[currentReadings.length - 1];

    // Update Gauges (Text for now, or sim)
    document.getElementById('val-ph').textContent = latest.ph;
    document.getElementById('val-tds').textContent = latest.tds;
    document.getElementById('val-turb').textContent = latest.turbidity;

    // Update Status
    const statusEl = document.getElementById('water-status');
    if (latest.status === 'Potable') {
        statusEl.innerHTML = `<span class="text-green-400">POTABLE</span>`;
    } else {
        statusEl.innerHTML = `<span class="text-red-500 animate-pulse">NO POTABLE</span>`;
    }

    // Update Charts
    updateCharts(currentReadings);
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {

    // Init External Modules
    Auth.init(); // Initialize Auth Listeners
    initCharts();

    // Check Auth Session
    checkSession();

    // Landing Buttons
    document.getElementById('btn-enter').addEventListener('click', () => {
        showView('auth');
        Auth.showSelection(); // Reset to selection when entering
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', logout);

    // Navigation
    document.getElementById('btn-nav-dashboard').addEventListener('click', () => showView('dashboard'));
    document.getElementById('btn-nav-settings').addEventListener('click', () => showView('settings'));

    // Sidebar Toggle
    document.getElementById('btn-sidebar-toggle').addEventListener('click', toggleSidebar);

    // Settings Tabs
    document.getElementById('btn-tab-profile').addEventListener('click', () => {
        document.getElementById('settings-profile').classList.remove('hidden');
        document.getElementById('settings-admin').classList.add('hidden');
        document.getElementById('btn-tab-profile').classList.add('bg-cyan-600', 'text-white', 'shadow-neon-blue');
        document.getElementById('btn-tab-profile').classList.remove('bg-gray-800', 'text-gray-500');
        document.getElementById('btn-tab-admin').classList.remove('bg-red-600', 'text-white', 'shadow-neon-red');
        document.getElementById('btn-tab-admin').classList.add('bg-gray-800', 'text-gray-500');
    });
    document.getElementById('btn-tab-admin').addEventListener('click', () => {
        document.getElementById('settings-profile').classList.add('hidden');
        document.getElementById('settings-admin').classList.remove('hidden');
        document.getElementById('btn-tab-admin').classList.add('bg-red-600', 'text-white', 'shadow-neon-red');
        document.getElementById('btn-tab-admin').classList.remove('bg-gray-800', 'text-gray-500');
        document.getElementById('btn-tab-profile').classList.remove('bg-cyan-600', 'text-white', 'shadow-neon-blue');
        document.getElementById('btn-tab-profile').classList.add('bg-gray-800', 'text-gray-500');

        // Load Users
        Admin.fetchUsers();
    });

    // Icons
    lucide.createIcons();
});
