import {useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { useTitle } from '../../hooks/useTitle.jsx';
import {useCsrfToken} from "../../Components/csrfHelper.jsx"
import { validateOperationalAttendanceData } from "../../Utils/formValidation.js";

const activities = [
  "Incident-Call",
  "Strike-Team",
  "Deployment",
  "Hazard-Reduction",
  "Pile-Burn",
  "Training",
  "Maintenance",
  "BA-Checks",
  "Chainsaw-Checks",
  "Other-operational",
];

const apiurl = import.meta.env.VITE_API_BASE_URL;

const pageShellStyle = {
  backgroundImage: 'url("/assets/background.jpg")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  minHeight: "100vh",
  width: "100%",
};

export default function OperationalPage() {
  const csrfToken = useCsrfToken(apiurl);
    useEffect(() => {
        if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
      }, [csrfToken]);
  const [selectedActivity, setSelectedActivity] = useState(sessionStorage.getItem("activity") || "");
  const [baType, setBaType] = useState("");
  const [chainsawType, setChainsawType] = useState("");
  const [date, setDate] = useState("");
  const [deploymentType, setDeploymentType] = useState("");
  const [deploymentLocation, setDeploymentLocation] = useState("");
  const [otherType, setOtherType] = useState("")
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidents, setIncidents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState("")
  const [incidentDropdownOpen, setIncidentDropdownOpen] = useState(false);

  const selectedIncident = incidents.find(
  (incident) => incident.eventNumber === selectedEvent
  );

  const selectedIncidentLabel = selectedIncident
    ? `${selectedIncident.eventNumber} - ${selectedIncident.description}`
    : "Select Incident for attendance";
  const navigate = useNavigate();


  const fetchIncidents = async () => {
    try {
      const response = await fetch(`${apiurl}/api/attendance/listIncidents`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
        },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(result.message || "Failed to fetch Incidents");
        return;
      }

      setIncidents(result);
    } catch (error) {
      console.error("Error fetching Incidents:", error);
    }
  };

  const handleSelect = (activity) => {
    const newValue = selectedActivity === activity ? "" : activity;
    setSelectedActivity(newValue);
    if (newValue) {
      sessionStorage.setItem("activity", newValue);
    } else {
      sessionStorage.removeItem("activity");
    }
  };

  const handleSubmit = async () => {
    const activity = sessionStorage.getItem("activity");
    if (!activity) {
      setSubmitStatus("error");
      setSubmitMessage("Please select an option before submitting");
      return;
    }

    const dateObj = date ? new Date(date) : new Date();
    if (date) dateObj.setHours(0, 0, 0, 0);

    const formattedNames = getSelectedAttendanceNames();

    if (formattedNames.length === 0) {
      setSubmitStatus("error");
      setSubmitMessage("No usernames selected. Please log in again.");
      sessionStorage.clear();
      navigate("/attendance");
      return;
    }

    const activitySelection = 'Operational'

    const data = {
      name: formattedNames[0], // keeps existing validation compatible
      names: formattedNames,  // new multi-name submit
      operational: activitySelection,
      activity,
      eventNumber: selectedEvent,
      epochTimestamp: dateObj.getTime(),
      ...(activity === "Deployment" && {
        deploymentType,
        deploymentLocation,
      }),
      ...(activity === "BA-Checks" && { baType }),
      ...(activity === "Chainsaw-Checks" && { chainsawType }),
      ...(activity === "Other-operational" && { otherType }),
    };
    const errors = validateOperationalAttendanceData(data)
    if(errors.length !== 0) {
      setSubmitStatus("Error");
      setSubmitMessage(errors);
      return
    }

    try {
      setIsSubmitting(true)
      setSubmitMessage(null)
      setSubmitStatus(null)
      const response = await fetch(`${apiurl}/api/attendance/submit`, {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf")
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitStatus("Error")
        setSubmitMessage(result.message || "An error has occured please try again later")
        return;
      }
      
      const message = encodeURIComponent(result.message || "Attendance logged successfully!");
      const type = encodeURIComponent("success");

      sessionStorage.removeItem("activity");

      navigate(`/attendance?popupMessage=${message}&popupType=${type}`);
    
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitStatus("error")
      setSubmitMessage("An error has occured please try again later")
    } finally {
      setIsSubmitting(false);
    }
  };

    function capitaliseName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

  function getSelectedAttendanceNames() {
    const storedUsernames = JSON.parse(
      sessionStorage.getItem("usernames") || "[]"
    );

    const usernames = Array.isArray(storedUsernames)
      ? storedUsernames
      : [];

    if (usernames.length === 0) {
      const fallbackUsername = sessionStorage.getItem("username") || "";

      if (!fallbackUsername) {
        return [];
      }

      return [
        capitaliseName(fallbackUsername.replace(/\./g, " "))
      ];
    }

    return usernames.map((username) =>
      capitaliseName(String(username).replace(/\./g, " "))
    );
  }

  const selectedNames = getSelectedAttendanceNames();

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (!submitMessage) return;

    const timerId = window.setTimeout(() => {
      setSubmitMessage(null);
      setSubmitStatus(null);
    }, 5000);

    return () => window.clearTimeout(timerId);
  }, [submitMessage, submitStatus]);

  useTitle('Operational Attendance');

  return (
    <div className="w-100 py-4" style={pageShellStyle}>
      <div className="container py-4">
        {submitMessage && (
          <div
            className={`alert ${
              submitStatus === "success" ? "alert-success" : "alert-danger"
            } fade show position-fixed top-0 start-50 translate-middle-x mt-3`}
            role="alert"
            style={{ maxWidth: "600px", width: "90%", zIndex: 2000 }}
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

        <h1 className="text-center mb-4 display-6 border border-2 rounded-3 p-3 bg-danger text-black fw-semibold shadow-sm mx-auto">Select Operational Activity</h1>
        <div className="d-flex flex-wrap justify-content-center gap-2 my-4">
          {activities.map((activity) => (
            <button
              key={activity}
              type="button"
              className={`btn ${selectedActivity === activity ? "btn-warning" : "btn-secondary"}`}
              onClick={() => handleSelect(activity)}
            >
              {activity.replace("-", " ")}
            </button>
          ))}
        </div>
        {selectedActivity === "Deployment" && (
        <div className="text-center border border-2 rounded-3 bg-secondary bg-opacity-80 text-dark fw-semibold shadow-sm mx-auto p-3"
            style={{
              maxWidth: "400px",
              width: "100%",
              marginBottom: "1rem"
            }}>
          <label className="form-label fw-bold d-block">Deployment Type:</label>
          <select
            className="form-select w-50 mx-auto mb-3"
            value={deploymentType}
            onChange={(e) => setDeploymentType(e.target.value)}
          >
            <option value="">Select Type</option>
            <option value="Bushfire">Bushfire</option>
            <option value="Flood">Flood</option>
          </select>

          <label className="form-label fw-bold d-block">Deployment Location:</label>
          <select
            className="form-select w-50 mx-auto"
            value={deploymentLocation}
            onChange={(e) => setDeploymentLocation(e.target.value)}
          >
            <option value="">Select Location</option>
            <option value="Local">Local</option>
            <option value="Out of area">Out of area</option>
          </select>
        </div>
        )}
        {selectedActivity === "BA-Checks" && (
          <div className="text-center border border-2 rounded-3 bg-secondary bg-opacity-80 text-dark fw-semibold shadow-sm mx-auto p-3"
          style={{
              maxWidth: "400px",
              width: "100%",
              marginBottom: "1rem"
            }}>
            <label className="form-label fw-bold d-block">Select BA Type:</label>
            <select
              className="form-select w-50 mx-auto"
              value={baType}
              onChange={(e) => setBaType(e.target.value)}
            >
              <option value="">Select Option</option>
              <option value="Cat 1">Cat 1</option>
              <option value="Pumper">Pumper</option>
              <option value="All Vehicles">All Vehicles</option>
            </select>
          </div>
        )}
        {selectedActivity === "Chainsaw-Checks" && (
          <div className="text-center border border-2 rounded-3 bg-secondary bg-opacity-80 text-dark fw-semibold shadow-sm mx-auto p-3"
          style={{
              maxWidth: "400px",
              width: "100%",
              marginBottom: "1rem"
            }}>
            <label className="form-label fw-bold d-block">Select Chainsaw Type:</label>
            <select
              className="form-select w-50 mx-auto"
              value={chainsawType}
              onChange={(e) => setChainsawType(e.target.value)}
            >
              <option value="">Select Option</option>
              <option value="Cat 1">Cat 1</option>
              <option value="Pumper">Pumper</option>
              <option value="Cat 9">Cat 9</option>
              <option value="All Vehicles">All Vehicles</option>
            </select>
          </div>
        )}
        {selectedActivity === "Other-operational" && (
          <div className="text-center border border-2 rounded-3 bg-secondary bg-opacity-80 text-dark fw-semibold shadow-sm mx-auto p-3"
          style={{
              maxWidth: "400px",
              width: "100%",
              marginBottom: "1rem"
            }}>
            <label className="form-label fw-bold d-block">Other Operational Activity:</label>
            <input className="form-control mx-auto" placeholder="Eg Permits"
                  value={otherType}
                  onChange={(e) => setOtherType(e.target.value)}>
            </input>
          </div>
        )}
        {selectedActivity !== "" && selectedActivity == 'Incident-Call' && (
          <div className="d-flex dropdown justify-content-center">
           <div className="dropdown">
              <button
                className="btn btn-secondary dropdown-toggle my-2"
                type="button"
                onClick={() => setIncidentDropdownOpen((current) => !current)}
                aria-expanded={incidentDropdownOpen}
              >
                {selectedIncidentLabel}
              </button>

              <ul className={`dropdown-menu p-3 ${incidentDropdownOpen ? "show" : ""}`}>
                {incidents.map((incident) => {
                  const incidentLabel = `${incident.eventNumber} - ${incident.description}`;

                  return (
                    <li key={incident.eventNumber}>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="selectedIncident"
                          id={`Incident-${incident.eventNumber}`}
                          checked={selectedEvent === incident.eventNumber}
                          onChange={() => {
                            setSelectedEvent(incident.eventNumber);
                            setIncidentDropdownOpen(false);
                          }}
                          required
                        />

                        <label
                          className="form-check-label"
                          htmlFor={`Incident-${incident.eventNumber}`}
                        >
                          {incidentLabel}
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
        <div className="text-center border border-2 rounded-3 bg-secondary bg-opacity-80 text-black fw-semibold shadow-sm mx-auto p-3"
            style={{
              maxWidth: "400px",
              width: "100%",
              marginBottom: "1rem"
            }}
        >
          <label htmlFor="inputDate" className="form-label">Backdate (optional):</label>
          <input
            type="date"
            id="inputDate"
            className="form-control w-auto d-inline-block ms-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {selectedNames.length > 0 && (
            <div className="mx-auto text-center bg-secondary bg-opacity-80 text-white my-3 px-3 py-3 border border-2 border-white rounded-3" style={{ maxWidth: "420px" }}>
              <div className="fw-semibold pb-2">Submitting attendance for:</div>

              <div className="d-flex flex-wrap justify-content-center gap-2 mt-2 mb-2">
                {selectedNames.map((name) => (
                  <span key={name} className="badge text-bg-light border">
                    {name}
                  </span>
                ))}
              </div>
            </div>
        )}
        <div className="text-center">
          <button 
            onClick={handleSubmit} 
            className="btn btn-danger"
            disabled={isSubmitting}  
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
  </div>
  );
}
