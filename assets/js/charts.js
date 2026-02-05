
// Chart.js Configuration
// Relies on <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

let phChartInstance = null;
let tdsChartInstance = null;
let turbChartInstance = null;
// Gauge charts require a plugin or custom draw, effectively we might simulate gauges with doughnut charts or just use simple line/area charts as replacement for now to keep it vanilla simple, or try to recreate the gauge look.
// Recreating the exact gauge look from Recharts might be complex in Chart.js without plugins.
// For "versatility", standard charts are better. I will implement Area/Line charts for history, and maybe simple Doughnut charts for "Gauges" or just text values for now.
// The user likes "Neon Speedometer". I will try to implement a Doughnut chart that looks like a gauge.

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#000',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#333',
            borderWidth: 1
        }
    },
    scales: {
        x: {
            grid: { color: '#333' },
            ticks: { color: '#666', font: { size: 10 } }
        },
        y: {
            grid: { color: '#333' },
            ticks: { color: '#666', font: { size: 10 } }
        }
    },
    interaction: {
        intersect: false,
        mode: 'index',
    },
};

function initCharts() {
    // pH Chart
    const ctxPh = document.getElementById('phChart').getContext('2d');
    const gradePh = ctxPh.createLinearGradient(0, 0, 0, 400);
    gradePh.addColorStop(0, 'rgba(10, 255, 0, 0.3)');
    gradePh.addColorStop(1, 'rgba(10, 255, 0, 0)');

    phChartInstance = new Chart(ctxPh, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'pH',
                data: [],
                borderColor: '#0aff00',
                backgroundColor: gradePh,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: 0, max: 14 } // pH is 0-14
            }
        }
    });

    // TDS Chart
    const ctxTds = document.getElementById('tdsChart').getContext('2d');
    tdsChartInstance = new Chart(ctxTds, {
        type: 'line', // Step-like line
        data: {
            labels: [],
            datasets: [{
                label: 'TDS (ppm)',
                data: [],
                borderColor: '#00f3ff',
                backgroundColor: 'transparent',
                stepped: true,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: 0, max: 500 }
            }
        }
    });

    // Turbidity Chart
    const ctxTurb = document.getElementById('turbChart').getContext('2d');
    const gradeTurb = ctxTurb.createLinearGradient(0, 0, 0, 400);
    gradeTurb.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
    gradeTurb.addColorStop(1, 'rgba(168, 85, 247, 0)');

    turbChartInstance = new Chart(ctxTurb, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Turbidez (NTU)',
                data: [],
                borderColor: '#a855f7',
                backgroundColor: gradeTurb,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: 0, max: 10 }
            }
        }
    });
}

function updateCharts(readings) {
    if (!readings || readings.length === 0) return;

    // We take last 20 readings, reverse them for chronological order (left to right)
    // If input 'readings' comes from Supabase descending, we need to reverse.
    // The main code will likely handle sorting.

    const labels = readings.map(r => r.timestamp);
    const phData = readings.map(r => r.ph);
    const tdsData = readings.map(r => r.tds);
    const turbData = readings.map(r => r.turbidity);

    if (phChartInstance) {
        phChartInstance.data.labels = labels;
        phChartInstance.data.datasets[0].data = phData;
        phChartInstance.update();
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
