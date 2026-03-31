// Admin Module
// Handles Device Monitor and simple User Management

const Admin = {
    state: {
        users: [],
        thresholds: { phMin: 6.5, phMax: 8.5, tdsMax: 500 },
        autoRefreshInterval: null
    },

    init() {
        // Botones de refresh manual
        const refreshBtns = document.querySelectorAll('.btn-refresh-monitor');
        refreshBtns.forEach(btn => {
            btn.addEventListener('click', () => this.fetchDeviceMonitor());
        });

        // Botón registrar nuevo dispositivo
        const btnAddDevice = document.getElementById('btn-admin-add-device');
        if (btnAddDevice) {
            btnAddDevice.addEventListener('click', () => this.registerNewDevice());
        }
    },

    // Arrancar auto-refresh cada 10s mientras el panel admin esté visible
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.fetchDeviceMonitor();
        this.state.autoRefreshInterval = setInterval(() => this.fetchDeviceMonitor(), 10000);
    },

    stopAutoRefresh() {
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
            this.state.autoRefreshInterval = null;
        }
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
            devicesBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay dispositivos registrados aún.</td></tr>';
            return;
        }

        devices.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-800 hover:bg-white/5 transition-colors';

            // Estado basado en last_reading_at e is_potable (alias de es_potable en la vista)
            let statusHtml = '<span class="px-2 py-1 rounded text-xs bg-gray-800 text-gray-500">Sin Datos</span>';
            if (row.last_reading_at) {
                if (row.is_potable === true || row.is_potable === null) {
                    statusHtml = '<span class="px-2 py-1 rounded text-xs bg-green-900/50 text-green-400 border border-green-500/30">✓ ACTIVO</span>';
                } else {
                    statusHtml = '<span class="px-2 py-1 rounded text-xs bg-red-900/50 text-red-500 border border-red-500/30 animate-pulse">⚠ ALERTA</span>';
                }
            }

            // Tiempo desde última lectura
            let dateStr = '--';
            if (row.last_reading_at) {
                const d = new Date(row.last_reading_at);
                const diffMs = Date.now() - d.getTime();
                const diffMin = Math.floor(diffMs / 60000);
                if (diffMin < 1) dateStr = 'Hace unos segundos';
                else if (diffMin < 60) dateStr = `Hace ${diffMin} min`;
                else dateStr = d.toLocaleString();
            }

            tr.innerHTML = `
                <td class="p-3">
                    <div class="text-cyan-400 font-mono text-xs">${row.mac_address}</div>
                    <div class="text-gray-600 text-[10px] mt-0.5">${row.device_name || ''}</div>
                </td>
                <td class="p-3 text-sm">
                    ${row.client_name
                        ? `<span class="text-gray-300 font-medium">${row.client_name}</span>`
                        : `<span class="text-yellow-500/70 text-xs italic">Sin asignar</span>`
                    }
                </td>
                <td class="p-3">
                    <div class="flex flex-col text-xs space-y-1">
                        <span class="flex justify-between w-28"><span class="text-gray-500">TDS:</span> <b class="text-cyan-300">${row.last_tds != null ? row.last_tds + ' ppm' : '--'}</b></span>
                        <span class="flex justify-between w-28"><span class="text-gray-500">pH:</span> <b class="text-white">${row.last_ph ?? '--'}</b></span>
                        <span class="flex justify-between w-28"><span class="text-gray-500">Turb:</span> <b class="text-white">${row.last_turbidity ?? '--'}</b></span>
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

    // Placeholder: main.js puede llamar fetchUsers
    async fetchUsers() {
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
    },

    // --- Add New Device (Pre-Register) ---
    async registerNewDevice() {
        const macInput = document.getElementById('admin-new-mac');
        const nameInput = document.getElementById('admin-new-name');
        const btn = document.getElementById('btn-admin-add-device');
        
        const mac = macInput.value.trim().toUpperCase();
        const name = nameInput.value.trim() || 'ESP32 TDS Sensor';

        if (!mac) return alert('Por favor, ingrese una dirección MAC válida.');

        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Registrando...';
        btn.disabled = true;

        try {
            // Llamamos a la función segura para que el admin inserte un dispositivo sin dueño
            const { error } = await supabaseClient.rpc('admin_create_device', {
                p_mac_address: mac,
                p_name: name
            });

            if (error) throw error;

            alert('¡Dispositivo registrado exitosamente en el inventario!');
            macInput.value = '';
            nameInput.value = '';
            this.fetchDeviceMonitor(); // Refrescar tabla
        } catch (e) {
            console.error("Error al pre-registrar dispositivo:", e);
            alert(`Error al registrar el dispositivo: ${e.message}\n(Posiblemente la MAC ya existe)`);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (window.lucide) window.lucide.createIcons();
        }
    }
};

// Expose to window
window.Admin = Admin;
