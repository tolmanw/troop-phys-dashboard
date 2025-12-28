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
        chartHeight: isMobile ? 340 : 440,
        chartPadding: isMobile ? 10 : 20,
        chartPaddingBottom: isMobile ? 20 : 20,
        paddingRight: isMobile ? 20 : 20,
        cardWidth: isMobile ? '95%' : '700px',
        headerPaddingTop: isMobile ? 12 : 12,
        headerFontSize: isMobile ? 12 : 16, // header font size control
        cardTopOffset: isMobile ? 16 : 24 // top offset applied to each card
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

        <div class="challenge-card challenge-summary-card">
            <h3>Athlete Totals</h3>
            <div class="challenge-summary"></div>
        </div>
    `;

    const card = container.querySelector(".challenge-card");
    const canvas = document.getElementById("challengeChartCanvas");
    const ctx = canvas.getContext("2d");

    const summaryCard = container.querySelector(".challenge-summary-card");
    const summaryTitle = summaryCard.querySelector("h3");
    const summary = summaryCard.querySelector(".challenge-summary");

    // --- Settings ---
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
        headerFontSize,
        cardTopOffset
    } = getSettings();

    // --- Card + canvas styling ---
    [card, summaryCard].forEach((c, i) => {
        c.style.width = cardWidth;
        c.style.marginTop = i === 0 ? cardTopOffset + "px" : "12px"; // chart card top offset, summary card smaller margin
        c.style.padding = isMobile ? "10px" : "12px";
        c.style.background = "#1b1f25";
        c.style.borderRadius = "15px";
        c.style.textAlign = "left";
    });

    card.style.padding = `
        ${headerPaddingTop}px
        ${chartPadding}px
        ${chartPadding}px
        ${chartPadding}px
    `;
    card.style.height = chartHeight + "px";

    const title = card.querySelector("h2");
    title.style.marginTop = "0";
    title.style.marginBottom = isMobile ? "6px" : "10px";
    title.style.fontSize = headerFontSize + "px";

    canvas.style.width = "100%";
    canvas.style.height = "100%";

    // --- Summary header styling ---
    summaryTitle.style.margin = "0 0 8px 0";
    summaryTitle.style.fontSize = headerFontSize + "px"; // match chart header font size
    summaryTitle.style.color = "#e6edf3";

    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "4px"; // small vertical gap under each athlete
    summary.style.paddingRight = paddingRight + "px"; // align with chart content
    summary.style.fontSize = fontSize + "px";
    summary.style.color = "#e6edf3";

    // --- Prepare datasets ---
    const currentMonthIndex = monthNames.length - 1;

    const datasets = Object.values(athletesData).map(a => {
        const daily = a.daily_distance_km[currentMonthIndex] || [];
        let cumulative = 0;

        if (!athleteColors[a.display_name]) {
            const hue = Math.floor(Math.random() * 360);
            athleteColors[a.display_name] = `hsl(${hue}, 100%, 50%)`;
        }

        return {
            label: a.display_name,
            data: daily.map(d => +(cumulative += d * 0.621371).toFixed(2)),
            borderColor: athleteColors[a.display_name],
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 0
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

    // --- Create summary with avatars ---
    const totals = datasets.map(d => ({
        label: d.label,
        color: d.borderColor,
        total: d.data.length ? d.data[d.data.length - 1] : 0
    }));

    const avatarSize = isMobile ? 16 : 20;

    summary.innerHTML = totals
        .sort((a, b) => b.total - a.total)
        .map(t => {
            const athlete = Object.values(athletesData).find(a => a.display_name === t.label);
            const profileSrc = athlete ? athlete.profile : "";
            return `
            <div style="
                display:flex;
                align-items:center;
                gap:6px;
                white-space:nowrap;
                margin-bottom:4px; /* small gap under each athlete */
            ">
                <img src="${profileSrc}" 
                     style="width:${avatarSize}px; height:${avatarSize}px; border-radius:50%; object-fit:cover;" 
                     alt="${t.label}">
                <span style="color:${t.color}">${t.label}</span>
                <span style="opacity:0.7;">${t.total.toFixed(1)} mi</span>
            </div>
            `;
        })
        .join("");

    // --- Create chart ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    bottom: chartPaddingBottom,
                    right: paddingRight
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    bodyFont: { size: fontSize },
                    titleFont: { size: fontSize }
                }
            },
            scales: {
                x: {
                    title: { display: false },
                    ticks: {
                        font: { size: fontSize },
                        maxRotation: 0,
                        minRotation: 0,
                        padding: isMobile ? 10 : 6
                    }
                },
                y: {
                    min: 0,
                    max: maxDistanceMi,
                    title: {
                        display: true,
                        text: "Cumulative Distance (miles)",
                        font: { size: fontSize }
                    },
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

    toggle.addEventListener("change", () => {
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");
        const monthSelector = document.getElementById("dailyMonthSelector");
        const monthLabel = monthSelector?.previousElementSibling;
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
    } else {
        console.error("Dashboard not loaded yet.");
    }
});
