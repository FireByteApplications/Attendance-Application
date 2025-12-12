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
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    startTime: '',
    endTime: '',
    name: '',
    activity: '',
    operational: '',
    includeZeroAttendance: false,
    detailed: false,
    incidentType: ''
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
    if(name === "detailedAttendance"){
      form.detailed = checked
    }
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
        detailed: form.detailed,
        includeZeroAttendance: form.includeZeroAttendance
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      setErrorMessage("An error has occured: " + result.message)
      setTimeout(() => {
        setErrorMessage(null)
      }, 8000);
    } else {
        const isDetailed = !!form.detailed;

        const rows = isDetailed
          ? (Array.isArray(result?.records) ? result.records
             : Array.isArray(result) ? result
             : [])

          : (Array.isArray(result)? result : []);

        const count = (typeof result?.count === 'number') ? result.count : rows.length;

        const hasActivityType = !!(isDetailed && rows.some(r =>
          r?.deploymentType || r?.baType || r?.chainsawType || r?.otherType
        ));

        const hasActivityLocation = !!(isDetailed && rows.some(r => r?.deploymentLocation));

        const headerHtml = isDetailed
        ? `
          <th>Timestamp</th>
          <th>Name</th>
          <th>Operational</th>
          <th>Activity</th>
          ${hasActivityType ? '<th>Activity Detail</th>' : ''}
          ${hasActivityLocation ? '<th>Activity Location</th>' : ''}
        `
        : `
          <th>Name</th>
          <th>Member Number</th>
          <th>Member status</th>
          <th>Membership Classification</th>
          <th>Membership Type</th>
          <th>Operational activities</th>
          <th>Non-Operational Activities</th>
        `;

        const rowsHtml = isDetailed
          ? rows.map(r => `
              <tr>
                <td>${moment.tz(r.epochTimestamp, "Australia/Sydney").format("DD-MM-YYYY HH:mm")}</td>
                <td>${r.name ?? ''}</td>
                <td>${r.operational ?? ''}</td>
                <td>${r.activity ?? ''}</td>
                ${hasActivityType ? `<td>${r.deploymentType || r.baType || r.chainsawType || r.otherType || ''}</td>` : ''}
                ${hasActivityLocation ? `<td>${r.deploymentLocation || ''}</td>` : ''}
              </tr>
            `).join('')
          : rows.map(r => `
              <tr>
                <td>${r.user ?? r.name ?? ''}</td>
                <td>${r.memberNumber ?? ''}</td>
                <td>${r.status ?? ''}</td>
                <td>${r.membership_classification ?? r.Membership_Classification ?? ''}</td>
                <td>${r.membership_type ?? ''}</td>
                <td>${r.operationalActivities ?? 0}</td>
                <td>${r.nonOperationalActivities ?? 0}</td>
              </tr>
            `).join('');
        const html = `
          <div class="position-relative">
            ${count > 0 ? `
              <div class="col-12 mt-3">
                <button class="btn btn-success position-absolute top-0 end-0 mt-0 me-2 z-1" data-action="export-excel">
                  Export to Excel
                </button>
              </div>` : ''
            }
            <h3 class="mb-3">Found ${count} record(s)</h3>
            <table class="table table-bordered">
              <thead><tr>${headerHtml}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
        setReportHTML(html);
            }
          }
  const exportExcel = async (e) => {
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
        detailed: form.detailed,
        formattedStart,
        formattedEnd
      }),
    });
    
    if(!res.ok){
      setErrorMessage("An error has occured please check your filters and try again")
      setTimeout(() => {
        setErrorMessage(null)
      }, 2000);
    } else{
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `member-attendance-report-${formattedStart}-${formattedEnd}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };
  useTitle('Attendance Reports');
  return (
    <>
      <div className="container mt-5">
        <h1 className="mb-4">Reports</h1>
        {errorMessage && <div className="alert alert-danger fade show">{errorMessage}</div>}
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
                {userOptions.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
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
              <label className="form-check-label">Include members with 0 attendance</label>
            </div>
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" role="switch" name="detailedAttendance" onChange={handleChange}></input>
              <label className="form-check-label">Detailed attendance</label>
            </div>
            <div className="col-12 mt-3">
              <button type="submit" className="btn btn-primary me-2">Run Report</button>
            </div>
          </form>
        </div>
        
        <div onClick={(e) => {
            if (e.target.closest('[data-action="export-excel"]')) {
              exportExcel();
            }
          }}
          id="reportResults" dangerouslySetInnerHTML={{ __html: reportHTML }} />
      </div>
    </>
  );
}
