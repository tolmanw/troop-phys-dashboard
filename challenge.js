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
        if (Array.isArray(dataArray[0][0])) return dataArray[0][0][day] || 0; // double nested
        return dataArray[0][day] || 0; // single nested
    }
    return dataArray[day] || 0; // flat array
}

// --- Load challenge JSONs dynamically ---
async function loadChallengeJSONs() {
    const [run, swim, ride, workout] = await Promise.all([
        fetch("data/Jan_Challenge_Run.json").then(r => r.json()),
        fetch("data/Jan_Challenge_Swim.json").then(r => r.json()),
        fetch("data/Jan_Challenge_Ride.json").then(r => r.json()),
        fetch("data/Jan_Challenge_Workout.json").then(r => r.json())
    ]);
    return { Run: run, Swim: swim, Ride: ride, Workout: workout };
}

// --- Combine per-activity JSONs into cumulative points ---
function combineChallengeData(jsons) {
    const athletes = {};
    const kmToMiles = km => km * 0.621371;

    const today = new Date();
    const currentDay = today.getDate(); // 1-indexed
    const daysInMonth = 31;

    // Collect all athlete IDs
    const athleteIds = new Set();
    Object.values(jsons).forEach(json => {
        if (json?.athletes) Object.keys(json.athletes).forEach(id => athleteIds.add(id));
    });

    athleteIds.forEach(id => {
        athletes[id] = {
            display_name: null,
            profile: null,
            daily_points: Array(daysInMonth).fill(null), // <-- use null for future days
            activities: []
        };

        let cumulative = 0;
        for (let day = 0; day < daysInMonth; day++) {
            let pointsToday = 0;
            const dayData = {};

            // Run
            const runJson = jsons.Run?.athletes[id];
            if (runJson) {
                const runPoints = kmToMiles(getDailyValue(runJson.daily_distance_km, day));
                pointsToday += runPoints;
                dayData.Run = runPoints;
                athletes[id].display_name = runJson.display_name;
                athletes[id].profile = runJson.profile;
            }

            // Swim
            const swimJson = jsons.Swim?.athletes[id];
            if (swimJson) {
                const swimPoints = kmToMiles(getDailyValue(swimJson.daily_distance_km, day)) * 4;
                pointsToday += swimPoints;
                dayData.Swim = swimPoints;
                athletes[id].display_name ||= swimJson.display_name;
                athletes[id].profile ||= swimJson.profile;
            }

            // Ride
            const rideJson = jsons.Ride?.athletes[id];
            if (rideJson) {
                const ridePoints = kmToMiles(getDailyValue(rideJson.daily_distance_km, day)) * 0.25;
                pointsToday += ridePoints;
                dayData.Ride = ridePoints;
                athletes[id].display_name ||= rideJson.display_name;
                athletes[id].profile ||= rideJson.profile;
            }

            // Workout
			// --- Workout points calculation ---
			const workoutJson = jsons.Workout?.athletes[id];
			if (workoutJson) {
				// Nested array access for this JSON
				const val = (workoutJson.daily_time_min && workoutJson.daily_time_min[0]?.[day]) || 0;
				const workoutPoints = val / 10; // 10 mins = 1 pt
				pointsToday += workoutPoints;
				dayData.Workout = workoutPoints;

				athletes[id].display_name ||= workoutJson.display_name;
				athletes[id].profile ||= workoutJson.profile;
			}

            cumulative += pointsToday;

            // Only fill daily_points for days <= today
            if (day < currentDay) {
                athletes[id].daily_points[day] = +cumulative.toFixed(2);
                dayData.Cumulative = +cumulative.toFixed(2);
                athletes[id].activities.push(dayData);
            } else {
                athletes[id].daily_points[day] = null; // future days = null
            }
        }
    });

    // --- Debug output ---
    Object.entries(athletes).forEach(([id, athlete]) => {
        console.group(`Athlete: ${athlete.display_name} (${id})`);
        console.log("Profile:", athlete.profile);
        console.table(athlete.activities); // rows = days, columns = activity points + cumulative
        console.groupEnd();
    });

    return athletes;
}

// --- Render Challenge ---
function renderChallenge(athletesData) {
    if (!athletesData) return;

    const container = document.getElementById("challengeContainer");
    container.style.display = "block";

    // --- HTML structure ---
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
			<div style="margin-bottom:8px; color: #c9d1d9;">Ensure you tag your Strava activity to the same as below to record points on the chart.</div>
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

    // --- Prepare chart data ---
    const labels = Array.from({ length: 31 }, (_, i) => i + 1);

    const datasets = Object.values(athletesData).map(a => {
        if (!athleteColors[a.display_name]) athleteColors[a.display_name] = `hsl(${Math.random()*360},100%,50%)`;
        return {
            label: a.display_name,
            data: a.daily_points,
            borderColor: athleteColors[a.display_name],
            borderWidth: 2,
            tension: 0,      // rigid lines
            fill: false,
            pointRadius: 0,
            spanGaps: true
        };
    });

    // --- Compute maxPoints and step using nice multiples of 5 ---
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

    summary.innerHTML = datasets.map((d,i)=>{
        const athlete = Object.values(athletesData)[i];
        const total = d.data.filter(v=>typeof v==="number").pop() || 0;
        return `<div style="display:flex;align-items:center;gap:8px;">
            <img src="${athlete.profile}" style="width:22px;height:22px;border-radius:50%;">
            <span style="color:${d.borderColor}">${d.label}</span>
            <span style="opacity:0.7">${total.toFixed(1)} pts</span>
        </div>`;
    }).join("");

    // --- Chart.js with athlete images ---
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
                y: {
                    min: 0,
                    max: maxPoints,
                    ticks: { font: { size: fontSize }, stepSize: yStep },
                    title: { display:false, text:"Cumulative Points", font:{ size: fontSize } }
                }
            }
        },
        plugins:[{
            id:"athleteImages",
            afterDatasetsDraw(chart){
                const { ctx, scales:{x,y} } = chart;
                chart.data.datasets.forEach((ds,i)=>{
                    const athlete = Object.values(athletesData)[i];
                    let last=-1;
                    for(let j=ds.data.length-1;j>=0;j--){
                        if(typeof ds.data[j]==="number" && ds.data[j] >= 0){last=j;break;}
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

// --- Utility function for nice y-axis multiples ---
function getNiceAxisMultipleOf5(value, desiredTicks = 5) {
    if (value <= 0) return { max: 5, step: 5 };

    let roughMax = Math.ceil(value / 5) * 5;
    let step = Math.ceil(roughMax / desiredTicks / 5) * 5;

    return { max: roughMax, step };
}


// --- Toggle ---
function initChallengeToggle() {
    const toggle = document.getElementById("challengeToggle");
    const dashboard = document.getElementById("container");
    const challenge = document.getElementById("challengeContainer");
    const monthSelector = document.getElementById("dailyMonthSelector");
    const monthLabel = document.querySelector(".month-label");

    if (!toggle) return;

    toggle.addEventListener("change", async () => {
        const isChallengeOn = toggle.checked;

        // --- Hide visually but keep layout ---
        monthSelector.style.visibility = isChallengeOn ? "hidden" : "visible";
        monthLabel.style.visibility = isChallengeOn ? "hidden" : "visible";

        if (isChallengeOn) {
            dashboard.style.display = "none";
            challenge.style.display = "block";
            window.DASHBOARD.destroyCharts();

            // Load JSONs dynamically
            const challengeJSONs = await loadChallengeJSONs();

            // Combine and render
            const athletesData = combineChallengeData(challengeJSONs);
            renderChallenge(athletesData);
        } else {
            destroyChallenge();
            challenge.style.display = "none";
            dashboard.style.display = "flex";
            window.DASHBOARD.renderDashboard();
        }
    });
}


document.addEventListener("DOMContentLoaded",()=>{
    if(window.DASHBOARD?.getData){
        initChallengeToggle();
    }
});
