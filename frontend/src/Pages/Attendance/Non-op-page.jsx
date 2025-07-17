import { useNavigate } from "react-router-dom";
import styles from "../../styles/Attendance.module.css";
import { Helmet } from 'react-helmet-async';
import {useState, useEffect } from "react";
import {useCsrfToken} from "../../Components/csrfHelper.jsx"
//selection of activites for non operational
const activities = [
  "Training",
  "Meeting",
  "Maintenance",
  "Community-Engagement",
  "BA-Checks",
  "Chainsaw-Checks",
  "Other-Non-operational"
];
const apiurl = import.meta.env.VITE_API_BASE_URL;

export default function OperationalPage() {
  const csrfToken = useCsrfToken(apiurl);
  useEffect(() => {
      if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
    }, [csrfToken]);
  const [baType, setBaType] = useState("");
  const [chainsawType, setChainsawType] = useState("");
  const [otherType, setOtherType] = useState("")
  const [selectedActivity, setSelectedActivity] = useState(sessionStorage.getItem("activity") || "");
  const [date, setDate] = useState("");
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
  // submit handler
  const handleSubmit = async () => {
    const activity = sessionStorage.getItem("activity");
    if (!activity) {
      alert("Please select an option before submitting");
      return;
    }
    //set date
    const dateObj = date ? new Date(date) : new Date();
    if (date) dateObj.setHours(0, 0, 0, 0);

    let username = sessionStorage.getItem("username") || "";
    username = username.replace(/\./g, " ");

    const activitySelection = 'Non-Operational'

    const data = {
      name: username,
      operational: activitySelection,
      activity,
      epochTimestamp: dateObj.getTime(),
      //optional extras for certain activities
    ...(activity === "BA-Checks" && { baType }),
    ...(activity === "Chainsaw-Checks" && { chainsawType }),
    ...(activity === "Other-Non-operational" && { otherType })
  };

    try {
      const response = await fetch(`${apiurl}/api/attendance/submit`, {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
        },
        body: JSON.stringify(data),
      });
      console.log(data)

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
        <title>Non Operational Attendance</title>
      </Helmet>        
      <div className="container py-4">
        <h1 className='text-center mb-4 display-6 border border-2 rounded-3 p-3 bg-danger text-gray-600 fw-semibold shadow-sm'>Select Non Operational Activity</h1>
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
          {selectedActivity === "BA-Checks" && (
          <div className="text-center border border-2 rounded-3 bg-secondary text-black fw-semibold shadow-sm mx-auto"
          style={{
              fontSize: "1rem",
              padding: "0.25rem 0.75rem",
              maxWidth: "400px",       // ✅ limit total width
              width: "100%",
              marginBottom: "1rem"           // ✅ ensure it shrinks on smaller screens
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
            </select>
          </div>
        )}
        {selectedActivity === "Chainsaw-Checks" && (
          <div className="text-center border border-2 rounded-3 bg-secondary text-black fw-semibold shadow-sm mx-auto"
          style={{
              fontSize: "1rem",
              padding: "0.25rem 0.75rem",
              maxWidth: "400px",       // ✅ limit total width
              width: "100%",
              marginBottom: "1rem"           // ✅ ensure it shrinks on smaller screens
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
              <option value="Pumper">Cat 9</option>
            </select>
          </div>
        )}
        {selectedActivity === "Other-Non-operational" && (
          <div className="text-center border border-2 rounded-3 bg-secondary text-black fw-semibold shadow-sm mx-auto"
          style={{
              fontSize: "1rem",
              padding: "0.25rem 0.75rem",
              maxWidth: "400px",       // ✅ limit total width
              width: "100%",
              marginBottom: "1rem"           // ✅ ensure it shrinks on smaller screens
            }}>
            <label className="form-label fw-bold d-block">Other Non-Operational Activity:</label>
            <input placeholder="Eg Administration"
                  value={otherType}
                  onChange={(e) => setOtherType(e.target.value)}>
            </input>
          </div>
        )}
        <div className="text-center border border-2 rounded-3 bg-secondary text-black fw-semibold shadow-sm mx-auto"
            style={{
              fontSize: "1rem",
              padding: "0.25rem 0.75rem",
              maxWidth: "400px",       // ✅ limit total width
              width: "100%",
              marginBottom: "1rem"           // ✅ ensure it shrinks on smaller screens
            }}>
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
