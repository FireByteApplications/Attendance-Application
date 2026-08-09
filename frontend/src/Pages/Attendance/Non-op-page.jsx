import { useNavigate } from "react-router-dom";
import { useTitle } from '../../hooks/useTitle.jsx';
import {useState, useEffect } from "react";
import {useCsrfToken, csrfFetch} from "../../Components/csrfHelper.jsx"

const activities = [
  "Meeting",
  "Community-Engagement",
  "Other-Non-operational"
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
  const [otherType, setOtherType] = useState("")
  const [selectedActivity, setSelectedActivity] = useState(sessionStorage.getItem("activity") || "");
  const [date, setDate] = useState("");
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setSubmitMessage("No usernames selected. Please log in again.");;
      sessionStorage.clear();
      navigate("/attendance");
      return;
    }
    

    const activitySelection = 'Non-Operational'
    try {
      setIsSubmitting(true)
      setSubmitMessage(null)
      setSubmitStatus(null)
      let finalresponse;   
      const data = {
        name: formattedNames[0],
        names: formattedNames,
        operational: activitySelection,
        activity,
        epochTimestamp: dateObj.getTime(),
        ...(activity === "Other-Non-operational" && { otherType }),
      };
        const response = await csrfFetch(apiurl, "/api/attendance/submit", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
        if (!response.ok){
          throw new Error("Insert Failed")
        }
        finalresponse = response
      const result = await finalresponse.json();

      const message = encodeURIComponent(result.message || "Attendance logged successfully!");
      const type = encodeURIComponent("success");
      navigate(`/attendance?popupMessage=${message}&popupType=${type}`); 
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitStatus("Error");
      setSubmitMessage(err);
      sessionStorage.clear();
      navigate("/attendance");
      }
  };
  const selectedNames = getSelectedAttendanceNames();

  useEffect(() => {
    if (!submitMessage) return;

    const timerId = window.setTimeout(() => {
      setSubmitMessage(null);
      setSubmitStatus(null);
    }, 5000);

    return () => window.clearTimeout(timerId);
  }, [submitMessage, submitStatus]);

  useTitle('Non Operational Attendance');
  return (
    
    <div className="w-100 py-4" style={pageShellStyle}>     
      <div className="container py-4">
        <h1 className="text-center mb-4 display-6 border border-2 rounded-3 p-3 bg-danger text-black fw-semibold shadow-sm mx-auto">Select Non Operational Activity</h1>
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
        {selectedActivity === "Other-Non-operational" && (
          <div className="text-center border border-2 rounded-3 bg-secondary bg-opacity-80 text-dark fw-semibold shadow-sm mx-auto p-3"
          style={{
              maxWidth: "400px",
              marginBottom: "1rem"
            }}>
            <label className="form-label fw-bold d-block">Other Non-Operational Activity:</label>
            <input className="form-control mx-auto" placeholder="Eg Administration"
                  value={otherType}
                  onChange={(e) => setOtherType(e.target.value)} />
          </div>
        )}


        <div className="text-center border border-2 rounded-3 bg-secondary bg-opacity-80 text-black fw-semibold shadow-sm mx-auto p-3"
            style={{
              maxWidth: "400px",
              width: "100%",
              marginBottom: "1rem"
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
        {selectedNames.length > 0 && (
          <div className="mx-auto text-center bg-secondary bg-opacity-80 text-black my-3 px-3 py-3 border border-2 border-white rounded-3" style={{ maxWidth: "420px" }}>
            <div className="fw-semibold">Submitting attendance for:</div>

            <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
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
