let challengeChart = null;

// --- Set CSS root variables dynamically ---
const root = document.documentElement;
root.style.setProperty('--challenge-width', '700px');    // default card width
root.style.setProperty('--challenge-height', '400px');   // chart height
root.style.setProperty('--challenge-padding', '20px');   // card padding
root.style.setProperty('--font-size', '8px');            // font size for chart labels
root.style.setProperty('--challenge-right-padding', '60px'); // right padding for images

function destroyChallenge() {
    if (challengeChart) {
        challengeChart.destroy();
        challengeChart = null;
    }
    const container = document.getElementById("challengeContainer");
    container.innerHTML = "";
}

function renderChallenge(athletesData, monthNames) {
    if (!athletesData || !monthNames) return;

    const container = document.getElementById("challengeContainer");
    container.innerHTML = `
        <div class="challenge-card">
            <h2 style="font-size: var(--font-size);">Monthly Challenge</h2>
            <canvas id="challengeChartCanvas"></canvas>
        </div>
    `;

    const card = container.querySelector(".challenge-card");
    const canvas = document.getElementById("challengeChartCanvas");
    const ctx = canvas.getContext("2d");

    // --- Read CSS root variables ---
    const style = getComputedStyle(document.documentElement);
    const cardWidth = style.getPropertyValue('--challenge-width') || "700px";
    const chartHeight = style.getPropertyValue('--challenge-height') || "400px";
    const chartPadding = style.getPropertyValue('--challenge-padding') || "20px";
    const fontSize = parseInt(style.getPropertyValue('--font-size')) || 8;
    const rightPadding = parseInt(style.getPropertyValue('--challenge-right-padding')) || 60;

    // --- Card styling ---
    card.style.width = cardWidth;
    card.style.padding = chartPadding;
    card.style.paddingRight = rightPadding + "px";
    card.style.background = "#1b1f25";
    card.style.borderRadius = "20px";
    card.style.margin = "0";
    card.style.fontSize = fontSize + "px";

    // --- Canvas sizing ---
    const screenWidth = window.innerWidth;
    canvas.width = card.clientWidth;
    canvas.height = screenWidth <= 600 ? 300 : parseInt(chartHeight);

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
    // max distance buffer: +1 mile, round up
    const maxDistanceMi = Math.ceil(Math.max(...datasets.flatMap(d => d.data)) + 1);

    // --- Chart creation ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            layout: { padding: { bottom: parseInt(chartPadding) * 1.5 } }, // reduced bottom padding
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
                        const size = screenWidth <= 600 ? 20 : 40;
                        // draw round images
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(xPos, yPos, size / 2, 0, Math.PI * 2);
                        ctx.closePath();
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
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");
        const monthSelector = document.getElementById("dailyMonthSelector");
        const on = toggle.checked;

        // Capture container position to preserve layout
        const containerRect = container.getBoundingClientRect();

        if (on) {
            // Hide dashboard elements but preserve space
            container.style.visibility = "hidden";
            monthSelector.style.display = "none";

            // Show challenge container
            challengeContainer.style.display = "block";

            // Align challenge card to dashboard position
            const card = challengeContainer.querySelector(".challenge-card");
            card.style.marginLeft = containerRect.left + "px";
            card.style.width = containerRect.width + "px";

            const { athletesData, monthNames } = window.DASHBOARD.getData();
            window.DASHBOARD.destroyCharts();
            renderChallenge(athletesData, monthNames);
        } else {
            // Show dashboard again
            container.style.visibility = "visible";
            monthSelector.style.display = "inline-block";

            // Hide challenge
            challengeContainer.style.display = "none";
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
