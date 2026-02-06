// Admin Module
// Handles Device Monitor and simple User Management

const Admin = {
    state: {
        users: [],
        thresholds: { phMin: 6.5, phMax: 8.5, tdsMax: 500 }
    },

    init() {
        // Init listeners if elements exist
        const refreshBtn = document.getElementById('btn-refresh-monitor');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.fetchDeviceMonitor());
        }
    },

    // --- Main Feature: Device Monitor ---
    async fetchDeviceMonitor() {
        const tableBody = document.getElementById('admin-monitor-body');
        if (!tableBody) return;

        // Loading State
        tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 animate-pulse">Cargando datos...</td></tr>';

        try {
            const { data, error } = await supabaseClient
                .from('admin_device_monitor')
                .select('*');

            if (error) throw error;

            this.renderTable(data);
            this.initRealtime();

        } catch (e) {
            console.error("Admin Monitor Error:", e);
            tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
        }
    },

    renderTable(data) {
        const tableBody = document.getElementById('admin-monitor-body');
        tableBody.innerHTML = '';

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay dispositivos registrados.</td></tr>';
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-800 hover:bg-white/5 transition-colors';

            // Format Status
            let statusHtml = '<span class="px-2 py-1 rounded text-xs bg-gray-800 text-gray-500">Sin Datos</span>';
            if (row.last_reading_at) {
                if (row.is_potable) {
                    statusHtml = '<span class="px-2 py-1 rounded text-xs bg-green-900/50 text-green-400 border border-green-500/30">POTABLE</span>';
                } else {
                    statusHtml = '<span class="px-2 py-1 rounded text-xs bg-red-900/50 text-red-500 border border-red-500/30 animate-pulse">NO POTABLE</span>';
                }
            }

            // Format Date
            const dateStr = row.last_reading_at ? new Date(row.last_reading_at).toLocaleString() : '--';

            tr.innerHTML = `
                <td class="p-3 text-white font-medium break-all text-xs">
                    <div>${row.client_name || 'Sin Asignar'}</div>
                    <div class="text-[10px] text-gray-500 font-normal mt-1">${row.client_address || 'Sin Dirección'}</div>
                </td>
                <td class="p-3 text-gray-400 text-sm break-all">${row.contact_info || '--'}</td>
                <td class="p-3 text-cyan-400 font-mono text-xs">${row.mac_address}</td>
                <td class="p-3 text-gray-300">
                    <div class="flex flex-col text-xs space-y-1">
                        <span class="flex justify-between w-24"><span>pH:</span> <b class="text-white">${row.last_ph ?? '--'}</b></span>
                        <span class="flex justify-between w-24"><span>Turb:</span> <b class="text-white">${row.last_turbidity ?? '--'}</b></span>
                        <span class="flex justify-between w-24"><span>TDS:</span> <b class="text-white">${row.last_tds ?? '--'}</b></span>
                        <span class="text-[10px] text-gray-600 border-t border-gray-800 pt-1 mt-1">${dateStr}</span>
                    </div>
                </td>
                <td class="p-3 text-center">${statusHtml}</td>
            `;
            tableBody.appendChild(tr);
        });
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
    }
};

// Expose to window
window.Admin = Admin;
