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

// --- Render Challenge Chart ---
function renderChallenge(athletesData, monthNames) {
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
    const card = container.querySelector(".challenge-card:nth-of-type(2)");
    const canvas = document.getElementById("challengeChartCanvas");
    const summary = container.querySelector(".challenge-summary");

    const { isMobile, fontSize, athleteImgSize, chartHeight, chartPadding, chartPaddingBottom, paddingRight, cardWidth, headerPaddingTop, headerFontSize } = getSettings();

    // --- Rules ---
    rulesCard.style.width = cardWidth;
    rulesCard.style.padding = `${isMobile ? 10 : 12}px ${chartPadding}px`;
    rulesCard.style.background = "#1b1f25";
    rulesCard.style.borderRadius = "15px";

    rulesBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;line-height:1.4;">
            <div>🏊‍♂️ Swim: 1 mile = 4 pts</div>
            <div>🏃‍♂️ Run: 1 mile = 1 pt</div>
            <div>🚴‍♂️ Bike: 1 mile = 0.25 pts</div>
            <div>🏋️ Weights: 10 mins = 1 pt</div>
        </div>
    `;
    rulesBody.style.fontSize = fontSize + "px";
    rulesBody.style.color = "#e6edf3";

    // --- Chart container ---
    card.style.width = cardWidth;
    card.style.height = chartHeight + "px";
    card.style.background = "#1b1f25";
    card.style.borderRadius = "15px";

    canvas.style.width = "100%";
    canvas.style.height = "100%";

    // --- Summary ---
    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "4px";
    summary.style.fontSize = fontSize + "px";
    summary.style.color = "#e6edf3";

    // --- Points ---
    const pointsPerActivity = { Swim: 4, Run: 1, Ride: 0.25, "Weight Training": 0.1 };
    const today = new Date();
    const currentDay = today.getDate();

    const datasets = Object.values(athletesData).map(a => {
        if (!athleteColors[a.display_name]) athleteColors[a.display_name] = `hsl(${Math.floor(Math.random() * 360)},100%,50%)`;
        let cumulative = 0;
        const dailyPoints = (a.daily_summary || []).map((d, i) => {
            if (i >= currentDay) return null;
            let dayPoints = 0;
            Object.keys(pointsPerActivity).forEach(type => {
                dayPoints += (d[type] || 0) * pointsPerActivity[type];
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

    const labels = datasets.length ? datasets[0].data.map((_, i) => i + 1) : [];
    const maxPoints = Math.ceil(Math.max(...datasets.flatMap(d => d.data.filter(p => p !== null)))) + 1;

    // --- Summary totals ---
    const totals = datasets.map(d => ({ label: d.label, color: d.borderColor, total: d.data[d.data.length - 1] || 0 }))
        .sort((a,b)=>b.total-a.total);

    const avatarSize = isMobile ? 16 : 20;
    summary.innerHTML = totals.map(t=>{
        const athlete = Object.values(athletesData).find(a=>a.display_name===t.label);
        return `
            <div style="display:flex;align-items:center;gap:6px;">
                <img src="${athlete?.profile||''}" style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;object-fit:cover;">
                <span style="color:${t.color}">${t.label}</span>
                <span style="opacity:0.7">${t.total.toFixed(1)} pts</span>
            </div>
        `;
    }).join('');

    // --- Chart ---
    challengeChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { bottom: chartPaddingBottom, right: paddingRight } },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { font: { size: fontSize }, maxRotation:0, minRotation:0 } },
                y: { min:0, max:maxPoints, title:{ display:true, text:"Cumulative Points", font:{ size:fontSize } }, ticks:{ font:{ size:fontSize } } }
            }
        },
        plugins: [{
            id:"athleteImages",
            afterDatasetsDraw(chart){
                const { ctx, scales:{ x, y } } = chart;
                Object.values(athletesData).forEach((a,i)=>{
                    const d = chart.data.datasets[i];
                    if(!d?.data.length) return;
                    const lastIdx = d.data.map((v, idx) => idx < currentDay ? idx : -1).filter(v => v >=0).pop();
                    if(lastIdx===undefined) return;
                    const xPos = x.getPixelForValue(lastIdx+1);
                    const yPos = y.getPixelForValue(d.data[lastIdx]);
                    const size = athleteImgSize;
                    const img = new Image();
                    img.src = a.profile;
                    img.onload = ()=> {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(xPos, yPos, size/2,0,Math.PI*2);
                        ctx.clip();
                        ctx.drawImage(img, xPos-size/2, yPos-size/2, size, size);
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
    if(!toggle) return;

    toggle.addEventListener("change", ()=>{
        const on = toggle.checked;
        const container = document.getElementById("container");
        const challengeContainer = document.getElementById("challengeContainer");

        if(container) container.style.display = on ? "none" : "flex";
        if(challengeContainer) challengeContainer.style.display = on ? "block" : "none";

        const { athletesData, monthNames } = window.DASHBOARD.getData();

        if(on){
            window.DASHBOARD.destroyCharts?.();
            renderChallenge(athletesData, monthNames);
        } else {
            destroyChallenge();
            window.DASHBOARD.renderDashboard?.();
        }
    });
}

// --- Init ---
document.addEventListener("DOMContentLoaded", ()=>{
    const waitForDashboard = setInterval(()=>{
        if(window.DASHBOARD?.getData){
            clearInterval(waitForDashboard);
            initChallengeToggle();
            window.addEventListener("resize", ()=>{
                if(challengeChart){
                    destroyChallenge();
                    const { athletesData, monthNames } = window.DASHBOARD.getData();
                    renderChallenge(athletesData, monthNames);
                }
            });
        }
    },100);
});
