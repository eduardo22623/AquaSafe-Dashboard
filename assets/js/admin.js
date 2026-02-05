
// Admin Module
// Handles User Management and Threshold configuration

const Admin = {
    state: {
        users: [],
        thresholds: { phMin: 6.5, phMax: 8.5, tdsMax: 500 }
    },

    init() {
        document.getElementById('btn-save-thresholds').addEventListener('click', () => this.saveThresholds());
        document.getElementById('btn-refresh-users').addEventListener('click', () => this.fetchUsers());
    },

    async fetchUsers() {
        const tableBody = document.getElementById('admin-users-table');
        tableBody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">Actualizando lista...</td></tr>';

        try {
            // Removed .order('created_at') because the column does not exist
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*');

            if (error) throw error;

            this.state.users = data;
            this.renderUsers();

        } catch (e) {
            console.error('Error fetching users:', e);
            tableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
        }
    },

    renderUsers() {
        const tableBody = document.getElementById('admin-users-table');
        tableBody.innerHTML = '';

        if (this.state.users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-600">No se encontraron usuarios</td></tr>';
            return;
        }

        this.state.users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-red-950/10 transition group';

            // Name & Email
            const nameCell = document.createElement('td');
            nameCell.className = 'px-4 py-3';
            nameCell.innerHTML = `
                <div class="font-medium text-white">${user.full_name || 'Sin Nombre'}</div>
                <div class="text-gray-600 text-xs">${user.email || 'Sin Email'}</div> 
            `;

            // Role Badge
            const roleCell = document.createElement('td');
            roleCell.className = 'px-4 py-3';
            const roleColor = user.role === 'admin' ? 'text-red-400 border-red-900/50 bg-red-900/20' : 'text-blue-400 border-blue-900/50 bg-blue-900/20';
            roleCell.innerHTML = `<span class="px-2 py-1 rounded text-xs border ${roleColor}">${user.role ? user.role.toUpperCase() : 'N/A'}</span>`;

            // Action (Select)
            const actionCell = document.createElement('td');
            actionCell.className = 'px-4 py-3';

            const select = document.createElement('select');
            select.className = `px-2 py-1 rounded text-xs border bg-black focus:outline-none cursor-pointer border-gray-700 text-gray-300 hover:border-gray-500`;
            select.innerHTML = `
                <option value="operator" ${user.role === 'operator' ? 'selected' : ''}>Operator</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            `;
            // Only allow changing if not self? -> Logic handling in update
            select.onchange = (e) => this.updateRole(user.id, e.target.value, user.full_name);

            actionCell.appendChild(select);

            // Status
            const statusCell = document.createElement('td');
            statusCell.className = 'px-4 py-3 text-green-500 text-xs uppercase font-bold';
            statusCell.innerText = 'Activo';

            tr.appendChild(nameCell);
            tr.appendChild(roleCell);
            tr.appendChild(actionCell);
            tr.appendChild(statusCell);

            tableBody.appendChild(tr);
        });
    },

    async updateRole(userId, newRole, userName) {
        if (!confirm(`¿Estás seguro de cambiar el rol de ${userName} a ${newRole.toUpperCase()}?`)) {
            this.fetchUsers(); // Revert UI
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            alert(`Rol actualizado exitosamente.`);
            this.fetchUsers(); // Refresh list

        } catch (e) {
            alert(`Error actualizando rol: ${e.message}`);
            this.fetchUsers();
        }
    },

    saveThresholds() {
        const phMin = document.getElementById('admin-ph-min').value;
        const phMax = document.getElementById('admin-ph-max').value;
        const tdsMax = document.getElementById('admin-tds-max').value;

        // In a real app we'd save this to DB. For now we just verify input and show success.
        console.log('Saving thresholds:', { phMin, phMax, tdsMax });
        alert('Configuración global actualizada (Simulación)');
    }
};
