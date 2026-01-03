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
    if (container) container.innerHTML = "";
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
        Ride: 0.25,
        "Weight Training": 0.1 // 10 mins = 1 point
    };

    const today = new Date();
    const currentDay = today.getDate();

    const datasets = Object.values(athletesData).map(a => {
        const daily = a.daily || [];
        let cumulative = 0;

        if (!athleteColors[a.display_name]) {
            athleteColors[a.display_name] =
                `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`;
        }

        const dailyPoints = daily.map((d, i) => {
            if (i >= currentDay) return null; // stop plotting beyond today
            let dayPoints = 0;
            d.activities.forEach(act => {
                const miles = (act.distance_km || 0) * 0.621371; // km -> miles
                const time_min = act.time_min || 0;
                if (pointsPerActivity[act.type]) {
                    if (act.type === "Weight Training") {
                        dayPoints += time_min * pointsPerActivity["Weight Training"];
                    } else {
                        dayPoints += miles * pointsPerActivity[act.type];
                    }
                }
            });
            return +(cumulative += dayPoints).toFixed(2);
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

    // --- Labels: all days in month ---
    const labels = [];
    if (datasets.length) {
        const dailyLength = datasets[0].data.length;
        for (let i = 1; i <= dailyLength; i++) labels.push(i);
    }

    const maxPoints = Math.ceil(Math.max(...datasets.flatMap(d => d.data.filter(p => p !== null)))) + 1;

    // --- Athlete totals ---
    const totals = datasets
        .map(d => ({
            label: d.label,
            color: d.borderColor,
            total: d.data[d.data.length - 1] || 0
        }))
        .sort((a, b) => b.total - a.total);

    const avatarSize = isMobile ? 16 : 20;

    summary.innerHTML = totals.map(t => {
        const athlete = Object.values(athletesData)
            .find(a => a.display_name === t.label);

        return `
            <div style="
                display:flex;
                align-items:center;
                gap:6px;
                margin-bottom:4px;
                white-space:nowrap;
            ">
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
                tooltip: {
                    bodyFont: { size: fontSize },
                    titleFont: { size: fontSize }
                }
            },
            scales: {
                x: { ticks: { font: { size: fontSize }, padding: isMobile ? 10 : 6, maxRotation: 0, minRotation: 0 } },
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
                Object.values(athletesData).forEach((a, i) => {
                    const d = chart.data.datasets[i];
                    if (!d?.data.length) return;
                    // Find last non-null value
                    const idx = d.data.findIndex((v, idx) => idx >= currentDay ? true : v === null) - 1;
                    const lastIdx = d.data.map((v, idx) => idx < currentDay ? idx : -1).filter(v => v >= 0).pop();
                    if (lastIdx === undefined) return;
                    const xPos = x.getPixelForValue(lastIdx + 1);
                    const yPos = y.getPixelForValue(d.data[lastIdx]);
                    const size = athleteImgSize;
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
    if (!toggle) return;

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
