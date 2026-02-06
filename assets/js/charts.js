
// Chart.js Configuration
// Relies on <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

let phChartInstance = null;
let tdsChartInstance = null;
let turbChartInstance = null;

let phGaugeInstance = null;
let tdsGaugeInstance = null;
let turbGaugeInstance = null;



// --- NEEDLE PLUGIN (Adapted for 260 degrees) ---
const gaugeNeedle = {
    id: 'gaugeNeedle',
    afterDatasetDraw(chart, args, options) {
        const { ctx, config, data, chartArea: { top, bottom, left, right, width, height } } = chart;

        ctx.save();

        const needleValue = data.datasets[0].needleValue;
        const minVal = options.minVal || 0;
        const maxVal = options.maxVal || 100;

        // Normalize
        let normalized = (needleValue - minVal) / (maxVal - minVal);
        if (normalized < 0) normalized = 0;
        if (normalized > 1) normalized = 1;

        // 260 Degree Gauge Logic
        // Starting at 140 degrees (bottomish-left) to 400 degrees (bottomish-right)
        // Chart.js rotation: 230 deg (starts at 7 o'clock approx)
        // Circumference: 260 deg

        // Formula: StartAngle + (Normalized * Circumference)
        // In Radians:
        const startAngle = (Math.PI / 180) * 140;

        const totalAngle = Math.PI * (260 / 180);
        const angle = startAngle + (normalized * totalAngle);

        const cx = width / 2;
        const cy = height / 2 + 10; // Center vertically for 260 deg

        // Glow
        ctx.shadowColor = options.needleColor || '#fff';
        ctx.shadowBlur = 15;

        // Pivot Dot
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Needle
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(height / 2 - 10, 0);
        ctx.lineTo(0, 3);
        ctx.fillStyle = options.needleColor || '#fff';
        ctx.fill();

        ctx.restore();
    }
};

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
    },
    layout: { padding: 10 }
};

const historyOptions = {
    ...commonOptions,
    interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: { color: '#333' }, ticks: { color: '#666', font: { size: 10 } } },
        y: { grid: { color: '#333' }, ticks: { color: '#666', font: { size: 10 } } }
    }
};

function initCharts() {
    // Helper for Gradients
    const createGradient = (ctx, color1, color2) => {
        const gradient = ctx.createLinearGradient(0, 0, 150, 0);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };

    // Common Config for Tachometers
    const tachoConfig = {
        rotation: 230,
        circumference: 260,
        cutout: '85%', // Thinner arc
        borderRadius: 5,
        borderWidth: 0
    };

    // pH Gauge (0 - 14)
    const phCanvas = document.getElementById('gaugePh');
    if (phCanvas) {
        const ctx = phCanvas.getContext('2d');
        phGaugeInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Acid', 'Safe', 'Base'],
                datasets: [{
                    data: [6.5, 2, 5.5],
                    backgroundColor: [
                        '#ff0055', // Acid
                        '#0aff00', // Safe (Green)
                        '#ff0055'  // Base
                    ],
                    needleValue: 7,
                }]
            },
            options: {
                ...commonOptions,
                ...tachoConfig,
                plugins: {
                    ...commonOptions.plugins,
                    gaugeNeedle: { minVal: 0, maxVal: 14, needleColor: '#00f3ff' }
                }
            },
            plugins: [gaugeNeedle]
        });
    }

    // TDS Gauge (0 - 1000)
    const tdsCanvas = document.getElementById('gaugeTds');
    if (tdsCanvas) {
        const ctx = tdsCanvas.getContext('2d');
        tdsGaugeInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Good', 'Bad'],
                datasets: [{
                    data: [500, 500],
                    backgroundColor: [
                        '#00eaff',
                        '#ff0055'
                    ],
                    needleValue: 150,
                }]
            },
            options: {
                ...commonOptions,
                ...tachoConfig,
                plugins: {
                    ...commonOptions.plugins,
                    gaugeNeedle: { minVal: 0, maxVal: 1000, needleColor: '#fff' }
                }
            },
            plugins: [gaugeNeedle]
        });
    }

    // Turbidity Gauge (0 - 10)
    const turbCanvas = document.getElementById('gaugeTurb');
    if (turbCanvas) {
        const ctx = turbCanvas.getContext('2d');
        turbGaugeInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Clear', 'Turbid'],
                datasets: [{
                    data: [5, 5],
                    backgroundColor: [
                        '#d8b4fe',
                        '#ff0055'
                    ],
                    needleValue: 1,
                }]
            },
            options: {
                ...commonOptions,
                ...tachoConfig,
                plugins: {
                    ...commonOptions.plugins,
                    gaugeNeedle: { minVal: 0, maxVal: 10, needleColor: '#d8b4fe' }
                }
            },
            plugins: [gaugeNeedle]
        });
    }

    // --- HISTORY CHARTS (Unchanged) ---
    // ... (Keep existing history chart inits)
    const initHistory = (id, label, color, max) => {
        const canvas = document.getElementById(id);
        if (canvas) {
            // Check if instance exists globally before creating? 
            // Simplified for brevity, assume caller handles logic or this runs once.
            return new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { labels: [], datasets: [{ label: label, data: [], borderColor: color, tension: 0.4 }] },
                options: { ...historyOptions, scales: { ...historyOptions.scales, y: { min: 0, max: max } } }
            });
        }
    };

    if (!phChartInstance) phChartInstance = initHistory('phChart', 'pH', '#0aff00', 14);
    if (!tdsChartInstance) tdsChartInstance = initHistory('tdsChart', 'TDS', '#00eaff', 1000);
    if (!turbChartInstance) turbChartInstance = initHistory('turbChart', 'Turbidez', '#d8b4fe', 20);

    // Initial Render Call
    renderCharts(7, 300, 2.5);
}

function updateCharts(readings) {
    if (!readings || readings.length === 0) return;

    // Get latest Value
    const latest = readings[readings.length - 1]; // Assuming sorted ascending by date (if not check main.js)

    // UPDATE GAUGES
    if (phGaugeInstance) {
        // console.log("Updating pH Gauge:", latest.ph);
        phGaugeInstance.data.datasets[0].needleValue = latest.ph;
        phGaugeInstance.update();

        const el = document.getElementById('val-ph');
        if (el) {
            el.innerText = Number(latest.ph).toFixed(1);
            // Color Logic for Text/Glow
            const isSafe = latest.ph >= 6.5 && latest.ph <= 8.5;
            el.style.color = isSafe ? '#0aff00' : '#ff0055';
            // Also update glow
            el.style.textShadow = isSafe ? '0 0 15px rgba(10, 255, 0, 0.8)' : '0 0 15px rgba(255, 0, 85, 0.8)';
        } else {
            console.error("Element val-ph not found!");
        }
    } else {
        console.warn("phGaugeInstance not initialized");
    }

    if (tdsGaugeInstance) {
        tdsGaugeInstance.data.datasets[0].needleValue = latest.tds;
        tdsGaugeInstance.update();
        const el = document.getElementById('val-tds');
        if (el) {
            el.innerText = Math.round(latest.tds);
            const isSafe = latest.tds < 500;
            el.style.color = isSafe ? '#00f3ff' : '#ff0055';
            el.style.textShadow = isSafe ? '0 0 15px rgba(0, 243, 255, 0.8)' : '0 0 15px rgba(255, 0, 85, 0.8)';
        }
    }

    if (turbGaugeInstance) {
        turbGaugeInstance.data.datasets[0].needleValue = latest.turbidity;
        turbGaugeInstance.update();
        const el = document.getElementById('val-turb');
        if (el) {
            el.innerText = latest.turbidity.toFixed(1); // Decimals often needed for turbidity
            const isSafe = latest.turbidity < 5;
            el.style.color = isSafe ? '#a855f7' : '#ff0055';
            el.style.textShadow = isSafe ? '0 0 15px rgba(168, 85, 247, 0.8)' : '0 0 15px rgba(255, 0, 85, 0.8)';
        }
    }

    // UPDATE HISTORY CHARTS
    const labels = readings.map(r => {
        const d = new Date(r.timestamp || r.created_at); // Use timestamp if pre-formatted
        return isNaN(d.getTime()) ? new Date().toLocaleTimeString() : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const phData = readings.map(r => r.ph);
    const tdsData = readings.map(r => r.tds);
    const turbData = readings.map(r => r.turbidity);


    // Debug Log
    console.log("Updating Charts with:", latest);

    if (phChartInstance) {
        phChartInstance.data.labels = labels;
        phChartInstance.data.datasets[0].data = phData;
        phChartInstance.update();
    } else {
        console.warn("phChartInstance not found");
    }
    if (tdsChartInstance) {
        tdsChartInstance.data.labels = labels;
        tdsChartInstance.data.datasets[0].data = tdsData;
        tdsChartInstance.update();
    }
    if (turbChartInstance) {
        turbChartInstance.data.labels = labels;
        turbChartInstance.data.datasets[0].data = turbData;
        turbChartInstance.update();
    }
}

// Deprecated Mock Function (Keep for compatibility if called)
function renderCharts(ph, tds, turb) {
    /* No op or initial set */
    if (phGaugeInstance) {
        phGaugeInstance.data.datasets[0].needleValue = ph;
        phGaugeInstance.update();
    }
}
