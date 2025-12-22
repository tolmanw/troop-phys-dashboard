let challengeChart = null;

document.getElementById("challengeToggle").addEventListener("change", e => {
  const on = e.target.checked;

  document.getElementById("container").style.display = on ? "none" : "flex";
  document.getElementById("challengeContainer").style.display = on ? "block" : "none";

  if (on) {
    window.DASHBOARD.destroyCharts();
    const { athletesData, monthNames } = window.DASHBOARD.getData();
    renderChallenge(athletesData, monthNames, new Date().getMonth());
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
  const el = document.getElementById("challengeContainer");
  el.innerHTML = `<h2>${months[idx]} Challenge</h2><canvas id="challenge"></canvas>`;

  const sets = Object.values(data).map(a=>{
    let t=0;
    return {
      label: a.display_name,
      data: (a.daily_distance_km[idx]||[]).map(d=>+(t+=d*0.621371).toFixed(2)),
      tension:0.3
    };
  });

  challengeChart = new Chart(document.getElementById("challenge"),{
    type:"line",
    data:{ labels: sets[0]?.data.map((_,i)=>i+1), datasets:sets }
  });
}
