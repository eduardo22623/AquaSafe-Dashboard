
// Authentication Module
// Handles UI for Selection, Login, Register and Logic for Supabase Auth

const Auth = {
    state: {
        role: null, // 'user' or 'admin'
        view: 'selection' // 'selection', 'login', 'register'
    },

    elements: {
        container: document.getElementById('auth-view'),
        selection: document.getElementById('auth-selection'),
        login: document.getElementById('auth-login'),
        register: document.getElementById('auth-register'),
        loginTitle: document.getElementById('login-title'),
        loginIcon: document.getElementById('login-icon'),
        loginBtn: document.getElementById('btn-login-submit')
    },

    init() {
        // Event Listeners

        // Selection Cards
        document.getElementById('btn-select-user').addEventListener('click', () => this.showLogin('user'));
        document.getElementById('btn-select-admin').addEventListener('click', () => this.showLogin('admin'));
        document.getElementById('btn-select-register').addEventListener('click', () => this.showRegister());

        // Back Buttons
        document.querySelectorAll('.btn-auth-back').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.state.view === 'login' || this.state.view === 'register') {
                    this.showSelection();
                } else {
                    // Back from selection -> Landing
                    showView('landing');
                }
            });
        });

        // Forms
        document.getElementById('btn-login-submit').addEventListener('click', () => this.handleLogin());
        document.getElementById('btn-register-submit').addEventListener('click', () => this.handleRegister());

        // Password Visibility Toggles
        document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);

                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = '<i data-lucide="eye-off" width="20"></i>';
                } else {
                    input.type = 'password';
                    btn.innerHTML = '<i data-lucide="eye" width="20"></i>';
                }
                lucide.createIcons();
            });
        });
    },

    showSelection() {
        this.state.view = 'selection';
        this.toggleViews('selection');
    },

    showLogin(role) {
        this.state.role = role;
        this.state.view = 'login';

        // Update UI based on role
        const isUser = role === 'user';
        this.elements.loginTitle.innerText = isUser ? 'ACCESO OPERADOR' : 'ACCESO ADMINISTRATIVO';
        this.elements.loginTitle.className = `text-xl font-bold font-orbitron ${isUser ? 'text-cyan-400' : 'text-red-500'}`;

        // Update Icon
        // We use Lucide icons, so we need to re-render or toggle visibility of specific icons?
        // Simpler: Just swap innerHTML or toggle classes on a wrapper.
        const iconWrapper = document.getElementById('login-icon-wrapper');
        iconWrapper.className = `inline-block p-3 rounded-full mb-3 shadow-lg ${isUser ? 'bg-cyan-900/20 shadow-cyan-900/20' : 'bg-red-900/20 shadow-red-900/20'}`;
        iconWrapper.innerHTML = isUser
            ? '<i data-lucide="user" class="text-cyan-400" width="32" height="32"></i>'
            : '<i data-lucide="shield" class="text-red-500" width="32" height="32"></i>';

        // Re-scan icons
        lucide.createIcons();

        // Update Button
        this.elements.loginBtn.className = `w-full font-bold py-3 rounded-lg transition-all shadow-lg uppercase tracking-widest text-sm ${isUser
            ? 'bg-cyan-600 hover:bg-cyan-500 text-black shadow-cyan-900/40'
            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'}`;
        this.elements.loginBtn.innerText = isUser ? 'Iniciar Sesión' : 'Autenticar Admin';

        // Update Input Styles
        const inputs = document.querySelectorAll('#auth-login input');
        inputs.forEach(input => {
            input.className = `w-full px-4 py-3 bg-black/50 border rounded-lg text-white focus:outline-none transition-all placeholder-gray-700 ${isUser
                ? 'border-cyan-900/50 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                : 'border-red-900/50 focus:border-red-500 focus:shadow-[0_0_10px_rgba(255,0,0,0.2)]'}`;
        });

        this.toggleViews('login');
    },

    showRegister() {
        this.state.view = 'register';
        this.toggleViews('register');
    },

    toggleViews(activeId) {
        // IDs: auth-selection, auth-login, auth-register
        ['selection', 'login', 'register'].forEach(id => {
            const el = document.getElementById(`auth-${id}`);
            if (id === activeId) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
    },

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;

        if (!email || !pass) {
            alert('Ingrese credenciales');
            return;
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;

            console.log('User authenticated:', data.user.id);

            // Fetch Profile to verify Role
            const { data: profileError, data: profile } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            // Default to operator if no profile (legacy support)
            const realRole = profile?.role || 'operator';

            console.log(`Requested: ${this.state.role}, Actual: ${realRole}`);

            if (this.state.role === 'admin' && realRole !== 'admin') {
                await supabaseClient.auth.signOut();
                alert('ACCESO DENEGADO: No tiene privilegios de administrador.');
                return;
            }

            // Success
            checkSession(); // Main.js function to load dashboard

        } catch (e) {
            alert('Login Error: ' + e.message);
        }
    },

    async handleRegister() {
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const fullName = document.getElementById('reg-name').value.trim();
        const phone = document.getElementById('reg-phone')?.value.trim() || '';
        const address = document.getElementById('reg-address')?.value.trim() || '';

        // Validation
        if (!email || !password || !fullName || !phone || !address) {
            alert('⚠️ Por favor complete TODOS los campos obligatorios para continuar.');
            return;
        }

        const btn = document.getElementById('btn-register-submit');
        const originalText = btn.innerHTML;

        // Loading State
        btn.disabled = true;
        btn.innerHTML = `<div class="flex items-center justify-center gap-2"><div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Registrando...</div>`;

        try {
            // 1. Sign Up
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            });

            if (error) throw error;

            // 2. Update Profile
            if (data?.user) {
                const { error: profileError } = await supabaseClient
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        phone: phone,
                        address: address
                    })
                    .eq('id', data.user.id);

                if (profileError) {
                    console.error("Error updating profile details:", profileError);
                    // Don't throw here, basics worked.
                }
            }

            // Success
            alert('✅ ¡Cuenta creada exitosamente!\nPor favor inicia sesión con tu nueva cuenta.');
            this.showLogin('user'); // Go to login

        } catch (e) {
            alert('❌ Error al registrar: ' + e.message);
        } finally {
            // Reset Button
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },
};
