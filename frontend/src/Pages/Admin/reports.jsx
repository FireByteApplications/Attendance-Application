import { useTitle } from '../../hooks/useTitle.jsx';
import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import {useCsrfToken} from "../../Components/csrfHelper.jsx"

const apiUrl = import.meta.env.VITE_API_BASE_URL;
const activityOptions = {
  Operational: [
    "Incident-Call",
    "Strike-Team",
    "Deployment",
    "Hazard-Reduction",
    "Pile-Burn",
    "Other-operational",
  ],
  "Non-Operational": [
    "Meeting",
    "Training",
    "Maintenance",
    "Other-Non-operational",
    "Community-Engagement",
    "BA-Checks",
    "Chainsaw-Checks"
  ],
  Any: [
    "Incident-Call",
    "Strike-Team",
    "Deployment",
    "Hazard-Reduction",
    "Pile-Burn",
    "Other-operational",
    "Meeting",
    "Training",
    "Maintenance",
    "Other-Non-operational",
    "Community-Engagement",
    "BA-Checks",
    "Chainsaw-Checks"
  ],
};

export default function Reports({ users = [] }) {
  const csrfToken = useCsrfToken(apiUrl);
      useEffect(() => {
          if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
        }, [csrfToken]);
  const [form, setForm] = useState({
    startTime: '',
    endTime: '',
    name: '',
    activity: '',
    operational: '',
    includeZeroAttendance: false,
    incidentType: '',
    deploymentArea: '',
    baType: '',
    chainsawType: '',
    otherType: ''
  });

  const [activities, setActivities] = useState(activityOptions.Any);
  const [reportHTML, setReportHTML] = useState('');
  const [userOptions, setUserOptions] = useState([]);

  useEffect(() => {
    fetch(`${apiUrl}/api/users/names`, {
      method: "GET",
      credentials: "include"
    })
      .then(res => res.json())
      .then(data => setUserOptions(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setActivities(activityOptions[form.operational || 'Any']);
  }, [form.operational]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const runReport = async (e) => {
    e.preventDefault();
    const startEpoch = moment.tz(form.startTime, "Australia/Sydney").valueOf();
    const endEpoch = moment.tz(form.endTime, "Australia/Sydney").valueOf();

    const res = await fetch(`${apiUrl}/api/reports/run`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
      },
      credentials: "include",
      body: JSON.stringify({
        startEpoch,
        endEpoch,
        name: form.name,
        activity: form.activity,
        operational: form.operational,
        DeploymentType: form.incidentType,
        deploymentArea: form.deploymentArea,
        baType: form.baType,
        chainsawType: form.chainsawType,
        otherType: form.otherType
      }),
    });

    const result = await res.json();
    console.log(result)
    if (!result.count) {
      setReportHTML('<div class="alert alert-warning">No records found for the selected filters.</div>');
    } else {
      const html = `
        <h3 class="mb-3">Found ${result.count} record(s)</h3>
        <table class="table table-bordered">
          <thead>
            <tr>
              <th>Timestamp</th><th>Name</th><th>Operational</th><th>Activity</th>
              ${form.activity === 'Deployment' ? '<th>Incident Type</th><th>Deployment Area</th>' : ''}
              ${form.activity === 'BA-Checks' ? '<th>BA Type</th>' : ''}
              ${form.activity === 'Chainsaw-Checks' ? '<th>Chainsaw Type</th>' : ''}
              ${form.activity === 'Other-Non-operational' || form.activity === 'Other-operational' ? '<th>Other Activity</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${result.records.map((r) => `
              <tr>
                <td>${moment.tz(r.epochTimestamp, "Australia/Sydney").format("DD-MM-YYYY HH:mm")}</td>
                <td>${r.name}</td>
                <td>${r.operational}</td>
                <td>${r.activity}</td>
                ${form.activity === 'Deployment' ? `<td>${r.deploymentType || ''}</td><td>${r.deploymentLocation || ''}</td>` : ''}
                ${form.activity === 'BA-Checks' ? `<td>${r.baType || ''}</td>` : ''}
                ${form.activity === 'Chainsaw-Checks' ? `<td>${r.chainsawType || ''}</td>` : ''}
                ${form.activity === 'Other-Non-operational' || form.activity === 'Other-operational' ? `<td>${r.otherType || ''}</td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>`;
      setReportHTML(html);
    }
  };

  const exportExcel = async (e) => {
    e.preventDefault();
    const start = moment.tz(form.startTime, "Australia/Sydney");
    const end = moment.tz(form.endTime, "Australia/Sydney");
    const formattedStart = start.format('YYYYMMDD');
    const formattedEnd = end.format('YYYYMMDD');

    const res = await fetch(`${apiUrl}/api/reports/export`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf")
      },
      credentials: "include",
      body: JSON.stringify({
        startEpoch: start.valueOf(),
        endEpoch: end.valueOf(),
        name: form.name,
        activity: form.activity,
        operational: form.operational,
        includeZeroAttendance: form.includeZeroAttendance,
        formattedStart,
        formattedEnd,
        DeploymentType: form.incidentType,
        deploymentArea: form.deploymentArea,
        baType: form.baType,
        chainsawType: form.chainsawType,
        otherType: form.otherType
      }),
    });

    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `member-attendance-report-${formattedStart}-${formattedEnd}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  useTitle('Attendance Reports');
  return (
    <>
      <div className="container mt-5">
        <h1 className="mb-4">Reports</h1>
        <div className="card p-4 mb-4">
          <form className="row g-3" onSubmit={runReport}>
            <div className="col-auto">
              <label className="form-label">Start Date/Time</label>
              <input type="datetime-local" className="form-control" name="startTime" value={form.startTime} onChange={handleChange} />
            </div>
            <div className="col-auto">
              <label className="form-label">End Date/Time</label>
              <input type="datetime-local" className="form-control" name="endTime" value={form.endTime} onChange={handleChange} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Name</label>
              <select className="form-select" name="name" value={form.name} onChange={handleChange}>
                <option value="">Any</option>
                {userOptions.map((u) => <option key={u.id} value={u.id}>{u.id}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Operational</label>
              <select className="form-select" name="operational" value={form.operational} onChange={handleChange}>
                <option value="">Any</option>
                <option value="Operational">Operational</option>
                <option value="Non-Operational">Non-Operational</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Activity</label>
              <select className="form-select" name="activity" value={form.activity} onChange={handleChange}>
                <option value="">Any</option>
                {activities.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-check mt-3">
              <input type="checkbox" className="form-check-input" name="includeZeroAttendance" checked={form.includeZeroAttendance} onChange={handleChange} />
              <label className="form-check-label">Include users with 0 attendance</label>
            </div>
            <div className="col-12 mt-3">
              <button type="submit" className="btn btn-primary me-2">Run Report</button>
              <button className="btn btn-success" onClick={exportExcel}>Export to Excel</button>
            </div>
          </form>
        </div>
        <div id="reportResults" dangerouslySetInnerHTML={{ __html: reportHTML }} />
      </div>
    </>
  );
}
