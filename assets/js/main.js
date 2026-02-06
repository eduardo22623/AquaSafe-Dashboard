
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
            role: profile?.role || 'operator',
            deviceId: null // Will fetch
        };

        // Fetch Device
        const { data: device } = await supabaseClient
            .from('devices')
            .select('mac_address')
            .eq('user_id', currentUser.id)
            .single();

        if (device) currentUser.deviceId = device.mac_address;

        updateUserUI();
        showView('dashboard');
        initRealtime();
        resetInactivityTimer(); // Start timer
    } else {
        currentUser = null;
        showView('landing');
        clearTimeout(inactivityTimeout); // Stop timer
    }
}

function updateUserUI() {
    if (!currentUser) return;
    document.getElementById('user-name-display').innerText = currentUser.name;
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-email').value = currentUser.email;
    document.getElementById('profile-role').innerText = currentUser.role.toUpperCase();

    // Display Admin-specific controls or hide User-specific ones
    const deviceSection = document.getElementById('device-management-section');
    const simSection = document.getElementById('simulation-section');
    const dbAdminContent = document.getElementById('dashboard-admin-content'); // New
    const dbUserContent = document.getElementById('dashboard-user-content');   // New

    if (currentUser.role === 'admin') {
        if (deviceSection) deviceSection.classList.add('hidden');
        if (simSection) simSection.classList.add('hidden');

        // --- Dashboard Clean-up for Admin ---
        if (dbAdminContent) dbAdminContent.classList.remove('hidden');
        if (dbUserContent) dbUserContent.classList.add('hidden');

    } else {
        if (deviceSection) deviceSection.classList.remove('hidden');
        if (simSection) simSection.classList.remove('hidden');

        // --- Dashboard Restore for User ---
        if (dbAdminContent) dbAdminContent.classList.add('hidden');
        if (dbUserContent) dbUserContent.classList.remove('hidden');

        // Only update device UI if visible (User)
        const deviceInput = document.getElementById('device-mac');
        const deviceBtn = document.getElementById('btn-save-device');

        if (currentUser.deviceId) {
            deviceInput.value = currentUser.deviceId;
            deviceInput.disabled = true;
            deviceInput.classList.add('opacity-50', 'cursor-not-allowed');

            deviceBtn.disabled = true;
            deviceBtn.innerText = 'Vinculado';
            deviceBtn.classList.remove('bg-cyan-600', 'hover:bg-cyan-500');
            deviceBtn.classList.add('bg-gray-700', 'text-gray-400', 'cursor-not-allowed');
        } else {
            deviceInput.value = '';
            deviceInput.disabled = false;
            deviceInput.classList.remove('opacity-50', 'cursor-not-allowed');

            deviceBtn.disabled = false;
            deviceBtn.innerText = 'Guardar';
            deviceBtn.classList.add('bg-cyan-600', 'hover:bg-cyan-500');
            deviceBtn.classList.remove('bg-gray-700', 'text-gray-400', 'cursor-not-allowed');
        }
    }

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
            console.log('New reading received:', payload.new);
            // Verify if reading belongs to current user's device
            if (currentUser && currentUser.deviceId && payload.new.device_id === currentUser.deviceId) {
                addReading(payload.new);
                // Also trigger a simulated notification or highlight if needed
            } else if (currentUser && currentUser.role === 'admin') {
                // Admin sees all? Or maybe just current view?
                // For now, let's assume Admin Dashboard shows all or needs specific filter.
                // If simple admin view, add it.
                addReading(payload.new);
            }
        })
        .subscribe((status) => {
            console.log("Realtime Status:", status);
            if (status === 'SUBSCRIBED') {
                updateDbStatus('connected');
            } else {
                // updateDbStatus('error'); // Don't show error immediately, as it might just be connecting
            }
        });
}

async function fetchData() {
    updateDbStatus('checking');
    try {
        let query = supabaseClient
            .from('mediciones')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        // Filter by Device if Operator and has device
        if (currentUser && currentUser.role !== 'admin' && currentUser.deviceId) {
            query = query.eq('device_id', currentUser.deviceId);
        } else if (currentUser && currentUser.role !== 'admin' && !currentUser.deviceId) {
            // No device linked
            updateDbStatus('connected');
            currentReadings = [];
            updateDashboard();
            return;
        }

        const { data, error } = await query;

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
        ph: Number(d.ph || 0),
        turbidity: Number(d.turbidez || 0),
        tds: Number(d.tds || 0),
        status: d.es_potable ? 'Potable' : 'No Potable'
    };
}

function addReading(raw) {
    const reading = formatReading(raw);
    currentReadings.push(reading);
    if (currentReadings.length > 20) currentReadings.shift();
    updateDashboard(); // This updates the UI
}

function updateDbStatus(status) {
    dbStatus = status;
    const el = document.getElementById('db-status-indicator');
    if (!el) return;

    // Reset base classes
    el.className = 'px-3 py-1 rounded border text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all';

    if (status === 'connected') {
        el.className += ' border-green-500/50 bg-green-900/20 text-green-400';
        el.innerHTML = '<i data-lucide="wifi" width="14"></i> CONECTADO';
    } else if (status === 'error') {
        el.className += ' border-red-500/50 bg-red-900/20 text-red-400';
        el.innerHTML = '<i data-lucide="wifi-off" width="14"></i> DESCONECTADO';
    } else {
        el.className += ' border-yellow-500/50 bg-yellow-900/20 text-yellow-400 animate-pulse';
        el.innerHTML = '<i data-lucide="loader-2" width="14" class="animate-spin"></i> CONECTANDO';
    }

    // Refresh icons since we replaced innerHTML
    if (window.lucide) lucide.createIcons();
}

function updateDashboard() {
    if (currentReadings.length === 0) return;

    const latest = currentReadings[currentReadings.length - 1];

    // Update Status
    const statusEl = document.getElementById('water-status-indicator');
    if (statusEl) {
        if (latest.status === 'Potable') {
            statusEl.innerHTML = `<span class="text-green-400 flex items-center gap-2"><i data-lucide="check-circle" width="16"></i> POTABLE</span>`;
        } else {
            statusEl.innerHTML = `<span class="text-red-500 animate-pulse flex items-center gap-2"><i data-lucide="alert-triangle" width="16"></i> NO POTABLE</span>`;
        }
        if (window.lucide) lucide.createIcons();
    }

    // Update Charts (and Gauges text)
    updateCharts(currentReadings);
}

let inactivityTimeout;
const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 Minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    if (currentUser) {
        inactivityTimeout = setTimeout(() => {
            alert('Su sesión ha expirado por inactividad.');
            Auth.logout();
        }, INACTIVITY_LIMIT);
    }
}

// Global Event Listeners for inactivity
['mousemove', 'keydown', 'click', 'scroll'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer);
});


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

        // Load Users and Monitor
        Admin.fetchUsers();
    });

    // Refresh Monitor Button
    // Refresh Monitor Button (Admin Only)
    const btnRefresh = document.getElementById('btn-refresh-monitor');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            Admin.fetchDeviceMonitor();
        });
    }

    // Icons
    lucide.createIcons();

    // --- Device Management ---
    const btnSaveDevice = document.getElementById('btn-save-device');
    btnSaveDevice.addEventListener('click', async () => {
        const mac = document.getElementById('device-mac').value.trim();
        if (!mac) return alert('⚠️ Ingrese una dirección MAC válida (Ej: A0:B1:C2:D3:E4:F5).');

        // Visual Feedback
        const originalText = btnSaveDevice.innerText;
        btnSaveDevice.innerText = 'Verificando...';
        btnSaveDevice.disabled = true;

        try {
            // 1. Check if device exists
            const { data: existingDevice, error: fetchError } = await supabaseClient
                .from('devices')
                .select('*')
                .eq('mac_address', mac)
                .maybeSingle(); // Use maybeSingle to avoid error on null

            if (existingDevice) {
                // Device exists. Check owner.
                if (existingDevice.user_id && existingDevice.user_id !== currentUser.id) {
                    throw new Error("⛔ Este dispositivo (MAC) ya pertenece a otro usuario.");
                }

                // It's mine, just update name/timestamp if needed
                const { error: updateError } = await supabaseClient
                    .from('devices')
                    .update({
                        name: `Dispositivo de ${currentUser.name}`,
                        // user_id is already correct
                    })
                    .eq('mac_address', mac);

                if (updateError) throw updateError;
                alert('✅ Dispositivo confirmado. Ya estaba vinculado a tu cuenta.');

            } else {
                // Device does not exist. Create it.
                const { error: insertError } = await supabaseClient
                    .from('devices')
                    .insert({
                        mac_address: mac,
                        user_id: currentUser.id,
                        name: `Dispositivo de ${currentUser.name}`
                    });

                if (insertError) {
                    // Check specifically for Duplicate Key (in case race condition or RLS hidden)
                    if (insertError.code === '23505') {
                        throw new Error("⛔ Este dispositivo ya está registrado por otro usuario.");
                    }
                    throw insertError;
                }
                alert('✅ Nuevo dispositivo registrado exitosamente.');
            }

            // Critical: Update Local State immediately
            currentUser.deviceId = mac;

            // Lock UI immediately
            updateUserUI(); // Fixed function name

            // Force refresh of Realtime Subscription AND fetch data immediately
            if (window.subscription) supabaseClient.removeChannel(window.subscription);
            initRealtime();
            fetchData(); // <-- Explicit fetch to update charts/gauges immediately

        } catch (e) {
            console.error("Device Link Error:", e);
            // Show detailed error if available
            const msg = e.message || JSON.stringify(e) || 'Error desconocido';
            alert('❌ No se pudo vincular: ' + msg);
        } finally {
            btnSaveDevice.innerText = originalText;
            btnSaveDevice.disabled = false;
        }
    });

    // --- Simulator ---
    const btnSimSend = document.getElementById('btn-sim-send');
    btnSimSend.addEventListener('click', async () => {
        // Validation with specific message
        if (!currentUser || !currentUser.id) return alert('⚠️ Error: Sesión no válida. Recargue la página.');
        if (!currentUser.deviceId) return alert('⚠️ Error: No tiene dispositivo vinculado. Use el formulario de arriba primero.');

        // Visual Feedback
        const originalIcon = btnSimSend.innerHTML;
        btnSimSend.innerText = 'Enviando...';
        btnSimSend.disabled = true;

        const ph = parseFloat(document.getElementById('sim-ph').value);
        const tds = parseInt(document.getElementById('sim-tds').value);
        const turb = parseFloat(document.getElementById('sim-turb').value);

        // Potability Logic
        const isPotable = (ph >= 6.5 && ph <= 8.5) && (tds < 500) && (turb < 10);

        try {
            console.log(`Sending Data -> Device: ${currentUser.deviceId}, User: ${currentUser.id}`);

            const { error } = await supabaseClient
                .from('mediciones')
                .insert({
                    device_id: currentUser.deviceId,
                    ph: ph,
                    tds: tds,
                    turbidez: turb,
                    es_potable: isPotable
                });

            if (error) throw error;

            alert('✅ Dato simulado enviado con éxito!');

            // Fallback: Fetch data manually to ensure UI updates even if Realtime is filtered/slow
            fetchData();

        } catch (e) {
            console.error('Sim Error:', e);
            alert('❌ Error enviando dato: ' + (e.message || e.details));
        } finally {
            btnSimSend.innerHTML = originalIcon;
            btnSimSend.disabled = false;
        }
    });
});
