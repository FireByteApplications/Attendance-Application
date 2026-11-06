import { useTitle } from '../../hooks/useTitle.jsx';
import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import {csrfFetch} from "../../Components/csrfHelper.jsx"
import ReportPagination from '../../Components/ReportPagination.jsx';
import { pageSlice, REPORT_PAGE_SIZE } from '../../Utils/reportPagination.js';

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


export default function Reports() {
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    startTime: '',
    endTime: '',
    name: '',
    activity: '',
    operational: '',
    includeZeroAttendance: false,
    detailed: false,
    incidentType: '',
  });
  const activities = activityOptions[form.operational || 'Any'];
  const [report, setReport] = useState(null);
  const [reportPage, setReportPage] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const loadReport = async (query) => {
    setIsPageLoading(true);
    setErrorMessage('');
    try {
      const res = await csrfFetch(apiUrl, '/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(query),
      });
      const result = await res.json();
      if (!res.ok) {
        setErrorMessage(`An error has occurred: ${result.message || result.error || 'Please try again.'}`);
        return;
      }

      const isDetailed = !!query.detailed;
      const rows = isDetailed
        ? (Array.isArray(result?.records) ? result.records : [])
        : (Array.isArray(result) ? result : []);
      const count = typeof result?.count === 'number' ? result.count : rows.length;
      setReport({
        count,
        hasActivityLocation: isDetailed && rows.some((row) => row?.deploymentLocation),
        hasActivityType: isDetailed && rows.some((row) =>
          row?.deploymentType || row?.baType || row?.chainsawType || row?.otherType),
        isDetailed,
        rows,
        query,
      });
      setReportPage(query.page || 1);
    } catch {
      setErrorMessage('Unable to load the report. Please try again.');
    } finally {
      setIsPageLoading(false);
    }
  };

  const runReport = (e) => {
    e.preventDefault();
    const query = {
      startEpoch: moment.tz(form.startTime, 'Australia/Sydney').valueOf(),
      endEpoch: moment.tz(form.endTime, 'Australia/Sydney').valueOf(),
      name: form.name,
      activity: form.activity,
      operational: form.operational,
      detailed: form.detailed,
      includeZeroAttendance: form.includeZeroAttendance,
      ...(form.detailed && { page: 1, pageSize: REPORT_PAGE_SIZE }),
    };
    loadReport(query);
  };

  const changePage = (nextPage) => {
    if (report?.isDetailed) loadReport({ ...report.query, page: nextPage });
    else setReportPage(nextPage);
  };
  const exportExcel = async () => {
    const start = moment.tz(form.startTime, "Australia/Sydney");
    const end = moment.tz(form.endTime, "Australia/Sydney");
    const formattedStart = start.format('YYYYMMDD');
    const formattedEnd = end.format('YYYYMMDD');

    const res = await csrfFetch(apiUrl, "/api/reports/export", {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
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
  const visibleRows = report?.isDetailed
    ? report.rows
    : pageSlice(report?.rows, reportPage);
  return (
    <>
      <div className="container mt-5">
        <h1 className="mb-4">Reports</h1>
        {errorMessage && <div className="alert alert-danger fade show">{errorMessage}</div>}
        <div className="card p-4 mb-4">
          <form className="row g-3" onSubmit={runReport}>
            <div className="col-12 col-md-6 col-xl-auto">
              <label className="form-label">Start Date/Time</label>
              <input type="datetime-local" className="form-control" name="startTime" value={form.startTime} onChange={handleChange} />
            </div>
            <div className="col-12 col-md-6 col-xl-auto">
              <label className="form-label">End Date/Time</label>
              <input type="datetime-local" className="form-control" name="endTime" value={form.endTime} onChange={handleChange} />
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <label className="form-label">Name</label>
              <select className="form-select" name="name" value={form.name} onChange={handleChange}>
                <option value="">Any</option>
                {userOptions.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <label className="form-label">Operational</label>
              <select className="form-select" name="operational" value={form.operational} onChange={handleChange}>
                <option value="">Any</option>
                <option value="Operational">Operational</option>
                <option value="Non-Operational">Non-Operational</option>
              </select>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <label className="form-label">Activity</label>
              <select className="form-select" name="activity" value={form.activity} onChange={handleChange}>
                <option value="">Any</option>
                {activities.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
            </div>
            <div className="form-check mt-3">
              <input type="checkbox" className="form-check-input" name="includeZeroAttendance" checked={form.includeZeroAttendance} onChange={handleChange} />
              <label className="form-check-label">Include members with 0 attendance</label>
            </div>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                name="detailed"
                checked={form.detailed}
                onChange={handleChange}
              />
              <label className="form-check-label">Detailed attendance</label>
            </div>
            <div className="col-12 mt-3">
              <button type="submit" className="btn btn-primary me-2" disabled={isPageLoading}>
                {isPageLoading ? 'Loading…' : 'Run Report'}
              </button>
            </div>
          </form>
        </div>
        
        {report && (
          <div id="reportResults">
            <div className="report-results__header">
              <h3 className="mb-0">Found {report.count} record(s)</h3>
              {report.count > 0 && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={exportExcel}
                >
                  Export to Excel
                </button>
              )}
            </div>
            <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  {report.isDetailed ? (
                    <>
                      <th>Timestamp</th>
                      <th>Name</th>
                      <th>Operational</th>
                      <th>Activity</th>
                      {report.hasActivityType && <th>Activity Detail</th>}
                      {report.hasActivityLocation && <th>Activity Location</th>}
                    </>
                  ) : (
                    <>
                      <th>Name</th>
                      <th>Member Number</th>
                      <th>Member status</th>
                      <th>Membership Classification</th>
                      <th>Membership Type</th>
                      <th>Operational activities</th>
                      <th>Non-Operational Activities</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row._id || `${row.name || row.user || 'record'}-${index}`}>
                    {report.isDetailed ? (
                      <>
                        <td>{moment.tz(row.epochTimestamp, "Australia/Sydney").format("DD-MM-YYYY HH:mm")}</td>
                        <td>{row.name ?? ''}</td>
                        <td>{row.operational ?? ''}</td>
                        <td>{row.activity ?? ''}</td>
                        {report.hasActivityType && (
                          <td>{row.deploymentType || row.baType || row.chainsawType || row.otherType || ''}</td>
                        )}
                        {report.hasActivityLocation && <td>{row.deploymentLocation || ''}</td>}
                      </>
                    ) : (
                      <>
                        <td>{row.user ?? row.name ?? ''}</td>
                        <td>{row.memberNumber ?? ''}</td>
                        <td>{row.status ?? ''}</td>
                        <td>{row.membership_classification ?? row.Membership_Classification ?? ''}</td>
                        <td>{row.membership_type ?? ''}</td>
                        <td>{row.operationalActivities ?? 0}</td>
                        <td>{row.nonOperationalActivities ?? 0}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <ReportPagination count={report.count} page={reportPage} pageSize={REPORT_PAGE_SIZE}
              busy={isPageLoading} onPageChange={changePage} />
          </div>
        )}
      </div>
    </>
  );
}
