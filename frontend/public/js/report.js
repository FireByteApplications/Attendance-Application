// Initialize Flatpickr for date/time pickers
flatpickr(".datetimepicker", {
  enableTime: true,
  dateFormat: "Y-m-d H:i",
  time_24hr: true,
  timezone: "Australia/Sydney",
  noCalendar: false,
  position: "auto"  // Make sure the calendar shows up where expected
});
const activityOptions = {
  "Operational": [
    "Incident-Call",
    "Strike-Team",
    "Deployment",
    "Hazard-Reduction",
    "Pile-Burn",
    "Other-operational"
  ],
  "Non-Operational": [
    "Meeting",
    "Training",
    "Maintenance",
    "Other",
    "Community-Engagement",
    "BA-Checks",
  ],
  "Any": [
    "Incident-Call",
    "Strike-Team",
    "Deployment",
    "Hazard-Reduction",
    "Pile-Burn",
    "Other-operational",
    "Meeting",
    "Training",
    "Maintenance",
    "Other",
    "Community-Engagement",
    "BA-Checks"
  ]
}; 
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("operational").dispatchEvent(new Event("change"));
});
sessionStorage.setItem('lastPage', window.location.href);

window.addEventListener("DOMContentLoaded", () => {
  populateUsernames();
});
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("runReportBtn").addEventListener("click", async () => {
    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;
    const name = document.getElementById("name").value;
    const activity = document.getElementById("activity").value;
    const operational = document.getElementById("operational").value;

    const startEpoch = moment.tz(start, "Australia/Sydney").valueOf();
    const endEpoch = moment.tz(end, "Australia/Sydney").valueOf();

    const response = await fetch("/admin/reports/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startEpoch, endEpoch, name, activity, operational })
    });
    const result = await response.json();
    const container = document.getElementById("reportResults");

    if (result.count === 0) {
      container.innerHTML = `<div class="alert alert-warning">No records found for the selected filters.</div>`;
    } else {
      let html = `
        <h3 class="mb-3">Found ${result.count} record(s)</h3>
        <table class="table table-bordered">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Name</th>
              <th>Operational</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
      `;

      result.records.forEach(record => {
        html += `
          <tr>
            <td>${record.timestamp}</td>
            <td>${record.name}</td>
            <td>${record.operational}</td>
            <td>${record.activity}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;

      container.innerHTML = html;
    }
  });
});


document.getElementById("exportExcelBtn").addEventListener("click", async () => {
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;
  const name = document.getElementById("name").value;
  const activity = document.getElementById("activity").value;
  const operational = document.getElementById("operational").value;
  const includeZeroAttendance = document.getElementById("includeZeroAttendance").checked;
  const startEpoch = moment.tz(start, "Australia/Sydney").valueOf();
  const endEpoch = moment.tz(end, "Australia/Sydney").valueOf();
  const startDate = new Date(start);
  const endDate = new Date(end);
  const formattedStart = startDate.toISOString().slice(0,10).replace(/-/g, '');
  const formattedEnd = endDate.toISOString().slice(0,10).replace(/-/g, '');
  const query = { startEpoch, endEpoch, name, activity, operational, includeZeroAttendance, formattedStart, formattedEnd };

  const response = await fetch("/admin/reports/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query)
  });

  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `member-attendance-report-${formattedStart}-${formattedEnd}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
});
document.getElementById("operational").addEventListener("change", function() {
  const selectedStatus = this.value || "Any";
  const activities = activityOptions[selectedStatus];
  const activitySelect = document.getElementById("activity");

  // Clear existing options
  activitySelect.innerHTML = "";

  // Add "Any" option first
  const anyOption = document.createElement("option");
  anyOption.value = "";
  anyOption.textContent = "Any";
  activitySelect.appendChild(anyOption);

  // Populate activity options
  activities.forEach(activity => {
    const option = document.createElement("option");
    option.value = activity;
    option.textContent = activity;
    activitySelect.appendChild(option);
  });
});
function populateUsernames() {
  const nameSelect = document.getElementById("name");

  // Clear existing options
  nameSelect.innerHTML = '<option value="">Any</option>';

  usersList.forEach(user => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.id;
    nameSelect.appendChild(option);
  });
}
populateUsernames()