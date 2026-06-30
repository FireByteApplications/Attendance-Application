import { useTitle } from "../../hooks/useTitle.jsx";
import { useEffect, useState } from "react";
import moment from "moment-timezone";
import { useCsrfToken } from "../../Components/csrfHelper.jsx";

const apiUrl = import.meta.env.VITE_API_BASE_URL;

export default function RoleReports() {
  useTitle("Role Reports");

  const csrfToken = useCsrfToken(apiUrl);

  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);

  const [users, setUsers] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const [reportRows, setReportRows] = useState([]);
  const [reportCount, setReportCount] = useState(0);

  const [selectedRoles, setSelectedRoles] = useState([]) 

  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const roles = [
    "Crew Leader",
    "Pump operator",
    "Driver",
    "Hose Operator",
    "BA Operator",
    "BACO",
    "Traffic management",
    "Chainsaw Operator",
    "First Aid",
    "Navigation",
    "Foam",
    "Hydrants",
   "Ladders",
    "Working on roofs",
    "TIC",
    "Flood Rescue",
    "Burnover"
    ];

  useEffect(() => {
    if (csrfToken) {
      sessionStorage.setItem("csrf", csrfToken);
    }
  }, [csrfToken]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const showMessage = (status, message) => {
    setSubmitStatus(status);
    setSubmitMessage(message);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/users/list`, {
        method: "GET",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage("error", result.message || "Failed to load users.");
        return;
      }

      setUsers(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Failed to load users:", error);
      showMessage("error", "Failed to load users.");
    }
  };

  const handleNameToggle = (name) => {
    setSelectedNames((current) => {
      if (current.includes(name)) {
        return current.filter((existingName) => existingName !== name);
      }

      return [...current, name];
    });
  };

  const handleSelectAll = () => {
    const allNames = users.map((user) => user.name).filter(Boolean);
    setSelectedNames(allNames);
  };

  const handleClearSelection = () => {
    setSelectedNames([]);
  };
  
  const handleRoleToggle = (role) => {
    setSelectedRoles((current) => {
      if (current.includes(role)) {
        return current.filter((existingRole) => existingRole !== role)
      }
      
      return [...current, role]
    })
  }

  const handleSelectAllRoles = () => {
    setSelectedRoles(roles.filter(Boolean));
  };

  const handleClearRolesSelection= () => {
    setSelectedRoles([]);
  }
  const getDateRangeEpochs = () => {
    const startEpoch = moment
      .tz(startDate, "YYYY-MM-DD", "Australia/Sydney")
      .startOf("day")
      .valueOf();

    const endEpoch = moment
      .tz(endDate, "YYYY-MM-DD", "Australia/Sydney")
      .endOf("day")
      .valueOf();

    return {
      startEpoch,
      endEpoch,
      formattedStart: moment
        .tz(startDate, "YYYY-MM-DD", "Australia/Sydney")
        .format("YYYYMMDD"),
      formattedEnd: moment
        .tz(endDate, "YYYY-MM-DD", "Australia/Sydney")
        .format("YYYYMMDD"),
    };
  };

  const validateFilters = () => {
    if (!startDate || !endDate) {
      showMessage("error", "Please select a start date and end date.");
      return false;
    }

    if (moment(endDate).isBefore(moment(startDate))) {
      showMessage("error", "End date cannot be before start date.");
      return false;
    }

    if (selectedNames.length === 0 && selectedRoles.length === 0) {
      showMessage("error", "Please select at least one member or one role.");
      return false;
    }

    return true;
  };

  const runReport = async (e) => {
    e.preventDefault();

    setSubmitMessage(null);
    setSubmitStatus(null);
    setReportRows([]);
    setReportCount(0);

    if (!validateFilters()) return;

    const { startEpoch, endEpoch } = getDateRangeEpochs();

    setIsRunning(true);

    try {
      const response = await fetch(`${apiUrl}/api/reports/roles/run`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
        },
        body: JSON.stringify({
          startEpoch,
          endEpoch,
          names: selectedNames,
          roles: selectedRoles
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage("error", result.message || "Failed to run role report.");
        return;
      }

      const rows = Array.isArray(result.records) ? result.records : [];

      setReportRows(rows);
      setReportCount(result.count ?? rows.length);

      if (rows.length === 0) {
        showMessage("error", "No role records found for the selected filters.");
      }
    } catch (error) {
      console.error("Failed to run role report:", error);
      showMessage("error", "Failed to run role report.");
    } finally {
      setIsRunning(false);
    }
  };

  const exportExcel = async () => {
    if (reportRows.length === 0) {
      showMessage("error", "Run a report with results before exporting.");
      return;
    }

    if (!validateFilters()) return;

    const { startEpoch, endEpoch, formattedStart, formattedEnd } =
      getDateRangeEpochs();

    setIsExporting(true);

    try {
      const response = await fetch(`${apiUrl}/api/reports/roles/export`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
        },
        body: JSON.stringify({
          startEpoch,
          endEpoch,
          names: selectedNames,
          formattedStart,
          formattedEnd,
        }),
      });

      if (!response.ok) {
        showMessage("error", "Failed to export role report.");
        return;
      }

      const blob = await response.blob();
      const link = document.createElement("a");

      link.href = URL.createObjectURL(blob);
      link.download = `role-report-${formattedStart}-${formattedEnd}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Failed to export role report:", error);
      showMessage("error", "Failed to export role report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mt-5">
      <div
        className="container justify-content-center my-4"
        style={{ minHeight: "100vh" }}
      >
        <h1 className="mb-4">Role Reports</h1>

        {submitMessage && (
          <div
            className={`alert ${
              submitStatus === "success" ? "alert-success" : "alert-danger"
            }`}
            role="alert"
          >
            {Array.isArray(submitMessage) ? (
              <ul className="mb-0">
                {submitMessage.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            ) : (
              submitMessage
            )}
          </div>
        )}

        <div className="card p-4 mb-4">
          <form className="row g-3" onSubmit={runReport}>
            <div className="col-md-3">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="col-md-4 position-relative">
              <label className="form-label">Members</label>

              <button
                type="button"
                className="form-select text-start"
                onClick={() => setMemberDropdownOpen((open) => !open)}
              >
                {selectedNames.length === 0
                  ? "Select members"
                  : `${selectedNames.length} member(s) selected`}
              </button>

              {memberDropdownOpen && (
                <div
                  className="card position-absolute w-100 shadow-sm mt-1"
                  style={{
                    zIndex: 1000,
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  <div className="card-body p-2">
                    <div className="d-flex gap-2 mb-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleSelectAll}
                      >
                        Select all
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={handleClearSelection}
                      >
                        Clear
                      </button>
                    </div>

                    {users.map((user) => (
                      <div className="form-check" key={user.id || user.name}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`member-${user.id || user.name}`}
                          checked={selectedNames.includes(user.name)}
                          onChange={() => handleNameToggle(user.name)}
                        />

                        <label
                          className="form-check-label"
                          htmlFor={`member-${user.id || user.name}`}
                        >
                          {user.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="col-md-4 position-relative">
              <label className="form-label">Roles</label>

              <button
                type="button"
                className="form-select text-start"
                onClick={() => setRoleDropdownOpen((open) => !open)}
              >
                {selectedRoles.length === 0
                  ? "Select roles"
                  : `${selectedRoles.length} role(s) selected`}
              </button>
              {roleDropdownOpen && (
                <div
                  className="card position-absolute w-100 shadow-sm mt-1"
                  style={{
                    zIndex: 1000,
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  <div className="card-body p-2">
                    <div className="d-flex gap-2 mb-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleSelectAllRoles}
                      >
                        Select all
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={handleClearRolesSelection}
                      >
                        Clear
                      </button>
                    </div>

                    {roles.map((role) => (
                      <div className="form-check" key={role}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`role-${role}`}
                          checked={selectedRoles.includes(role)}
                          onChange={() => handleRoleToggle(role)}
                        />

                        <label
                          className="form-check-label"
                          htmlFor={`role-${role}`}
                        >
                          {role}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="col-md-2 d-flex align-items-end">
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={isRunning}
              >
                {isRunning ? "Running..." : "Run Report"}
              </button>
            </div>
          </form>
        </div>

        {reportRows.length > 0 && (
          <div className="mb-3 d-flex justify-content-between align-items-center">
            <h3 className="mb-0">Found {reportCount} role record(s)</h3>

            <button
              type="button"
              className="btn btn-success"
              onClick={exportExcel}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export to Excel"}
            </button>
          </div>
        )}

        {reportRows.length > 0 && (
          <div className="card p-4">
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Name</th>
                    <th>Event Number</th>
                    <th>Operational</th>
                    <th>Activity</th>
                    <th>Roles</th>
                  </tr>
                </thead>

                <tbody>
                  {reportRows.map((row, index) => (
                    <tr key={`${row.eventNumber}-${row.name}-${index}`}>
                      <td>{row.timestampLocal}</td>
                      <td>{row.name}</td>
                      <td>{row.eventNumber}</td>
                      <td>{row.operational}</td>
                      <td>{row.activity}</td>
                      <td>
                        {Array.isArray(row.roles) && row.roles.length > 0
                          ? row.roles.join(", ")
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}