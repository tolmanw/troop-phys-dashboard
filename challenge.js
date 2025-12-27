let challengeChart = null;

/* Helper to read numeric px from CSS variables */
function cssPx(varName) {
    return parseInt(
        getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
    );
}

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
        <div class="challenge-scroll">
            <div class="card">
                <h2 style="text-align:left; margin-bottom:10px;">
                    Monthly Challenge
                </h2>
                <canvas id="challengeChartCanvas"></canvas>
            </div>
        </div>
    `;

    const canvas = document.getElementById("challengeChartCanvas");

    /* FIXED PIXEL SIZE — from CSS variables */
    const width = cssPx("--challenge-canvas-width");
    const height = cssPx("--challenge-canvas-height");

    canvas.width = width;
    canvas.height = height;

    /* Prevent CSS from stretching the canvas */
    canvas.style.width = "auto";
    canvas.style.height = "auto";
    canvas.style.display = "block";

    const currentMonthIndex = monthNames.length - 1;

    /* Build cumulative datasets */
    const datasets = Object.values(athletesData).map(a => {
        const daily = a.daily_distance_km[currentMonthIndex] || [];
        let cumulative = 0;

        const data = daily.map(d =>
            +(cumulative += d * 0.621371).toFixed(2)
        );

        return {
            label: a.display_name,
            data,
            borderColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            borderWidth: 2
        };
    });

    /* Prevent rendering if all data is empty */
    const hasData = datasets.some(d => d.data.some(v => v > 0));
    if (!hasData) {
        canvas.remove();
        container.innerHTML +=
            "<p style='color:#e6edf3'>No challenge data for this month.</p>";
        return;
    }

    const labels = datasets[0].data.map((_, i) => i + 1);
    const maxDistance = Math.max(...datasets.flatMap(d => d.data), 10);

    challengeChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: false,           // disables auto scaling
            maintainAspectRatio: false,  // allows exact pixel dimensions
            plugins: {
                legend: {
                    display: true,
                    position: "bottom"
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Day of Month"
                    },
                    ticks: { maxRotation: 0, minRotation: 0 }
                },
                y: {
                    min: 0,
                    max: maxDistance + 5,
                    title: {
                        display: true,
                        text: "Cumulative Distance (mi)"
                    }
                }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;

                Object.values(athletesData).forEach((a, i) => {
                    const dataset = chart.data.datasets[i];
                    if (!dataset.data.length) return;

                    const lastIndex = dataset.data.length - 1;
                    const xPos = x.getPixelForValue(lastIndex + 1);
                    const yPos = y.getPixelForValue(dataset.data[lastIndex]);

                    const img = new Image();
                    img.src = a.profile;

                    img.onload = () => {
                        const size = 24;
                        ctx.drawImage(
                            img,
                            xPos - size / 2,
                            yPos - size / 2,
                            size,
                            size
                        );
                    };
                });
            }
        }]
    });
}

/* Toggle logic */
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

/* Initialize toggle after DOM and dashboard are ready */
document.addEventListener("DOMContentLoaded", () => {
    if (window.DASHBOARD && window.DASHBOARD.getData) {
        initChallengeToggle();
    } else {
        console.error("Dashboard not loaded yet.");
    }
});
