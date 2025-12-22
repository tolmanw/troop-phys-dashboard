let challengeChart = null;

document.getElementById("challengeToggle").addEventListener("change", e => {
  const on = e.target.checked;

  document.getElementById("container").style.display = on ? "none" : "flex";
  document.getElementById("challengeContainer").style.display = on ? "block" : "none";

  if (on) {
    // Destroy all dashboard charts
    window.DASHBOARD.destroyCharts();

    // Get athletes data
    const { athletesData, monthNames } = window.DASHBOARD.getData();

    // Always use current month
    const currentMonthIndex = new Date().getMonth();

    renderChallenge(athletesData, monthNames, currentMonthIndex);
  } else {
    destroyChallenge();
    window.DASHBOARD.renderDashboard();
  }
});

function destroyChallenge() {
  challengeChart?.destroy();
  document.getElementById("challengeContainer").innerHTML = "";
}

function renderChallenge(data, months, idx) {
  const container = document.getElementById("challengeContainer");
  container.innerHTML = `<h2 style="text-align:center;">${months[idx]} Challenge</h2><canvas id="challenge"></canvas>`;

  const athletes = Object.values(data);

  // Prepare cumulative data for each athlete
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
      plugins: {
        legend: { display: true, position: "bottom" }
      },
      scales: {
        x: {
          title: { display: true, text: "Day of Month" },
          ticks: { autoSkip: false }
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
        const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart;

        athletes.forEach((a, i) => {
          const dataset = chart.data.datasets[i];
          const lastIndex = dataset.data.length - 1;
          const xPos = x.getPixelForValue(lastIndex + 1);
          const yPos = y.getPixelForValue(dataset.data[lastIndex]);

          const img = new Image();
          img.src = a.profile;

          img.onload = () => {
            const size = 24; // profile image size
            ctx.drawImage(img, xPos - size / 2, yPos - size / 2, size, size);
          };
        });
      }
    }]
  });
}

// Utility function to generate distinct colors
function getRandomColor() {
  const r = Math.floor(Math.random() * 200 + 30);
  const g = Math.floor(Math.random() * 200 + 30);
  const b = Math.floor(Math.random() * 200 + 30);
  return `rgb(${r},${g},${b})`;
}
