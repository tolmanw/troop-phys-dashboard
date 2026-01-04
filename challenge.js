let challengeChart = null;

// --- Color cache ---
const athleteColors = {};

// --- Layout settings ---
function getSettings() {
    const isMobile = window.innerWidth <= 600;
    return {
        isMobile,
        fontSize: isMobile ? 10 : 12,
        athleteImgSize: isMobile ? 20 : 28,
        chartHeight: 420,
        chartPadding: 16,
        chartPaddingBottom: 24,
        paddingRight: 36,
        cardWidth: isMobile ? "100%" : "700px",
        headerPaddingTop: 12,
        headerFontSize: isMobile ? 14 : 18
    };
}

// --- Destroy ---
function destroyChallenge() {
    if (challengeChart) {
        challengeChart.destroy();
        challengeChart = null;
    }
    const container = document.getElementById("challengeContainer");
    if (container) container.innerHTML = "";
}

// --- Main render ---
function renderChallenge(athletesData) {
    if (!athletesData) return;

    const container = document.getElementById("challengeContainer");
    container.style.display = "block";

    container.innerHTML = `
        <div class="challenge-card challenge-rules-card">
            <h3>Challenge Rules</h3>
            <div class="challenge-rules"></div>
        </div>

        <div class="challenge-card challenge-chart-card">
            <h2>Monthly Challenge</h2>
            <canvas id="challengeChartCanvas"></canvas>
        </div>

        <div class="challenge-card challenge-summary-card">
            <h3>Totals</h3>
            <div class="challenge-summary"></div>
        </div>
    `;

    const {
        fontSize,
        athleteImgSize,
        chartHeight,
        chartPadding,
        chartPaddingBottom,
        paddingRight,
        cardWidth,
        headerPaddingTop,
        headerFontSize,
        isMobile
    } = getSettings();

    // --- Rules card styling ---
    const rulesCard = container.querySelector(".challenge-rules-card");
    rulesCard.style.width = cardWidth;
    rulesCard.style.margin = "0 0 12px 0";
    rulesCard.style.boxSizing = "border-box";
    rulesCard.style.padding = `${isMobile ? 16 : 20}px ${chartPadding}px`;
    rulesCard.style.background = "#1b1f25";
    rulesCard.style.borderRadius = "15px";

    const rulesTitle = rulesCard.querySelector("h3");
    rulesTitle.style.margin = "0 0 12px 0";
    rulesTitle.style.fontSize = headerFontSize + "px";
    rulesTitle.style.color = "#e6edf3";

    const rulesBody = rulesCard.querySelector(".challenge-rules");
    rulesBody.innerHTML = `
        <div style="line-height:1.5;">
            🏊 Swim: <strong>1 mile = 4 pts</strong><br>
            🏃 Run: <strong>1 mile = 1 pt</strong><br>
            🚴 Ride: <strong>1 mile = 0.25 pts</strong><br>
            🏋️ Weights: <strong>10 min = 1 pt</strong>
        </div>
    `;
    rulesBody.style.fontSize = fontSize + "px";
    rulesBody.style.color = "#e6edf3";
    rulesBody.style.opacity = "0.85";

    // --- Chart card styling ---
    const card = container.querySelector(".challenge-chart-card");
    card.style.width = cardWidth;
    card.style.boxSizing = "border-box";
    card.style.height = chartHeight + "px";
    card.style.padding = `${headerPaddingTop}px ${chartPadding}px ${chartPadding}px ${chartPadding}px`;
    card.style.background = "#1b1f25";
    card.style.borderRadius = "15px";

    const title = card.querySelector("h2");
    title.style.margin = "0 0 12px 0";
    title.style.fontSize = headerFontSize + "px";
    title.style.color = "#e6edf3";

    const canvas = document.getElementById("challengeChartCanvas");
    canvas.width = card.offsetWidth - 2 * chartPadding;
    canvas.height = chartHeight - headerPaddingTop - chartPadding;
    const ctx = canvas.getContext("2d");

    // --- Points rules ---
    const pointsPerActivity = {
        Run: 1,
        Swim: 4,
        Ride: 0.25,
        "Weight Training": 0.1
    };

    const today = new Date();
    const currentDay = today.getDate();

    // --- Debug: cumulative points table ---
    console.log("=== Athlete Cumulative Points ===");
    const debugTable = [];

    const datasets = Object.values(athletesData).map(a => {
        if (!athleteColors[a.display_name]) {
            athleteColors[a.display_name] = `hsl(${Math.floor(Math.random() * 360)},100%,50%)`;
        }

        let cumulative = 0;
        const data = [];

        for (let day = 0; day < 31; day++) {
            const d = a.daily_summary?.[day];
            if (d) {
                cumulative +=
                    (Number(d.Run) || 0) * pointsPerActivity.Run +
                    (Number(d.Swim) || 0) * pointsPerActivity.Swim +
                    (Number(d.Ride) || 0) * pointsPerActivity.Ride +
                    (Number(d["Weight Training"]) || 0) * pointsPerActivity["Weight Training"];
            }
            data.push(day < currentDay ? +cumulative.toFixed(2) : null);
        }

        // --- Add to debug table ---
        debugTable.push({
            Athlete: a.display_name,
            ...data.reduce((acc, val, idx) => {
                acc[`Day ${idx + 1}`] = val;
                return acc;
            }, {})
        });

        return {
            label: a.display_name,
            data,
            borderColor: athleteColors[a.display_name],
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 0,
            spanGaps: true
        };
    });

    console.table(debugTable); // <-- This prints all cumulative points

    const labels = Array.from({ length: 31 }, (_, i) => i + 1);
    const maxPoints = Math.ceil(Math.max(...datasets.flatMap(d => d.data.filter(v => typeof v === "number")))) + 1;

    // --- Totals card ---
    const summaryCard = container.querySelector(".challenge-summary-card");
    summaryCard.style.width = cardWidth;
    summaryCard.style.margin = "12px 0 0 0";
    summaryCard.style.boxSizing = "border-box";
    summaryCard.style.padding = `${isMobile ? 16 : 20}px ${chartPadding}px`;
    summaryCard.style.background = "#1b1f25";
    summaryCard.style.borderRadius = "15px";

    const summaryTitle = summaryCard.querySelector("h3");
    summaryTitle.style.margin = "0 0 12px 0";
    summaryTitle.style.fontSize = headerFontSize + "px";
    summaryTitle.style.color = "#e6edf3";

    const summary = summaryCard.querySelector(".challenge-summary");
    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "6px";
    summary.style.fontSize = fontSize + "px";
    summary.style.color = "#e6edf3";

    summary.innerHTML = datasets.map((d, i) => {
        const athlete = Object.values(athletesData)[i];
        const total = d.data.filter(v => typeof v === "number").pop() || 0;
        return `
            <div style="display:flex;align-items:center;gap:8px;">
                <img src="${athlete.profile}" style="width:22px;height:22px;border-radius:50%;">
                <span style="color:${d.borderColor}">${d.label}</span>
                <span style="opacity:0.7">${total.toFixed(1)} pts</span>
            </div>
        `;
    }).join("");

    // --- Chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            layout: { padding: { bottom: chartPaddingBottom, right: paddingRight } },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { font: { size: fontSize } } },
                y: {
                    min: 0,
                    max: maxPoints,
                    title: { display: true, text: "Cumulative Points", font: { size: fontSize } },
                    ticks: { font: { size: fontSize } }
                }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;

                chart.data.datasets.forEach((ds, i) => {
                    const athlete = Object.values(athletesData)[i];
                    let last = -1;
                    for (let j = ds.data.length - 1; j >= 0; j--) {
                        if (typeof ds.data[j] === "number") {
                            last = j;
                            break;
                        }
                    }
                    if (last === -1) return;

                    const xPos = x.getPixelForValue(last + 1);
                    const yPos = y.getPixelForValue(ds.data[last]);

                    const img = new Image();
                    img.src = athlete.profile;
                    img.onload = () => {
                        const size = athleteImgSize;
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

// --- Toggle ---
function initChallengeToggle() {
    const toggle = document.getElementById("challengeToggle");
    const dashboard = document.getElementById("container");
    const challenge = document.getElementById("challengeContainer");

    if (!toggle) return;

    toggle.addEventListener("change", () => {
        const { athletesData } = window.DASHBOARD.getData();

        if (toggle.checked) {
            dashboard.style.display = "none";
            challenge.style.display = "block";
            window.DASHBOARD.destroyCharts();
            renderChallenge(athletesData);
        } else {
            destroyChallenge();
            challenge.style.display = "none";
            dashboard.style.display = "flex";
            window.DASHBOARD.renderDashboard();
        }
    });
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
    if (window.DASHBOARD?.getData) {
        initChallengeToggle();
    }
});
