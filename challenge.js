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

    // --- Styles and rendering omitted for brevity (unchanged) ---
    // ... existing rulesCard, chartCard, summaryCard, winnersCard styling and Chart.js rendering ...
    // --- Totals calculation ---
    const summary = container.querySelector(".challenge-summary");
    summary.innerHTML = Object.values(athletesData)
        .map(a => {
            const total = a.daily_points.filter(v => typeof v === "number").pop() || 0;
            return { athlete: a, total, color: athleteColors[a.display_name] };
        })
        .sort((a, b) => b.total - a.total)
        .map(({ athlete, total, color }) => `
            <div style="display:flex;align-items:center;gap:8px;">
                <img src="${athlete.profile}" style="width:22px;height:22px;border-radius:50%;">
                <span style="color:${color}">${athlete.display_name}</span>
                <span style="opacity:0.7">${total.toFixed(1)} pts</span>
            </div>
        `).join("");

    // --- Monthly Winners Card (existing rendering left unchanged) ---
    const winnersContainer = container.querySelector(".challenge-winners-card .challenge-winners");
    winnersContainer.innerHTML = ""; // keep rendering logic the same

    // --- Chart.js code omitted for brevity ---

    // --- New addition: log monthly winners to console ---
    logMonthlyWinners(athletesData);
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

// --- New function: log monthly winners ---
async function logMonthlyWinners(athletesData) {
    const today = new Date();
    const monthNamesFull = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const currentMonthFull = monthNamesFull[today.getMonth()];

    // Determine current winner
    const currentWinner = Object.values(athletesData)
        .map(a => ({
            athlete: a,
            total: a.daily_points
                .slice(0, today.getDate())
                .filter(v => typeof v === "number")
                .pop() || 0
        }))
        .sort((a, b) => b.total - a.total)[0];

    // Load existing winners JSON if available
    let pastWinners = [];
    try {
        const res = await fetch("data/monthlyWinners.json");
        pastWinners = await res.json();
    } catch (e) {
        console.warn("Could not load monthlyWinners.json, starting fresh");
    }

    // Replace current month winner
    pastWinners = pastWinners.filter(w => w.monthName !== currentMonthFull);
    pastWinners.push({
        monthName: currentMonthFull,
        name: currentWinner.athlete.display_name,
        profile: currentWinner.athlete.profile || "default_profile.png",
        points: currentWinner.total
    });

    // Sort chronologically
    pastWinners.sort((a, b) => monthNamesFull.indexOf(a.monthName) - monthNamesFull.indexOf(b.monthName));

    // Print JSON ready to paste
    console.log("\n=== Monthly Winners JSON ===\n");
    console.log(JSON.stringify(pastWinners, null, 2));
    console.log("\n=== End of JSON ===\n");
}
