let challengeChart = null;
const athleteColors = {};

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
    if (container) container.innerHTML = "";
}

function renderChallenge(athletesData) {
    if (!athletesData) return;

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
    const rulesBody = rulesCard.querySelector(".challenge-rules");
    const chartCard = container.querySelector(".challenge-card:nth-of-type(2)");
    const canvas = document.getElementById("challengeChartCanvas");
    const ctx = canvas.getContext("2d");
    const summary = container.querySelector(".challenge-summary-card .challenge-summary");

    const { isMobile, fontSize, athleteImgSize, chartHeight, chartPadding, chartPaddingBottom, paddingRight, cardWidth, headerPaddingTop, headerFontSize } = getSettings();

    // --- Rules card ---
    rulesCard.style.width = cardWidth;
    rulesCard.style.margin = "0 0 12px 0";
    rulesCard.style.padding = `${isMobile ? 10 : 12}px ${chartPadding}px`;
    rulesCard.style.background = "#1b1f25";
    rulesCard.style.borderRadius = "15px";
    rulesBody.style.fontSize = fontSize + "px";
    rulesBody.style.color = "#e6edf3";
    rulesBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;line-height:1.4;">
            <div>🏊‍♂️ <strong>Swim</strong>: 1 mile = <strong>4 points</strong></div>
            <div>🏃‍♂️ <strong>Run</strong>: 1 mile = <strong>1 point</strong></div>
            <div>🚴‍♂️ <strong>Bike</strong>: 1 mile = <strong>0.25 points</strong></div>
            <div>🏋️ <strong>Weights</strong>: 10 mins = <strong>1 point</strong></div>
        </div>
    `;

    // --- Chart card ---
    chartCard.style.width = cardWidth;
    chartCard.style.height = chartHeight + "px";
    chartCard.style.padding = `${headerPaddingTop}px ${chartPadding}px ${chartPadding}px`;
    chartCard.style.background = "#1b1f25";
    chartCard.style.borderRadius = "15px";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    // --- Summary card ---
    const summaryCard = container.querySelector(".challenge-summary-card");
    summaryCard.style.width = cardWidth;
    summaryCard.style.padding = `${isMobile ? 10 : 12}px ${chartPadding}px`;
    summaryCard.style.background = "#1b1f25";
    summaryCard.style.borderRadius = "15px";
    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "4px";
    summary.style.fontSize = fontSize + "px";
    summary.style.color = "#e6edf3";

    // --- Points rules ---
    const pointsPerActivity = { Swim: 4, Run: 1, Ride: 0.25, "Weight Training": 0.1 };

    // --- Labels: days of month ---
    const firstAthlete = Object.values(athletesData)[0];
    const numDays = firstAthlete?.daily_summary?.length || 30;
    const labels = Array.from({ length: numDays }, (_, i) => i + 1);

    // --- Datasets ---
    const datasets = Object.values(athletesData).map(a => {
        let cumulative = 0;
        if (!athleteColors[a.display_name]) {
            athleteColors[a.display_name] = `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
        }

        const dailyPoints = a.daily_summary.map(d => {
            let dayPoints = 0;
            Object.keys(pointsPerActivity).forEach(act => {
                const val = d[act] || 0;
                dayPoints += val * pointsPerActivity[act];
            });
            cumulative += dayPoints;
            return +cumulative.toFixed(2);
        });

        return {
            label: a.display_name,
            data: dailyPoints,
            borderColor: athleteColors[a.display_name],
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 0,
            spanGaps: true
        };
    });

    const maxPoints = Math.ceil(Math.max(...datasets.flatMap(d => d.data))) + 1;

    // --- Summary ---
    const totals = datasets
        .map(d => ({ label: d.label, color: d.borderColor, total: d.data[d.data.length - 1] || 0 }))
        .sort((a, b) => b.total - a.total);

    const avatarSize = isMobile ? 16 : 20;
    summary.innerHTML = totals.map(t => {
        const athlete = Object.values(athletesData).find(a => a.display_name === t.label);
        return `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;white-space:nowrap;">
                <img src="${athlete?.profile || ""}" style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;object-fit:cover;">
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
            plugins: { legend: { display: false }, tooltip: { bodyFont: { size: fontSize }, titleFont: { size: fontSize } } },
            scales: {
                x: { ticks: { font: { size: fontSize }, maxRotation: 0, minRotation: 0 } },
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
                    const lastIdx = d.data.length - 1;
                    const xPos = x.getPixelForValue(lastIdx + 1);
                    const yPos = y.getPixelForValue(d.data[lastIdx]);
                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(xPos, yPos, athleteImgSize / 2, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(img, xPos - athleteImgSize / 2, yPos - athleteImgSize / 2, athleteImgSize, athleteImgSize);
                        ctx.restore();
                    };
                });
            }
        }]
    });
}

// --- Toggle logic (initialize once) ---
function initChallengeToggle() {
    const toggle = document.getElementById("challengeToggle");
    const monthSelector = document.getElementById("dailyMonthSelector");
    const monthLabel = document.querySelector(".month-label");
    if (!toggle) return;

    toggle.addEventListener("change", () => {
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");
        const on = toggle.checked;

        if (container) container.style.display = on ? "none" : "flex";
        if (challengeContainer) challengeContainer.style.display = on ? "block" : "none";
        if (monthSelector) monthSelector.style.visibility = on ? "hidden" : "visible";
        if (monthLabel) monthLabel.style.visibility = on ? "hidden" : "visible";

        const { athletesData } = window.DASHBOARD.getData();
        if (on) renderChallenge(athletesData);
        else destroyChallenge();
    });
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
    if (!window.DASHBOARD?.getData) return;
    initChallengeToggle();

    window.addEventListener("resize", () => {
        if (challengeChart && document.getElementById("challengeContainer").style.display !== "none") {
            destroyChallenge();
            const { athletesData } = window.DASHBOARD.getData();
            renderChallenge(athletesData);
        }
    });
});
