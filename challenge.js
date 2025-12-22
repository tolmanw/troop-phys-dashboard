let challengeChart = null;

// Load JSON data for challenge
async function loadChallengeData() {
    const response = await fetch("data/athletes.json");
    const data = await response.json();
    return {
        athletes: Object.values(data.athletes),
        monthNames: data.month_names.map(m => m.substr(0,3))
    };
}

// Toggle challenge chart
document.getElementById("challengeToggle").addEventListener("change", async e => {
    const on = e.target.checked;

    document.getElementById("container").style.display = on ? "none" : "flex";
    const container = document.getElementById("challengeContainer");
    container.style.display = on ? "block" : "none";

    if (on) {
        destroyChallenge();
        const { athletes, monthNames } = await loadChallengeData();
        const currentMonthIndex = new Date().getMonth();
        renderChallenge(athletes, monthNames, currentMonthIndex);
    } else {
        destroyChallenge();
        document.getElementById("container").style.display = "flex";
    }
});

// Destroy previous chart
function destroyChallenge() {
    if (challengeChart) {
        challengeChart.destroy();
        challengeChart = null;
    }
    const container = document.getElementById("challengeContainer");
    container.innerHTML = `<h2 style="text-align:center;"></h2><canvas id="challenge"></canvas>`;
}

// Render cumulative distance chart
function renderChallenge(athletes, months, monthIdx) {
    const container = document.getElementById("challengeContainer");
    container.querySelector("h2").textContent = `${months[monthIdx]} Challenge`;

    // Set responsive canvas height
    const canvas = container.querySelector("#challenge");
    canvas.style.width = "100%";
    canvas.style.height = window.innerWidth <= 600 ? "200px" : "300px";

    // Compute cumulative distance for each athlete
    const datasets = athletes.map(a => {
        let cumulative = 0;
        const data = (a.daily_distance_km[monthIdx] || []).map(d => +(cumulative += d * 0.621371).toFixed(2));
        return {
            label: a.display_name,
            data,
            tension: 0.3,
            borderColor: getRandomColor(),
            fill: false,
            pointRadius: 3,
            borderWidth: 2
        };
    });

    const labels = datasets[0]?.data.map((_, i) => i + 1) || [];

    const ctx = canvas.getContext("2d");
    challengeChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: true, position: "bottom" }
            },
            scales: {
                x: { 
                    title: { display: true, text: "Day of Month" },
                    ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 }
                },
                y: { 
                    title: { display: true, text: "Cumulative Distance (mi)" }, 
                    beginAtZero: true 
                }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;
                athletes.forEach((a, i) => {
                    const dataset = chart.data.datasets[i];
                    if (!dataset.data.length) return;
                    const lastIndex = dataset.data.length - 1;
                    const xPos = x.getPixelForValue(lastIndex + 1);
                    const yPos = y.getPixelForValue(dataset.data[lastIndex]);

                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
                        // scale images for mobile
                        const size = window.innerWidth <= 600 ? 16 : 24;
                        ctx.drawImage(img, xPos - size / 2, yPos - size / 2, size, size);
                    };
                });
            }
        }]
    });

    // Adjust chart height dynamically on window resize
    window.addEventListener("resize", () => {
        if (!challengeChart) return;
        canvas.style.height = window.innerWidth <= 600 ? "200px" : "300px";
        challengeChart.resize();
    });
}

// Utility for random line colors
function getRandomColor() {
    const r = Math.floor(Math.random() * 200 + 30);
    const g = Math.floor(Math.random() * 200 + 30);
    const b = Math.floor(Math.random() * 200 + 30);
    return `rgb(${r},${g},${b})`;
}
