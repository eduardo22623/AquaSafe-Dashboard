// Admin Module
// Handles Device Monitor and simple User Management

const Admin = {
    state: {
        users: [],
        thresholds: { phMin: 6.5, phMax: 8.5, tdsMax: 500 }
    },

    init() {
        // Init listeners if elements exist
        const refreshBtns = document.querySelectorAll('.btn-refresh-monitor');
        refreshBtns.forEach(btn => {
            btn.addEventListener('click', () => this.fetchDeviceMonitor());
        });
    },

    // --- Main Feature: Device Monitor ---
    async fetchDeviceMonitor() {
        const usersBody = document.getElementById('admin-users-body');
        const devicesBody = document.getElementById('admin-devices-body');
        if (!usersBody || !devicesBody) return;

        // Loading State
        usersBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500 animate-pulse">Cargando usuarios...</td></tr>';
        devicesBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 animate-pulse">Cargando dispositivos...</td></tr>';

        try {
            const [devicesResponse, usersResponse] = await Promise.all([
                supabaseClient.from('admin_device_monitor').select('*'),
                supabaseClient.from('profiles').select('*')
            ]);

            if (devicesResponse.error) throw devicesResponse.error;
            if (usersResponse.error) throw usersResponse.error;

            this.renderUsers(usersResponse.data);
            this.renderDevices(devicesResponse.data);
            this.initRealtime();

        } catch (e) {
            console.error("Admin Monitor Error:", e);
            usersBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
            devicesBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
        }
    },

    renderUsers(users) {
        const usersBody = document.getElementById('admin-users-body');
        usersBody.innerHTML = '';

        if (!users || users.length === 0) {
             usersBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">No hay usuarios registrados.</td></tr>';
             return;
        }

        users.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-800 hover:bg-white/5 transition-colors';
            
            tr.innerHTML = `
                <td class="p-3 text-white font-medium break-all text-xs">
                    <div>${row.full_name || 'Sin Nombre'} <span class="text-[10px] text-gray-500 uppercase tracking-widest ml-2">(${row.role || 'operator'})</span></div>
                    <div class="text-[10px] text-gray-500 font-normal mt-1">${row.address || 'Sin Dirección'}</div>
                </td>
                <td class="p-3 text-gray-400 text-sm break-all">${row.phone || row.email || '--'}</td>
                <td class="p-3 text-center">
                    <button onclick="Admin.deleteUser('${row.id}')" class="px-3 py-1 bg-red-900/50 hover:bg-red-600 text-red-500 hover:text-white rounded border border-red-500/30 text-[10px] uppercase font-bold transition flex items-center justify-center gap-1 mx-auto" title="Eliminar Usuario">
                        <i data-lucide="user-x" width="14"></i> Eliminar
                    </button>
                </td>
            `;
            usersBody.appendChild(tr);
        });
        
        if (window.lucide) window.lucide.createIcons();
    },

    renderDevices(data) {
        const devicesBody = document.getElementById('admin-devices-body');
        devicesBody.innerHTML = '';

        const devices = data && data.length > 0 ? data.filter(r => r.mac_address) : [];
        if (devices.length === 0) {
            devicesBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay dispositivos vinculados.</td></tr>';
            return;
        } 

        devices.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-800 hover:bg-white/5 transition-colors';

            let statusHtml = '<span class="px-2 py-1 rounded text-xs bg-gray-800 text-gray-500">Sin Datos</span>';
            if (row.last_reading_at) {
                if (row.is_potable !== false) {
                     statusHtml = '<span class="px-2 py-1 rounded text-xs bg-green-900/50 text-green-400 border border-green-500/30">ACTIVO</span>';
                } else {
                     statusHtml = '<span class="px-2 py-1 rounded text-xs bg-red-900/50 text-red-500 border border-red-500/30 animate-pulse">ALERTA</span>';
                }
            }

            const dateStr = row.last_reading_at ? new Date(row.last_reading_at).toLocaleString() : '--';

            tr.innerHTML = `
                <td class="p-3 text-cyan-400 font-mono text-xs">${row.mac_address}</td>
                <td class="p-3 text-gray-300 text-sm font-medium">${row.client_name || 'Sin Asignar'}</td>
                <td class="p-3 text-gray-300">
                    <div class="flex flex-col text-xs space-y-1">
                        <span class="flex justify-between w-24"><span>pH:</span> <b class="text-white">${row.last_ph ?? '--'}</b></span>
                        <span class="flex justify-between w-24"><span>TDS:</span> <b class="text-white">${row.last_tds ?? '--'}</b></span>
                        <span class="flex justify-between w-24"><span>Turb:</span> <b class="text-white">${row.last_turbidity ?? '--'}</b></span>
                        <span class="text-[10px] text-gray-600 border-t border-gray-800 pt-1 mt-1">${dateStr}</span>
                    </div>
                </td>
                <td class="p-3 text-center">${statusHtml}</td>
                <td class="p-3 text-center">
                    <button onclick="Admin.deleteDevice('${row.mac_address}')" class="px-3 py-1 bg-yellow-900/50 hover:bg-yellow-600 text-yellow-400 hover:text-white rounded border border-yellow-500/30 text-[10px] uppercase font-bold transition flex items-center justify-center gap-1 mx-auto" title="Eliminar Dispositivo">
                        <i data-lucide="trash-2" width="14"></i> Eliminar
                    </button>
                </td>
            `;
            devicesBody.appendChild(tr);
        });

        if (window.lucide) window.lucide.createIcons();
    },

    initRealtime() {
        if (this.subscription) return;

        // Listen for new measurements to refresh table
        this.subscription = supabaseClient
            .channel('admin_monitor_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mediciones' }, () => {
                // Debounce simple
                setTimeout(() => this.fetchDeviceMonitor(), 500);
            })
            // Listen for device changes
            .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
                setTimeout(() => this.fetchDeviceMonitor(), 500);
            })
            .subscribe();
    },

    // Placeholder to avoid errors if main.js calls fetchUsers
    async fetchUsers() {
        // Redirect to monitor fetch
        await this.fetchDeviceMonitor();
    },

    // --- Delete Device ---
    async deleteDevice(macAddress) {
        if (!confirm(`¿Estás seguro de que deseas ELIMINAR el dispositivo ${macAddress}? Esta acción borrará todas sus mediciones y lo desvinculará del usuario actual.`)) return;

        try {
            // Utilizamos el RPC (Stored Procedure) creado para el admin
            const { error } = await supabaseClient.rpc('admin_delete_device', { p_mac_address: macAddress });

            if (error) throw error;

            alert('Dispositivo eliminado exitosamente.');
            this.fetchDeviceMonitor();
        } catch (e) {
            console.error("Error al eliminar dispositivo:", e);
            alert(`Error al eliminar dispositivo: ${e.message}`);
        }
    },

    // --- Delete User ---
    async deleteUser(userId) {
        if (!confirm('¡ADVERTENCIA! ¿Estás seguro de que deseas ELIMINAR a este usuario por completo? Esto borrará permanentemente su cuenta, su perfil y todos sus dispositivos vinculados. ¡Esta acción es irreversible!')) return;

        try {
            // Utilizamos el RPC (Stored Procedure) creado para el admin
            const { error } = await supabaseClient.rpc('admin_delete_user', { p_user_id: userId });

            if (error) throw error;

            alert('Usuario eliminado exitosamente.');
            this.fetchDeviceMonitor();
        } catch (e) {
            console.error("Error al eliminar usuario:", e);
            alert(`Error al eliminar usuario: ${e.message}`);
        }
    }
};

// Expose to window
window.Admin = Admin;
