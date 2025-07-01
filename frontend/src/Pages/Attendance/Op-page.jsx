import {useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../styles/Attendance.module.css";
import { Helmet } from 'react-helmet-async';
import {useCsrfToken} from "../../Components/csrfHelper.jsx"

const activities = [
  "Incident-Call",
  "Strike-Team",
  "Deployment",
  "Hazard-Reduction",
  "Pile-Burn",
  "Other-operational",
];
const apiurl = import.meta.env.VITE_API_BASE_URL;

export default function OperationalPage() {
  const csrfToken = useCsrfToken(apiurl);
    useEffect(() => {
        if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
      }, [csrfToken]);
  const [selectedActivity, setSelectedActivity] = useState(sessionStorage.getItem("activity") || "");
  const [date, setDate] = useState("");
  const [deploymentType, setDeploymentType] = useState("");
  const [deploymentLocation, setDeploymentLocation] = useState("");
  const navigate = useNavigate();

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
      alert("Please select an option before submitting");
      return;
    }

    const dateObj = date ? new Date(date) : new Date();
    if (date) dateObj.setHours(0, 0, 0, 0);

    let username = sessionStorage.getItem("username") || "";
    username = username.replace(/\./g, " ");

    const activitySelection = 'Operational'

    const data = {
      name: username,
      operational: activitySelection,
      activity,
      epochTimestamp: dateObj.getTime(),
     ...(activity === "Deployment" && {
      deploymentType,
      deploymentLocation
    })
  };
    console.log(data)

    try {
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
        alert(result.message || "An error occurred, please try again later.");
        sessionStorage.clear();
        navigate("/attendance/");
        return;
      }

      const message = encodeURIComponent("Attendance logged successfully!");
      const type = encodeURIComponent("success");
      navigate(`/attendance?popupMessage=${message}&popupType=${type}`);
    } catch (err) {
      console.error("Submission error:", err);
      alert("An error has occurred, please try again later.");
      sessionStorage.clear();
      navigate("/attendance");
    }
  };

  return (
    <div className={styles.attendanceBg}>
      <Helmet>
        <title>Operational Attendance</title>
      </Helmet>  
      <div className="container py-4">
        <h1 className='text-center mb-4 display-6 border border-2 rounded-3 p-3 bg-danger text-black fw-semibold shadow-sm'>Select Operational Activity</h1>
        <div className="d-flex flex-wrap justify-content-center gap-2 my-4">
          {activities.map((activity) => (
            <button
              key={activity}
              type="button"
              className={`btn ${selectedActivity === activity ? "btn-dark" : "btn-secondary"}`}
              onClick={() => handleSelect(activity)}
            >
              {activity.replace("-", " ")}
            </button>
          ))}
        </div>
          {selectedActivity === "Deployment" && (
        <div className="text-center border border-2 rounded-3 bg-secondary text-black fw-semibold shadow-sm mx-auto"
            style={{
              fontSize: "1rem",
              padding: "0.25rem 0.75rem",
              maxWidth: "400px",       // ✅ limit total width
              width: "100%",
              marginBottom: "1rem"           // ✅ ensure it shrinks on smaller screens
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
        <div className="text-center border border-2 rounded-3 bg-secondary text-black fw-semibold shadow-sm mx-auto"
            style={{
              fontSize: "1rem",
              padding: "0.25rem 0.75rem",
              maxWidth: "400px",       // ✅ limit total width
              width: "100%",
              marginBottom: "1rem"           // ✅ ensure it shrinks on smaller screens
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

        <div className="text-center">
          <button onClick={handleSubmit} className="btn btn-danger">
            Submit
          </button>
        </div>
      </div>
  </div>
  );
}
