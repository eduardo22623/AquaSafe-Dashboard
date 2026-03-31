// Reports Module
// Handles historical summaries and intelligent diagnosis

const Reports = {
    elements: {
        date: document.getElementById('report-date'),
        avgTds: document.getElementById('report-avg-tds'),
        alertCard: document.getElementById('report-alert-card'),
        alertTitle: document.getElementById('report-alert-title'),
        alertDesc: document.getElementById('report-alert-desc'),
        causesContainer: document.getElementById('report-causes-container'),
        causesList: document.getElementById('report-causes-list'),
        iconWrapper: document.getElementById('report-icon-wrapper'),
        iconContainer: document.getElementById('report-icon-container'),
        eventsList: document.getElementById('report-events-list'),
        yesterdayList: document.getElementById('report-yesterday-list')
    },

    yesterdayFetched: false,

    update(readings) {
        if (!readings || readings.length === 0) {
            this.setEmptyState();
            return;
        }

        // Set Date
        const today = new Date();
        if (this.elements.date) {
            this.elements.date.innerText = today.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
        }

        // Calculate Average TDS for the UI Card
        const sum = readings.reduce((acc, curr) => acc + (curr.tds || 0), 0);
        const avgTds = sum / readings.length;
        
        if (this.elements.avgTds) {
            this.elements.avgTds.innerText = Math.round(avgTds);
        }

        // Render Recent History cleanly (All current readings up to memory limit)
        this.renderHistory(readings);

        // Run Intelligent Diagnosis INSTANTLY with the very latest reading
        const latestTds = readings[readings.length - 1].tds;
        this.runDiagnosis(latestTds);
        
        // Fetch yesterday's peaks once
        if (!this.yesterdayFetched) {
            this.fetchYesterdayPeaks();
            this.yesterdayFetched = true;
        }
    },

    setEmptyState() {
        if (this.elements.avgTds) this.elements.avgTds.innerText = '--';
        
        if (this.elements.alertCard) {
            this.elements.alertCard.className = 'rounded-2xl p-6 border transition-all duration-500 relative overflow-hidden bg-gray-900/50 border-gray-700 opacity-50 grayscale';
            this.elements.iconWrapper.className = 'p-4 rounded-full flex-shrink-0 relative bg-gray-800 text-gray-500';
            this.elements.iconContainer.innerHTML = '<i data-lucide="info" width="32" height="32"></i>';
            this.elements.alertTitle.innerText = 'Sin Datos';
            this.elements.alertTitle.className = 'text-xl font-bold mb-1 uppercase tracking-wide text-gray-400';
            this.elements.alertDesc.innerText = 'Esperando mediciones del sensor para emitir un diagnóstico.';
            this.elements.causesContainer.classList.add('hidden');
        }

        if (this.elements.eventsList) {
            this.elements.eventsList.innerHTML = '<div class="text-center text-gray-600 text-sm py-4">Esperando historial...</div>';
            this.elements.eventsList.className = 'space-y-3'; // Reset scrolling classes
        }
        
        if (window.lucide) window.lucide.createIcons();
    },

    renderHistory(readings) {
        if (!this.elements.eventsList) return;

        // Take up to 50 recent readings and display in a scrollable list
        const recent = [...readings].reverse().slice(0, 50);

        // Make container scrollable if there are many items
        this.elements.eventsList.className = 'space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-800';

        let html = '';
        recent.forEach((r, i) => {
            const isDanger = r.tds >= 500;
            const badgeClass = isDanger ? 'bg-red-900/40 text-red-500 border border-red-500/30' : 'bg-green-900/40 text-green-400 border border-green-500/30';
            const badgeText = isDanger ? 'ALERTA TDS' : 'Agua Limpia';
            const valColor = isDanger ? 'text-red-400' : 'text-green-400';

            html += `
                <div class="flex items-center justify-between p-3 rounded-lg bg-gray-900/30 border border-gray-800 hover:bg-gray-800 transition-colors">
                    <div class="flex items-center gap-4">
                        <div class="text-gray-500 text-xs font-mono w-16">${r.timestamp}</div>
                        <div class="text-white font-bold text-sm tracking-widest"><span class="${valColor}">${Math.round(r.tds)}</span> ppm</div>
                    </div>
                    <div class="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${badgeClass}">
                        ${badgeText}
                    </div>
                </div>
            `;
        });

        this.elements.eventsList.innerHTML = html;
    },

    runDiagnosis(tds) {
        if (!this.elements.alertCard) return;

        let state = 'unknown'; // excellent, good, warning, danger
        let title = '';
        let desc = '';
        let causes = [];

        // Logic based on requested ranges
        if (tds < 50) {
            state = 'excellent';
            title = 'Agua Ultra Pura';
            desc = 'Los niveles de minerales disueltos son extremadamente bajos. Ideal para sistemas críticos o uso en laboratorios.';
        } else if (tds >= 50 && tds <= 250) {
            state = 'good';
            title = 'Agua Potable Ideal';
            desc = 'El nivel de TDS está en el rango perfecto para consumo humano sin riesgos de sedimentación.';
        } else if (tds > 250 && tds < 500) {
            state = 'warning';
            title = 'Agua Moderadamente Dura';
            desc = 'Se detectan ciertos niveles de minerales. No es tóxica, pero el sabor podría verse afectado y podría dejar sarro leve en tuberías.';
        } else if (tds >= 500) {
            state = 'danger';
            title = 'ALERTA: AGUA MUY CONDUCTIVA (NO POTABLE)';
            desc = 'Se ha detectado una concentración peligrosa de Sólidos Disueltos (TDS > 500 ppm). El agua presenta riesgo para su consumo directo.';
            causes = [
                'Alta salinidad en la fuente de suministro (sal/cloruros residuales).',
                'Filtros de Ósmosis Inversa (RO) perforados o saturados que necesitan reemplazo urgente.',
                'Disolución de metales pesados o sedimentos debido a tuberías oxidadas.',
                'Contaminación biológica severa o alteración química externa.'
            ];
        }

        // Apply UI styling based on state
        const cardClasses = {
            'excellent': 'bg-green-900/20 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]',
            'good': 'bg-cyan-900/20 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
            'warning': 'bg-yellow-900/20 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]',
            'danger': 'bg-red-900/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse-slow'
        };

        const titleClasses = {
            'excellent': 'text-green-400',
            'good': 'text-cyan-400',
            'warning': 'text-yellow-400',
            'danger': 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]'
        };
        
        const iconContainerClasses = {
            'excellent': 'bg-green-500/20 text-green-400',
            'good': 'bg-cyan-500/20 text-cyan-400',
            'warning': 'bg-yellow-500/20 text-yellow-400',
            'danger': 'bg-red-500/20 text-red-500'
        };

        const icons = {
            'excellent': 'check-circle',
            'good': 'droplets',
            'warning': 'alert-triangle',
            'danger': 'skull' // Or 'x-octagon'
        };

        // Reset base classes and apply new
        this.elements.alertCard.className = `rounded-2xl p-6 border transition-all duration-500 relative overflow-hidden ${cardClasses[state]}`;
        this.elements.iconWrapper.className = `p-4 rounded-full flex-shrink-0 relative ${iconContainerClasses[state]}`;
        this.elements.alertTitle.className = `text-xl font-bold mb-1 uppercase tracking-wide ${titleClasses[state]}`;
        
        this.elements.alertTitle.innerText = title;
        this.elements.alertDesc.innerText = desc;
        this.elements.iconContainer.innerHTML = `<i data-lucide="${icons[state]}" width="32" height="32"></i>`;

        // Render Causes
        if (causes.length > 0) {
            this.elements.causesContainer.classList.remove('hidden');
            // Theme the inner container elements matching danger text
            this.elements.causesContainer.querySelector('h3').className = `text-xs uppercase font-bold tracking-widest mb-3 opacity-80 border-b border-current/20 pb-1 inline-block ${titleClasses['danger']}`;
            this.elements.causesList.className = `space-y-2 text-sm text-gray-300 list-disc ml-5 marker:${titleClasses['danger']}`;
            
            this.elements.causesList.innerHTML = causes.map(c => `<li>${c}</li>`).join('');
        } else {
            this.elements.causesContainer.classList.add('hidden');
        }

        if (window.lucide) window.lucide.createIcons();
    },

    async fetchYesterdayPeaks() {
        if (!this.elements.yesterdayList) return;
        
        if (!currentUser) return;
        const deviceId = currentUser.role !== 'admin' ? currentUser.deviceId : null;
        
        // Define yesterday range (local time estimation for simplicity)
        const now = new Date();
        const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0).toISOString();
        const endYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59).toISOString();
        
        try {
            let query = supabaseClient
                .from('mediciones')
                .select('*')
                .gte('created_at', startYesterday)
                .lte('created_at', endYesterday)
                .order('tds', { ascending: false }) // Get highest peaks
                .limit(10);
                
            if (deviceId) {
                query = query.eq('device_id', deviceId);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            if (!data || data.length === 0) {
                this.elements.yesterdayList.innerHTML = '<div class="text-center text-gray-600 text-sm py-8"><i data-lucide="inbox" class="mx-auto mb-2 opacity-50" width="32"></i>No se registraron datos de este dispositivo ayer.</div>';
                if (window.lucide) window.lucide.createIcons();
                return;
            }
            
            let html = '';
            // Only take the top 5 highest to not saturate the list
            const peaks = data.slice(0, 5);
            
            peaks.forEach(r => {
                const isDanger = r.tds >= 500;
                const badgeClass = isDanger ? 'bg-red-900/40 text-red-500 border border-red-500/30' : 'bg-yellow-900/40 text-yellow-500 border border-yellow-500/30';
                const badgeText = isDanger ? 'PELIGRO' : 'PICO ALTO';
                const valColor = isDanger ? 'text-red-400' : 'text-yellow-400';
                
                // Extraer solo la hora de created_at para mostrar
                const time = new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

                html += `
                    <div class="flex items-center justify-between p-3 rounded-lg bg-gray-900/30 border border-gray-800 hover:bg-gray-800 transition-colors">
                        <div class="flex items-center gap-4">
                            <div class="text-gray-500 text-xs font-mono w-14 flex items-center gap-1"><i data-lucide="clock" width="12"></i> ${time}</div>
                            <div class="text-white font-bold text-sm tracking-widest"><span class="${valColor}">${Math.round(r.tds)}</span> ppm</div>
                        </div>
                        <div class="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${badgeClass}">
                            ${badgeText}
                        </div>
                    </div>
                `;
            });
            
            this.elements.yesterdayList.innerHTML = html;
            
        } catch (e) {
            console.error('Error fetching yesterday peaks:', e);
            this.elements.yesterdayList.innerHTML = '<div class="text-center text-red-500/50 text-sm py-4">Error al cargar historial de ayer.</div>';
        }

        if (window.lucide) window.lucide.createIcons();
    }
};

window.Reports = Reports;
