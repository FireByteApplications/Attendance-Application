import { useState, useEffect } from "react";
import { useTitle } from "../../hooks/useTitle";
import { useCsrfToken } from "../../Components/csrfHelper.jsx";
import { validateIncidentCreationForm } from "../../Utils/formValidation.js";

const apiurl = import.meta.env.VITE_API_BASE_URL;

export default function CreateIncidentsPage() {
  useTitle("Incident Creation");

  const csrfToken = useCsrfToken(apiurl);

  const [incDate, setIncDate] = useState("");
  const [activId, setActivId] = useState("");
  const [incDesc, setIncDesc] = useState("");

  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentsArray, setIncidentsArray] = useState([]);

  useEffect(() => {
    if (csrfToken) {
      sessionStorage.setItem("csrf", csrfToken);
    }
  }, [csrfToken]);

  useEffect(() => {
    const checkPinStatus = async () => {
      try {
        const response = await fetch(
          `${apiurl}/api/attendance/roleAssignment/status`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const result = await response.json();

        if (response.ok && result.unlocked) {
          setUnlocked(true);
        }
      } catch (error) {
        console.error("Failed to check PIN status:", error);
      } finally {
        setLoadingStatus(false);
      }
    };

    checkPinStatus();
  }, []);

  useEffect(() => {
    if (unlocked) {
      listIncidents();
    }
  }, [unlocked]);

  const showMessage = (status, message) => {
    setSubmitStatus(status);
    setSubmitMessage(message);
  };

  const handleUnlock = async (e) => {
    e.preventDefault();

    setSubmitMessage(null);
    setSubmitStatus(null);

    if (!/^\d{4}$/.test(pin)) {
      showMessage("error", "PIN must be exactly 4 digits.");
      return;
    }

    try {
      const response = await fetch(
        `${apiurl}/api/attendance/roleAssignment/unlock`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
          },
          body: JSON.stringify({ pin }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showMessage("error", result.message || "Invalid PIN.");
        return;
      }

      setUnlocked(true);
      setPin("");
      showMessage("success", "Incident creation unlocked.");
    } catch (error) {
      console.error("Failed to unlock incident creation:", error);
      showMessage("error", "Failed to unlock incident creation.");
    }
  };

  const listIncidents = async () => {
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
        showMessage(
          "error",
          result.message || "An error occurred fetching incidents."
        );
        return;
      }

      setIncidentsArray(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("Error fetching incidents:", err);
      showMessage("error", "An error occurred fetching incidents.");
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitMessage(null);
    setSubmitStatus(null);

    const validationData = {
      Date: incDate,
      ActivID: activId,
      IncidentDescription: incDesc,
    };

    if (!incDate || !activId.trim()) {
      showMessage("error", "Please fill in the date and incident ID.");
      setIsSubmitting(false);
      return;
    }

    const validated = validateIncidentCreationForm(validationData);

    if (validated.length !== 0) {
      showMessage("error", validated);
      setIsSubmitting(false);
      return;
    }

    const payload = {
      date: incDate,
      activID: activId,
      incidentDescription: incDesc,
    };

    try {
      const response = await fetch(`${apiurl}/api/attendance/createIncident`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(
          "error",
          result.message || "An error occurred, please try again later."
        );
        return;
      }

      showMessage("success", result.message || "Incident created successfully.");

      setIncDate("");
      setActivId("");
      setIncDesc("");

      await listIncidents();
    } catch (err) {
      console.error("Submission error:", err);
      showMessage("error", "An error has occurred, please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="container mt-5">
        <p>Loading incident creation page...</p>
      </div>
    );
  }

  return (
    <div
      className="container justify-content-center my-4"
      style={{ minHeight: "100vh" }}
    >
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

      {!unlocked ? (
        <div className="card shadow-sm m-5 d-flex" style={{ width: "90%" }}>
          <div className="card-body pt-4 px-4">
            <h4 className="card-title mb-4 text-center">
              Enter Incident Creation PIN
            </h4>

            <form onSubmit={handleUnlock}>
              <div className="mb-3 text-center">
                <label htmlFor="incidentPinInput" className="form-label">
                  <span style={{ fontSize: "25px" }}>PIN:</span>
                </label>

                <input
                  id="incidentPinInput"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="4"
                  className="form-control text-center"
                  value={pin}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "");
                    setPin(digitsOnly.slice(0, 4));
                  }}
                  autoComplete="off"
                />
              </div>

              <div className="text-center">
                <button type="submit" className="btn btn-secondary">
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="card shadow-sm m-5 d-flex" style={{ width: "90%" }}>
            <div className="card-body pt-4 px-4">
              <h4 className="card-title mb-4 text-center">Create Incident</h4>

              <div className="mb-3 mt-3 text-center">
                <label htmlFor="incidentDateInput" className="form-label">
                  <span style={{ fontSize: "25px" }}>Date:</span>
                </label>

                <input
                  id="incidentDateInput"
                  type="date"
                  className="form-control"
                  value={incDate}
                  onChange={(e) => setIncDate(e.target.value)}
                />
              </div>

              <div className="mb-3 mt-5 text-center">
                <label htmlFor="activIdInput" className="form-label">
                  <span style={{ fontSize: "25px" }}>Activ ID:</span>
                </label>

                <input
                  id="activIdInput"
                  type="text"
                  className="form-control"
                  placeholder="Activ Incident ID"
                  value={activId}
                  onChange={(e) => setActivId(e.target.value)}
                />
              </div>

              <div className="mt-5 mb-3 text-center">
                <label htmlFor="descriptionInput" className="form-label">
                  <span style={{ fontSize: "25px" }}>Description:</span>
                </label>

                <textarea
                  id="descriptionInput"
                  className="form-control text-start"
                  rows="3"
                  placeholder="Optional note. Stored event description can still be generated from the date on the backend."
                  style={{ height: "100px", resize: "none" }}
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                />
              </div>

              <div className="text-center">
                <button
                  className="btn btn-secondary"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>

          <div className="card shadow-sm m-5 d-flex" style={{ width: "90%" }}>
            <div className="card-body p-4">
              <h4 className="card-title mb-4 text-center">Incidents</h4>

              <div className="table-responsive">
                <table
                  id="incidentTbl"
                  className="table table-striped table-hover align-middle mb-0"
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Incident ID</th>
                      <th>Description</th>
                    </tr>
                  </thead>

                  <tbody>
                    {incidentsArray.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No incidents found.
                        </td>
                      </tr>
                    ) : (
                      incidentsArray.map((incident) => (
                        <tr key={incident.eventNumber}>
                          <td>{incident.eventDate}</td>
                          <td>{incident.eventNumber}</td>
                          <td>{incident.description}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}