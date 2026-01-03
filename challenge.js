let challengeChart = null;

// --- Global neon color cache ---
const athleteColors = {};

// --- Mobile / desktop settings ---
function getSettings() {
    const isMobile = window.innerWidth <= 600;
    return {
        isMobile,
        fontSize: isMobile ? 6 : 8,
        athleteImgSize: isMobile ? 20 : 40,
        chartHeight: isMobile ? 340 : 450,
        chartPadding: isMobile ? 10 : 20,
        chartPaddingBottom: isMobile ? 20 : 20,
        paddingRight: isMobile ? 20 : 20,
        cardWidth: isMobile ? "100%" : "700px",
        headerPaddingTop: 12,
        headerFontSize: isMobile ? 12 : 16
    };
}

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
        <div class="challenge-card challenge-rules-card">
            <h3>Challenge Rules</h3>
            <div class="challenge-rules"></div>
        </div>

        <div class="challenge-card">
            <h2>Monthly Challenge</h2>
            <canvas id="challengeChartCanvas"></canvas>
        </div>

        <div class="challenge-card challenge-summary-card">
            <h3>Totals</h3>
            <div class="challenge-summary"></div>
        </div>
    `;

    const rulesCard = container.querySelector(".challenge-rules-card");
    const rulesTitle = rulesCard.querySelector("h3");
    const rulesBody = rulesCard.querySelector(".challenge-rules");

    const card = container.querySelector(".challenge-card:nth-of-type(2)");
    const canvas = document.getElementById("challengeChartCanvas");
    const ctx = canvas.getContext("2d");

    const summaryCard = container.querySelector(".challenge-summary-card");
    const summaryTitle = summaryCard.querySelector("h3");
    const summary = summaryCard.querySelector(".challenge-summary");

    const {
        isMobile,
        fontSize,
        athleteImgSize,
        chartHeight,
        chartPadding,
        chartPaddingBottom,
        paddingRight,
        cardWidth,
        headerPaddingTop,
        headerFontSize
    } = getSettings();

    // --- Rules card styling ---
    rulesCard.style.width = cardWidth;
    rulesCard.style.margin = "0 0 12px 0";
    rulesCard.style.boxSizing = "border-box";
    rulesCard.style.padding = `${isMobile ? 10 : 12}px ${chartPadding}px`;
    rulesCard.style.background = "#1b1f25";
    rulesCard.style.borderRadius = "15px";

    rulesTitle.style.margin = "0 0 8px 0";
    rulesTitle.style.fontSize = headerFontSize + "px";
    rulesTitle.style.color = "#e6edf3";

    rulesBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;line-height:1.4;">
            <div>🏊‍♂️ <strong>Swim</strong>: 1 mile = <strong>4 points</strong></div>
            <div>🏃‍♂️ <strong>Run</strong>: 1 mile = <strong>1 point</strong></div>
            <div>🚴‍♂️ <strong>Bike</strong>: 1 mile = <strong>0.25 points</strong></div>
            <div>🏋️ <strong>Weights</strong>: 10 mins = <strong>1 point</strong></div>
        </div>
    `;
    rulesBody.style.minHeight = "40px";
    rulesBody.style.fontSize = fontSize + "px";
    rulesBody.style.color = "#e6edf3";
    rulesBody.style.opacity = "0.85";

    // --- Chart card styling ---
    card.style.width = cardWidth;
    card.style.margin = "0";
    card.style.boxSizing = "border-box";
    card.style.padding = `${headerPaddingTop}px ${chartPadding}px ${chartPadding}px ${chartPadding}px`;
    card.style.height = chartHeight + "px";
    card.style.background = "#1b1f25";
    card.style.borderRadius = "15px";

    const title = card.querySelector("h2");
    title.style.margin = "0 0 8px 0";
    title.style.fontSize = headerFontSize + "px";
    title.style.color = "#e6edf3";

    canvas.style.width = "100%";
    canvas.style.height = "100%";

    // --- Summary card styling ---
    summaryCard.style.width = cardWidth;
    summaryCard.style.margin = "12px 0 0 0";
    summaryCard.style.boxSizing = "border-box";
    summaryCard.style.padding = `${isMobile ? 10 : 12}px ${chartPadding}px`;
    summaryCard.style.background = "#1b1f25";
    summaryCard.style.borderRadius = "15px";

    summaryTitle.style.margin = "0 0 8px 0";
    summaryTitle.style.fontSize = headerFontSize + "px";
    summaryTitle.style.color = "#e6edf3";

    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "4px";
    summary.style.fontSize = fontSize + "px";
    summary.style.color = "#e6edf3";

    // --- Prepare datasets for cumulative points ---
    const pointsPerActivity = {
        Swim: 4,
        Run: 1,
        Bike: 0.25,
        Weights: 0.1
    };

    const datasets = Object.values(athletesData).map(a => {
        const daily = a.daily || [];
        let cumulative = 0;

        if (!athleteColors[a.display_name]) {
            athleteColors[a.display_name] =
                `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
        }

        const dailyPoints = daily.map(d => {
            let dayPoints = 0;
            if (d.activities && d.activities.length) {
                d.activities.forEach(act => {
                    const actLower = act.toLowerCase();
                    if (actLower.includes("swim")) dayPoints += (d.distance_km || 0) * pointsPerActivity.Swim;
                    else if (actLower.includes("run")) dayPoints += (d.distance_km || 0) * pointsPerActivity.Run;
                    else if (actLower.includes("bike")) dayPoints += (d.distance_km || 0) * pointsPerActivity.Bike;
                    else if (actLower.includes("weight")) dayPoints += (d.time_min || 0) * pointsPerActivity.Weights;
                });
            }
            return +(cumulative += dayPoints).toFixed(2);
        });

        return {
            label: a.display_name,
            data: dailyPoints,
            borderColor: athleteColors[a.display_name],
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 0
        };
    });

    const hasData = datasets.some(d => d.data.length && d.data.some(v => v > 0));

    if (!hasData) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        summary.innerHTML = "<p style='color:#e6edf3'>No challenge data.</p>";
    }

    const labels = datasets[0]?.data.map((_, i) => i + 1) || [];
    const maxPoints = Math.ceil(Math.max(...datasets.flatMap(d => d.data))) + 1;

    // --- Athlete totals ---
    const totals = datasets
        .map(d => ({ label: d.label, color: d.borderColor, total: d.data.at(-1) || 0 }))
        .sort((a, b) => b.total - a.total);

    const avatarSize = isMobile ? 16 : 20;

    summary.innerHTML = totals.map(t => {
        const athlete = Object.values(athletesData).find(a => a.display_name === t.label);
        return `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;white-space:nowrap;">
                <img src="${athlete?.profile || ""}"
                     style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;object-fit:cover;">
                <span style="color:${t.color}">${t.label}</span>
                <span style="opacity:0.7">${t.total.toFixed(1)} pts</span>
            </div>
        `;
    }).join("");

    // --- Chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { bottom: chartPaddingBottom, right: paddingRight } },
            plugins: {
                legend: { display: false },
                tooltip: { bodyFont: { size: fontSize }, titleFont: { size: fontSize } }
            },
            scales: {
                x: { ticks: { font: { size: fontSize }, padding: isMobile ? 10 : 6, maxRotation: 0, minRotation: 0 } },
                y: { min: 0, max: maxPoints, title: { display: true, text: "Cumulative Points", font: { size: fontSize } }, ticks: { font: { size: fontSize } } }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;
                Object.values(athletesData).forEach((a, i) => {
                    const d = chart.data.datasets[i];
                    if (!d?.data.length) return;
                    const idx = d.data.length - 1;
                    let xPos = x.getPixelForValue(idx + 1);
                    let yPos = y.getPixelForValue(d.data[idx]);
                    const size = athleteImgSize;
                    xPos = Math.min(xPos, chart.width - size / 2 - paddingRight);
                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
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
    const monthSelector = document.getElementById("dailyMonthSelector");
    const monthLabel = document.querySelector(".month-label");

    toggle.addEventListener("change", () => {
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");
        const on = toggle.checked;
        container.style.display = on ? "none" : "flex";
        challengeContainer.style.display = on ? "block" : "none";
        if (monthSelector) monthSelector.style.visibility = on ? "hidden" : "visible";
        if (monthLabel) monthLabel.style.visibility = on ? "hidden" : "visible";

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

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
    if (window.DASHBOARD?.getData) {
        initChallengeToggle();
        window.addEventListener("resize", () => {
            if (challengeChart) {
                destroyChallenge();
                const { athletesData, monthNames } = window.DASHBOARD.getData();
                renderChallenge(athletesData, monthNames);
            }
        });
    }
});
