let challengeChart = null;

// --- Global neon color cache ---
const athleteColors = {};

// --- Root CSS variables for easy control ---
const root = document.documentElement;

// Default desktop styles
function setDefaultStyles() {
    root.style.setProperty('--challenge-width', '700px');       
    root.style.setProperty('--challenge-height', '400px');      
    root.style.setProperty('--challenge-padding', '15px');      
    root.style.setProperty('--challenge-padding-right', '60px'); 
    root.style.setProperty('--font-size', '8px');               
}

// Mobile / desktop settings
function getSettings() {
    const isMobile = window.innerWidth <= 600;
    return {
        fontSize: isMobile ? 6 : 8,
        athleteImgSize: isMobile ? 20 : 40,
        chartHeight: isMobile ? 250 : 400, // used for card height
        chartPadding: isMobile ? 8 : 15,
        paddingRight: isMobile ? 8 : 60,
    };
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
        <div class="challenge-card">
            <h2>Monthly Challenge</h2>
            <canvas id="challengeChartCanvas"></canvas>
        </div>
    `;

    const card = container.querySelector(".challenge-card");
    const canvas = document.getElementById("challengeChartCanvas");
    const ctx = canvas.getContext("2d");

    // --- Mobile / desktop settings ---
    const { fontSize, athleteImgSize, chartHeight, chartPadding, paddingRight } = getSettings();

    // --- Apply styles dynamically ---
    card.style.width = '100%';
    card.style.padding = `${chartPadding}px`;
    card.style.background = "#1b1f25";
    card.style.borderRadius = "20px";
    card.style.margin = "0";
    card.style.height = chartHeight + "px";  // constrain height to prevent over-expansion

    canvas.style.width = "100%";
    canvas.style.height = "100%"; // canvas fills container height

    // --- Prepare datasets ---
    const currentMonthIndex = monthNames.length - 1;

    const datasets = Object.values(athletesData).map(a => {
        const daily = a.daily_distance_km[currentMonthIndex] || [];
        let cumulative = 0;

        if (!athleteColors[a.display_name]) {
            const hue = Math.floor(Math.random() * 360);
            athleteColors[a.display_name] = `hsl(${hue}, 100%, 50%)`; // neon-style
        }

        return {
            label: a.display_name,
            data: daily.map(d => +(cumulative += d * 0.621371).toFixed(2)), // km → mi
            borderColor: athleteColors[a.display_name],
            fill: false,
            tension: 0.3,
            pointRadius: 0,
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
    const maxDistanceMi = Math.ceil(Math.max(...datasets.flatMap(d => d.data)) + 1);

    // --- Create chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { bottom: chartPadding, right: paddingRight } },
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
                    let xPos = x.getPixelForValue(lastIndex + 1);
                    let yPos = y.getPixelForValue(dataset.data[lastIndex]);

                    const size = athleteImgSize;
                    xPos = Math.min(xPos, chart.width - size/2 - paddingRight);

                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
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
        const monthLabel = monthSelector.previousElementSibling;
        const on = toggle.checked;

        container.style.display = on ? "none" : "flex";
        challengeContainer.style.display = on ? "block" : "none";

        if (monthSelector) monthSelector.style.display = on ? "none" : "inline-block";
        if (monthLabel) monthLabel.style.display = on ? "none" : "inline-block";

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

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
    if (window.DASHBOARD && window.DASHBOARD.getData) {
        initChallengeToggle();
        window.addEventListener('resize', () => {
            if (challengeChart) {
                destroyChallenge();
                const { athletesData, monthNames } = window.DASHBOARD.getData();
                renderChallenge(athletesData, monthNames);
            }
        });
    } else {
        console.error("Dashboard not loaded yet.");
    }
});