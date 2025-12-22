let challengeChart = null;

// Fetch data once when the page loads
let challengeData = null;
let challengeMonths = null;

async function loadChallengeData() {
    if (challengeData && challengeMonths) return; // already loaded

    const response = await fetch("data/athletes.json");
    const data = await response.json();

    challengeData = data.athletes;
    challengeMonths = data.month_names.map(m => m.substr(0,3));
}

// Toggle listener
document.getElementById("challengeToggle").addEventListener("change", async e => {
    const on = e.target.checked;

    document.getElementById("container").style.display = on ? "none" : "flex";
    document.getElementById("challengeContainer").style.display = on ? "block" : "none";

    if (on) {
        await loadChallengeData();
        destroyChallenge();

        const currentMonthIndex = new Date().getMonth();
        renderChallenge(challengeData, challengeMonths, currentMonthIndex);
    } else {
        destroyChallenge();
        // optionally, show dashboard again
        document.getElementById("container").style.display = "flex";
    }
});

function destroyChallenge() {
    challengeChart?.destroy();
    document.getElementById("challengeContainer").innerHTML = "";
}

function renderChallenge(data, months, idx) {
    const el = document.getElementById("challengeContainer");
    el.innerHTML = `<h2 style="text-align:center;">${months[idx]} Challenge</h2><canvas id="challenge"></canvas>`;

    const athletes = Object.values(data);

    // cumulative dataset
    const datasets = athletes.map(a => {
        let cumulative = 0;
        return {
            label: a.display_name,
            data: (a.daily_distance_km[idx] || []).map(d => +(cumulative += d * 0.621371).toFixed(2)),
            tension: 0.3,
            borderColor: getRandomColor(),
            fill: false,
            pointRadius: 3,
            borderWidth: 2
        };
    });

    const labels = datasets[0]?.data.map((_, i) => i + 1) || [];

    challengeChart = new Chart(document.getElementById("challenge"), {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: "bottom" } },
            scales: {
                x: { title: { display: true, text: "Day of Month" } },
                y: { title: { display: true, text: "Cumulative Distance (mi)" }, beginAtZero: true }
            }
        },
        plugins: [{
            id: "athleteImages",
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;
                athletes.forEach((a, i) => {
                    const dataset = chart.data.datasets[i];
                    const lastIndex = dataset.data.length - 1;
                    const xPos = x.getPixelForValue(lastIndex + 1);
                    const yPos = y.getPixelForValue(dataset.data[lastIndex]);

                    const img = new Image();
                    img.src = a.profile;
                    img.onload = () => {
                        const size = 24;
                        ctx.drawImage(img, xPos - size / 2, yPos - size / 2, size, size);
                    };
                });
            }
        }]
    });
}

// utility to generate distinct colors
function getRandomColor() {
    const r = Math.floor(Math.random() * 200 + 30);
    const g = Math.floor(Math.random() * 200 + 30);
    const b = Math.floor(Math.random() * 200 + 30);
    return `rgb(${r},${g},${b})`;
}
