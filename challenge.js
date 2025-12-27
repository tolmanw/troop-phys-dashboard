let challengeChart = null;

// --- Set CSS root variables dynamically ---
const root = document.documentElement;
root.style.setProperty('--challenge-width', '700px');    // Card width
root.style.setProperty('--challenge-height', '400px');   // Chart height
root.style.setProperty('--challenge-padding', '15px');   // Card padding
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

    // --- Read root variables ---
    const cardWidth = getComputedStyle(root).getPropertyValue('--challenge-width') || '700px';
    const chartHeight = getComputedStyle(root).getPropertyValue('--challenge-height') || '400px';
    const chartPadding = getComputedStyle(root).getPropertyValue('--challenge-padding') || '15px';
    const fontSize = parseInt(getComputedStyle(root).getPropertyValue('--font-size')) || 8;

    // --- Apply card and canvas styles ---
    card.style.width = cardWidth;
    card.style.padding = chartPadding;
    card.style.background = "#1b1f25";
    card.style.borderRadius = "20px";
    card.style.margin = "0";
    canvas.style.width = "100%";
    canvas.style.height = chartHeight;

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
            pointRadius: 0, // no points
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

    // --- Y-axis max with +1 mile buffer, rounded up ---
    const maxDistanceMi = Math.ceil(Math.max(...datasets.flatMap(d => d.data)) + 1);

    // --- Athlete images plugin ---
    const athleteImagesPlugin = {
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
                    // draw circle mask for round image
                    ctx.beginPath();
                    ctx.arc(xPos, yPos, size/2, 0, 2 * Math.PI);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(img, xPos - size/2, yPos - size/2, size, size);
                    ctx.restore();
                };
            });
        }
    };

    // --- Create chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            layout: { padding: { bottom: parseInt(chartPadding) } }, // reduced bottom padding
            plugins: {
                legend: { display: true, position: "bottom", labels: { font: { size: fontSize } } },
                tooltip: { bodyFont: { size: fontSize }, titleFont: { size: fontSize } }
            },
            scales: {
                x: {
                    title: { display: true, text: "Day of Month", font: { size: fontSize } },
                    ticks: { font: { size: fontSize }, maxRotation: 0, minRotation: 0 }
                },
                y: {
                    min: 0,
                    max: maxDistanceMi,
                    title: { display: true, text: "Cumulative Distance (mi)", font: { size: fontSize } },
                    ticks: { font: { size: fontSize } }
                }
            }
        },
        plugins: [athleteImagesPlugin]
    });
}

// --- Toggle logic ---
function initChallengeToggle() {
    const toggle = document.getElementById("challengeToggle");
    const monthSelector = document.getElementById("dailyMonthSelector");

    toggle.addEventListener("change", () => {
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");
        const on = toggle.checked;

        // Show/hide dashboard container and challenge
        container.style.display = on ? "none" : "flex";
        challengeContainer.style.display = on ? "block" : "none";

        // Hide only the Daily Distance Month selector without moving toggle label
        if (monthSelector) monthSelector.style.visibility = on ? "hidden" : "visible";

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
