let challengeChart = null;
const athleteColors = {};

// --- Settings ---
function getSettings() {
    const isMobile = window.innerWidth <= 600;
    return {
        isMobile,
        fontSize: isMobile ? 9 : 12,
        athleteImgSize: isMobile ? 20 : 25,
        chartHeight: 420,
        chartPadding: 16,
        chartPaddingBottom: 35,
        paddingRight: 12,
        cardWidth: isMobile ? "100%" : "700px",
        headerPaddingTop: 20,
        headerFontSize: isMobile ? 14 : 18
    };
}

// --- Destroy chart ---
function destroyChallenge() {
    if (challengeChart) {
        challengeChart.destroy();
        challengeChart = null;
    }
    const container = document.getElementById("challengeContainer");
    if (container) container.innerHTML = "";
}

// --- Safe daily value reader ---
function getDailyValue(dataArray, day) {
    if (!dataArray) return 0;
    if (Array.isArray(dataArray[0])) {
        if (Array.isArray(dataArray[0][0])) return dataArray[0][0][day] || 0;
        return dataArray[0][day] || 0;
    }
    return dataArray[day] || 0;
}

// --- Load challenge JSONs dynamically ---
async function loadChallengeJSONs(currentMonthShort) {
    const monthPrefix = currentMonthShort || "Jan";
    const activityFiles = ["Run", "Swim", "Ride", "Workout"];
    const jsons = {};

    for (const activity of activityFiles) {
        try {
            const res = await fetch(`data/${monthPrefix}_Challenge_${activity}.json`);
            if (!res.ok) throw new Error("Not found");
            jsons[activity] = await res.json();
        } catch {
            if (monthPrefix !== "Jan") {
                const fallbackRes = await fetch(`data/Jan_Challenge_${activity}.json`);
                jsons[activity] = await fallbackRes.json();
            } else {
                jsons[activity] = { athletes: {} };
            }
        }
    }
    return jsons;
}

// --- Combine per-activity JSONs into cumulative points ---
function combineChallengeData(jsons) {
    const athletes = {};
    const kmToMiles = km => km * 0.621371;
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = 31;

    const athleteIds = new Set();
    Object.values(jsons).forEach(json => {
        if (json?.athletes) Object.keys(json.athletes).forEach(id => athleteIds.add(id));
    });

    athleteIds.forEach(id => {
        athletes[id] = {
            display_name: null,
            profile: null,
            daily_points: Array(daysInMonth).fill(null),
            activities: []
        };

        let cumulative = 0;
        for (let day = 0; day < daysInMonth; day++) {
            let pointsToday = 0;
            const dayData = {};

            const runJson = jsons.Run?.athletes[id];
            if (runJson) {
                const runPoints = kmToMiles(getDailyValue(runJson.daily_distance_km, day));
                pointsToday += runPoints;
                dayData.Run = runPoints;
                athletes[id].display_name = runJson.display_name;
                athletes[id].profile = runJson.profile;
            }

            const swimJson = jsons.Swim?.athletes[id];
            if (swimJson) {
                const swimPoints = kmToMiles(getDailyValue(swimJson.daily_distance_km, day)) * 4;
                pointsToday += swimPoints;
                dayData.Swim = swimPoints;
                athletes[id].display_name ||= swimJson.display_name;
                athletes[id].profile ||= swimJson.profile;
            }

            const rideJson = jsons.Ride?.athletes[id];
            if (rideJson) {
                const ridePoints = kmToMiles(getDailyValue(rideJson.daily_distance_km, day)) * 0.25;
                pointsToday += ridePoints;
                dayData.Ride = ridePoints;
                athletes[id].display_name ||= rideJson.display_name;
                athletes[id].profile ||= rideJson.profile;
            }

            const workoutJson = jsons.Workout?.athletes[id];
            if (workoutJson) {
                const val = (workoutJson.daily_time_min && workoutJson.daily_time_min[0]?.[day]) || 0;
                const workoutPoints = val / 10;
                pointsToday += workoutPoints;
                dayData.Workout = workoutPoints;
                athletes[id].display_name ||= workoutJson.display_name;
                athletes[id].profile ||= workoutJson.profile;
            }

            cumulative += pointsToday;

            if (day < currentDay) {
                athletes[id].daily_points[day] = +cumulative.toFixed(2);
                dayData.Cumulative = +cumulative.toFixed(2);
                athletes[id].activities.push(dayData);
            } else {
                athletes[id].daily_points[day] = null;
            }
        }
    });

    return athletes;
}

// --- Render Challenge ---
function renderChallenge(athletesData) {
    if (!athletesData) return;

    const today = new Date();
    const monthNamesShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthNamesFull = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const currentMonthShort = monthNamesShort[today.getMonth()];
    const currentMonthFull = monthNamesFull[today.getMonth()];

    const container = document.getElementById("challengeContainer");
    container.style.display = "block";

    container.innerHTML = `
        <div class="challenge-card challenge-rules-card">
            <h3>Challenge Rules</h3>
            <div class="challenge-rules"></div>
        </div>

        <div class="challenge-card challenge-chart-card">
            <h2>Challenge Point Chart</h2>
            <canvas id="challengeChartCanvas"></canvas>
        </div>

        <div class="challenge-card challenge-summary-card">
            <h3>Total Points</h3>
            <div class="challenge-summary"></div>
        </div>

        <div class="challenge-card challenge-winners-card">
            <h3>Monthly Leader</h3>
            <div class="challenge-winners"></div>
        </div>
    `;

    const { fontSize, athleteImgSize, chartHeight, chartPadding, chartPaddingBottom, paddingRight, cardWidth, headerPaddingTop, headerFontSize, isMobile } = getSettings();

    // --- Styles for Rules Card ---
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
			<div style="margin-bottom:8px; color: #c9d1d9;">Gain points for distance during a Run, Ride, Swim or gain points for time doing a Workout (Weight Training, HIIT, Sport etc.)</div>
			<div style="margin-bottom:8px; color: #c9d1d9;">Tag your Strava activity to the categories below to record your points on the chart.</div>
			🏊 Swim: 1 mile = 4 pts<br>
			🏃 Run: 1 mile = 1 pt<br>
			🚴 Ride: 1 mile = 0.25 pts<br>
			🏋️ Workout: 10 mins = 1 pt
		</div>
	`;
	rulesBody.style.fontSize = fontSize + "px";
	rulesBody.style.color = "#e6edf3";
	rulesBody.style.opacity = "0.85";

    // --- Styles for Chart Card ---
    const chartCard = container.querySelector(".challenge-chart-card");
    chartCard.style.width = cardWidth;
    chartCard.style.height = chartHeight + "px";
    chartCard.style.boxSizing = "border-box";
    chartCard.style.padding = `${headerPaddingTop}px ${chartPadding}px ${chartPadding}px ${chartPadding}px`;
    chartCard.style.background = "#1b1f25";
    chartCard.style.borderRadius = "15px";

    const chartTitle = chartCard.querySelector("h2");
    chartTitle.style.margin = "0 0 12px 0";
    chartTitle.style.fontSize = headerFontSize + "px";
    chartTitle.style.color = "#e6edf3";

    const canvas = document.getElementById("challengeChartCanvas");
    canvas.width = chartCard.offsetWidth - 2 * chartPadding;
    canvas.height = chartHeight - headerPaddingTop - chartPadding;
    const ctx = canvas.getContext("2d");

    const labels = Array.from({ length: 31 }, (_, i) => i + 1);

    const datasets = Object.values(athletesData).map(a => {
        if (!athleteColors[a.display_name]) athleteColors[a.display_name] = `hsl(${Math.random()*360},100%,50%)`;
        return {
            label: a.display_name,
            data: a.daily_points,
            borderColor: athleteColors[a.display_name],
            borderWidth: 2,
            tension: 0,
            fill: false,
            pointRadius: 0,
            spanGaps: true
        };
    });

    const rawMax = Math.max(...datasets.flatMap(d => d.data.filter(v => v !== null)));
    const { max: maxPoints, step: yStep } = getNiceAxisMultipleOf5(rawMax, 5);

    // --- Totals Card ---
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

    const athleteEntries = Object.values(athletesData).map(a => {
        const total = a.daily_points.filter(v => typeof v === "number").pop() || 0;
        return { athlete: a, total, color: athleteColors[a.display_name] };
    }).sort((a, b) => b.total - a.total);

    summary.innerHTML = athleteEntries.map(({ athlete, total, color }) => `
        <div style="display:flex;align-items:center;gap:8px;">
            <img src="${athlete.profile}" style="width:22px;height:22px;border-radius:50%;">
            <span style="color:${color}">${athlete.display_name}</span>
            <span style="opacity:0.7">${total.toFixed(1)} pts</span>
        </div>
    `).join("");

    // --- Monthly Winners Card ---
    const winnersCard = container.querySelector(".challenge-winners-card");
    winnersCard.style.width = cardWidth;
    winnersCard.style.margin = "12px 0 0 0";
    winnersCard.style.boxSizing = "border-box";
    winnersCard.style.padding = `${isMobile ? 16 : 20}px ${chartPadding}px`;
    winnersCard.style.background = "#1b1f25";
    winnersCard.style.borderRadius = "15px";

    const winnersTitle = winnersCard.querySelector("h3");
    winnersTitle.style.margin = "0 0 12px 0";
    winnersTitle.style.fontSize = headerFontSize + "px";
    winnersTitle.style.color = "#e6edf3";

    const winnersContainer = winnersCard.querySelector(".challenge-winners");
    winnersContainer.style.display = "flex";
    winnersContainer.style.flexDirection = "column";
    winnersContainer.style.gap = "6px";
    winnersContainer.style.fontSize = fontSize + "px";
    winnersContainer.style.color = "#e6edf3";

    const pastWinners = JSON.parse(localStorage.getItem("monthlyWinners") || "[]");

    const currentWinner = Object.values(athletesData)
        .map(a => ({ athlete: a, total: a.daily_points.slice(0, today.getDate()).filter(v=>typeof v==="number").pop()||0 }))
        .sort((a,b)=>b.total-a.total)[0];

    const filteredWinners = pastWinners.filter(w => w.monthName !== currentMonthFull);
    filteredWinners.push({
        monthName: currentMonthFull,
        name: currentWinner.athlete.display_name,
        profile: currentWinner.athlete.profile || "default_profile.png",
        points: currentWinner.total
    });
    localStorage.setItem("monthlyWinners", JSON.stringify(filteredWinners));

    winnersContainer.innerHTML = filteredWinners.map(w => `
        <div style="display:flex;align-items:center;gap:8px;">
            <img src="${w.profile}" style="width:22px;height:22px;border-radius:50%;">
            <span>${w.name}</span>
            <span style="opacity:0.7">${w.points.toFixed(1)} pts (${w.monthName})</span>
        </div>
    `).join("");

    // --- Chart.js ---
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            layout: { padding: { bottom: chartPaddingBottom, right: paddingRight } },
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { font: { size: fontSize }, maxRotation: 0, minRotation: 0 } },
                y: { min: 0, max: maxPoints, ticks: { font: { size: fontSize }, stepSize: yStep } }
            }
        },
        plugins: [{
            id:"athleteImages",
            afterDatasetsDraw(chart){
                const { ctx, scales:{x,y} } = chart;
                chart.data.datasets.forEach((ds,i)=>{
                    const athlete = Object.values(athletesData)[i];
                    let last=-1;
                    for(let j=ds.data.length-1;j>=0;j--){
                        if(typeof ds.data[j]==="number" && ds.data[j]>=0){last=j;break;}
                    }
                    if(last===-1) return;
                    const xPos=x.getPixelForValue(last+1);
                    const yPos=y.getPixelForValue(ds.data[last]);
                    const img=new Image();
                    img.src=athlete.profile;
                    img.onload=()=>{
                        const size=athleteImgSize;
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(xPos,yPos,size/2,0,Math.PI*2);
                        ctx.clip();
                        ctx.drawImage(img,xPos-size/2,yPos-size/2,size,size);
                        ctx.restore();
                    }
                });
            }
        }]
    });
}

// --- Utility function ---
function getNiceAxisMultipleOf5(value, desiredTicks = 5) {
    if(value<=0) return { max:5, step:5 };
    let roughMax = Math.ceil(value/5)*5;
    let step = Math.ceil(roughMax/desiredTicks/5)*5;
    return { max:roughMax, step };
}

// --- Toggle ---
function initChallengeToggle() {
    const toggle = document.getElementById("challengeToggle");
    const dashboard = document.getElementById("container");
    const challenge = document.getElementById("challengeContainer");
    const monthSelector = document.getElementById("dailyMonthSelector");
    const monthLabel = document.querySelector(".month-label");
    const logoEl = document.getElementById("logo");
    const originalLogoSrc = logoEl.src;

    if(!toggle) return;

    toggle.addEventListener("change", async ()=>{
        const isChallengeOn = toggle.checked;
        logoEl.src = isChallengeOn ? "Jan_challenge_logo.png" : originalLogoSrc;
        monthSelector.style.visibility = isChallengeOn ? "hidden" : "visible";
        monthLabel.style.visibility = isChallengeOn ? "hidden" : "visible";

        if(isChallengeOn){
            dashboard.style.display = "none";
            challenge.style.display = "block";
            window.DASHBOARD.destroyCharts();

            const today = new Date();
            const monthNamesShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const currentMonthShort = monthNamesShort[today.getMonth()];

            const jsons = await loadChallengeJSONs(currentMonthShort);
            const athletesData = combineChallengeData(jsons);
            renderChallenge(athletesData);
        } else {
            destroyChallenge();
            challenge.style.display = "none";
            dashboard.style.display = "flex";
            window.DASHBOARD.renderDashboard();
        }
    });
}

document.addEventListener("DOMContentLoaded", ()=>{
    if(window.DASHBOARD?.getData){
        initChallengeToggle();
    }
});
