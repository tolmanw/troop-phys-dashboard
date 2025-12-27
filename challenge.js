let challengeChart = null;

// --- Set CSS root variables dynamically ---
const root = document.documentElement;
root.style.setProperty('--challenge-width', '700px');    // Card width
root.style.setProperty('--challenge-height', '400px');   // Chart height
root.style.setProperty('--challenge-padding', '20px');   // Card padding
root.style.setProperty('--font-size', '8px');            // Font size for chart labels

function destroyChallenge() {
    if (challengeChart) {
        challengeChart.destroy();
        challengeChart = null;
    }
    document.getElementById("challengeContainer").innerHTML = "";
}

function renderChallenge(athletesData, monthNames) {
    if (!athletesData || !monthNames) return;

    const container = document.getElementById("challengeContainer");
    container.innerHTML = `
        <div class="challenge-card">
            <h2>Monthly Challenge</h2>
            <canvas id="challengeChartCanvas"></canvas>
        </div>
    `;

    const card = container.querySelector(".challenge-card");
    const canvas = document.getElementById("challengeChartCanvas");
    const ctx = canvas.getContext("2d");

    // --- Read CSS variables from root ---
    const style = getComputedStyle(document.documentElement);
    const cardWidth = style.getPropertyValue('--challenge-width') || "700px";
    const chartHeight = style.getPropertyValue('--challenge-height') || "400px";
    const chartPadding = style.getPropertyValue('--challenge-padding') || "20px";
    const fontSize = parseInt(style.getPropertyValue('--font-size')) || 8;

    // --- Apply styles dynamically ---
    card.style.width = cardWidth;
    card.style.padding = chartPadding;
    card.style.background = "#1b1f25";
    card.style.borderRadius = "20px";
    card.style.margin = "0 auto"; // center card
    canvas.style.width = "100%";
    canvas.style.height = chartHeight;

    // --- Prepare data ---
    const currentMonthIndex = monthNames.length - 1;
    const datasets = Object.values(athletesData).map(a => {
        const daily = a.daily_distance_km[currentMonthIndex] || [];
        let cumulative = 0;
        return {
            label: a.display_name,
            data: daily.map(d => +(cumulative += d * 0.621371).toFixed(2)), // km → mi
            borderColor: `hsl(${Math.random() * 360},70%,60%)`,
            fill: false,
            tension: 0.3,
            pointRadius: 5,
            borderWidth: 3
        };
    });

    const hasData = datasets.some(d => d.data.length > 0);
    if (!hasData) {
        canvas.remove();
        container.innerHTML += "<p style='color:#e6edf3'>No challenge data for this month.</p>";
        return;
    }

    const labels = datasets[0].data.map((_, i) => i + 1);
    const maxDistanceMi = Math.max(...datasets.flatMap(d => d.data)) + 2; // 2 mile buffer

    // --- Create chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            layout: { padding: { bottom: parseInt(chartPadding) * 2 } },
            plugins: {
                legend: { display: true, position: "bottom", labels: { font: { size: fontSize } } },
                tooltip: { bodyFont: { size: fontSize }, titleFont: { size: fontSize } }
            },
            scales: {
                x: { title: { display: true, text: "Day of Month", font: { size: fontSize } }, ticks: { font: { size: fontSize }, maxRotation: 0, minRotation: 0 } },
                y: { min: 0, max: maxDistanceMi, title: { display: true, text: "Cumulative Distance (mi)", font: { size: fontSize } }, ticks: { font: { size: fontSize } } }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;
                Object.values(athletesData).forEach((a, i) => {
                    const dataset = chart.data.datasets[i];
                    if (!dataset || !dataset.data.length) return;
                    const lastIndex = dataset.data.length - 1;
                    const xPos = x.getPixelForValue(lastIndex + 1);
                    const yPos = y.getPixelForValue(dataset.data[lastIndex]);
                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
                        const size = window.innerWidth <= 600 ? 20 : 40;
                        ctx.drawImage(img, xPos - size / 2, yPos - size / 2, size, size);
                    };
                });
            }
        }]
    });
}

// --- Toggle logic ---
function initChallengeToggle() {
    const toggle = document.getElementById("challengeToggle");
    toggle.addEventListener("change", () => {
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");
        const on = toggle.checked;

        container.style.display = on ? "none" : "flex";
        challengeContainer.style.display = on ? "block" : "none";

        const { athletesData, monthNames } = window.DASHBOARD.getData();

        if (on) {
            window.DASHBOARD.destroyCharts();
            renderChallenge(athletesData, monthNames);
        } else {
            destroyChallenge();
            window.DASHBOARD.renderDashboard();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.DASHBOARD && window.DASHBOARD.getData) {
        initChallengeToggle();
    } else {
        console.error("Dashboard not loaded yet.");
    }
});
