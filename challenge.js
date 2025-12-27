let challengeChart = null;

// --- Root variables for chart sizing ---
const root = document.documentElement;
root.style.setProperty('--challenge-width', '700px');    // Card width
root.style.setProperty('--challenge-height', '400px');   // Chart height
root.style.setProperty('--challenge-padding', '15px');   // Card padding
root.style.setProperty('--challenge-font-size', '8px');  // Font size
root.style.setProperty('--challenge-right-padding', '50px'); // Right padding for athlete images

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
    const chartPadding = style.getPropertyValue('--challenge-padding') || "15px";
    const fontSize = parseInt(style.getPropertyValue('--challenge-font-size')) || 8;
    const rightPadding = style.getPropertyValue('--challenge-right-padding') || "50px";

    // --- Apply styles dynamically ---
    card.style.width = cardWidth;
    card.style.padding = chartPadding;
    card.style.paddingRight = rightPadding;
    card.style.background = "#1b1f25";
    card.style.borderRadius = "20px";
    card.style.margin = "0";
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
            pointRadius: 0, // remove points
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
    const maxDistanceMi = Math.ceil(Math.max(...datasets.flatMap(d => d.data)) + 1); // +1 mile, round up

    // --- Create chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            layout: { padding: { bottom: parseInt(chartPadding) } },
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
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(xPos, yPos, size / 2, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(img, xPos - size / 2, yPos - size / 2, size, size);
                        ctx.restore();
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
        const container = document.getElementById("container"); // dashboard cards
        const challengeContainer = document.getElementById("challengeContainer"); // monthly challenge
        const dailyLine = document.getElementById("dailySelectorLine"); // daily distance line
        const on = toggle.checked;

        container.style.display = on ? "none" : "flex";
        challengeContainer.style.display = on ? "block" : "none";
        dailyLine.style.display = on ? "none" : "flex"; // hide only daily distance line

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
