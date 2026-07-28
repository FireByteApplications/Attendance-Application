import { useState, useEffect } from "react";
import { useTitle } from "../../hooks/useTitle.jsx";
import { useCsrfToken } from "../../Components/csrfHelper.jsx";
import { validateIncidentCreationForm } from "../../Utils/formValidation.js";

const apiurl = import.meta.env.VITE_API_BASE_URL;

export default function CreateIncidentsPage() {
  useTitle("Event Mangement");

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
  const [eventsArray, setEventsArray] = useState([])

  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingEventNumber, setDeletingEventNumber] = useState("")
  const [showDeletePinModal, setShowDeletePinModal] = useState(false);

  const pageShellStyle = {
    minHeight: "100vh",
    width: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    paddingBottom: "2rem",
  };
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
      listIncidents();
      listEvents();
  }, []);

  useEffect(() => {
    if (!submitMessage) return;

    const timerId = window.setTimeout(() => {
      setSubmitMessage(null);
      setSubmitStatus(null);
    }, 5000);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    return () => window.clearTimeout(timerId);
  }, [submitMessage]);

  const showMessage = (status, message) => {
    setSubmitStatus(status);
    setSubmitMessage(message);
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

  const listEvents = async () => {
    try {
      const response = await fetch(`${apiurl}/api/attendance/listEvents`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
        },
      });

      const result = await response.json();

      if(!response.ok) {
        showMessage(
          "error",
          result.message || "An error occured fetching non incident events"
        )
        return;
      }
      setEventsArray(Array.isArray(result) ? result : []);
      } catch (err) {
      console.error("Error fetching non incident events", err)
      showMessage(
        "error",
        "An error occured fetching non incident events"
      )
    }
  }

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

  const handleDelete = async (eventNumberToDelete = deletingEventNumber) => {
    if (!eventNumberToDelete) {
      showMessage("error", "No item selected for deletion.");
      return;
    }

    setIsDeleting(true);
    setSubmitMessage(null);
    setSubmitStatus(null);

    try {
      const response = await fetch(
        `${apiurl}/api/attendance/deleteIncident/${eventNumberToDelete}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showMessage("error", "Deletion error: " + result.message);
        return;
      }

      const message = eventNumberToDelete.startsWith("EVT-")
        ? "Successfully deleted Event"
        : "Successfully deleted Incident";

      showMessage("success", message);

      await listIncidents();
      await listEvents();
    } catch (error) {
      console.error("An error has occurred", error);
      showMessage("error", "An error has occurred. Please try again later.");
    } finally {
      setIsDeleting(false);
      setDeletingEventNumber("");
    }
  };

  const handleDeleteWithPin = async (e) => {
    e.preventDefault();

    if (!deletingEventNumber) {
      showMessage("error", "No item selected for deletion.");
      return;
    }

    if (unlocked) {
      await handleDelete(deletingEventNumber);
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      showMessage("error", "PIN must be exactly 4 digits.");
      return;
    }

    setIsDeleting(true);

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
        showMessage("error", "Error validating PIN: " + result.message);
        return;
      }

      setUnlocked(true);
      await handleDelete(deletingEventNumber);
    } catch (error) {
      console.error("Failed to validate pin: ", error);
      showMessage("error", "Failed to validate PIN.");
    } finally {
      setShowDeletePinModal(false);
      setPin("");
      setIsDeleting(false);
    }
  };
  
    return (
      <div style={pageShellStyle}>
        {submitMessage && (
          <div
            className={`alert ${
              submitStatus === "success" ? "alert-success" : "alert-danger"
            } mx-5 mt-3`}
            role="alert"
          >
            {submitMessage}
          </div>
        )}
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
                  required
                />
              </div>

              <div className="mb-3 mt-5 text-center">
                <label htmlFor="activIdInput" className="form-label">
                  <span style={{ fontSize: "25px" }}>Activ Incident ID:</span>
                </label>

                <input
                  id="activIdInput"
                  type="text"
                  className="form-control"
                  placeholder="26-12345678"
                  value={activId}
                  onChange={(e) => setActivId(e.target.value)}
                  required
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
                  placeholder="Type of incident - Location - Date 
Example: AFA - Kiama - 01 July 26"
                  style={{ height: "100px", resize: "none" }}
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                  required
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
                  id="EventTbl"
                  className="table table-striped table-hover align-middle mb-0"
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event ID</th>
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
                          <td className="text-end">
                            <button 
                            type="button" 
                            className="btn btn-danger"
                            onClick={() => {
                              setDeletingEventNumber(incident.eventNumber);
                              setPin("");

                              if (unlocked) {
                                handleDelete(incident.eventNumber);
                              } else {
                                setShowDeletePinModal(true);
                              }
                            }}
                            disabled={isDeleting}>
                              {isDeleting && deletingEventNumber === incident.eventNumber ? "Deleting..." : "Delete" }</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {showDeletePinModal && (
                <>
                  <div
                    className="modal show d-block"
                    tabIndex="-1"
                    role="dialog"
                  >
                    <div className="modal-dialog modal-dialog-centered">
                      <div className="modal-content">
                        <form onSubmit={handleDeleteWithPin}>
                          <div className="modal-header">
                            <h5 className="modal-title">Confirm Delete</h5>

                            <button
                              type="button"
                              className="btn-close"
                              onClick={() => setShowDeletePinModal(false)}
                              disabled={isDeleting}
                            ></button>
                          </div>

                          <div className="modal-body">
                            <p className="mb-3">
                              Enter the delete PIN to confirm this action.
                            </p>

                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength="4"
                              className="form-control"
                              placeholder="Enter PIN"
                              value={pin}
                              onChange={(e) => {
                                const digitsOnly = e.target.value.replace(/\D/g, "");
                                setPin(digitsOnly.slice(0, 4));
                              }}
                              autoComplete="off"
                              required
                            />
                          </div>

                          <div className="modal-footer">
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => setShowDeletePinModal(false)}
                              disabled={isDeleting}
                            >
                              Cancel
                            </button>

                            <button
                              type="submit"
                              className="btn btn-danger"
                              disabled={isDeleting || pin.length !== 4}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>

                  <div className="modal-backdrop show"></div>
                </>
              )}
            </div>
            <div className="card-body p-4">
                <h4 className="card-title mb-4 text-center">Non incident events</h4>
                <div className="table-responsive">
                  <table
                    id="incidentTbl"
                    className="table table-striped table-hover align-middle mb-0"
                  >
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Event ID</th>
                        <th>Description</th>
                      </tr>
                    </thead>

                    <tbody>
                      {eventsArray.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="text-center text-muted">
                            No non incident events found.
                          </td>
                        </tr>
                      ) : (
                        eventsArray.map((event) => (
                          <tr key={event.eventNumber}>
                            <td>{event.eventDate}</td>
                            <td>{event.eventNumber}</td>
                            <td>{event.description}</td>
                            <td className="text-end">
                              <button 
                              type="button" 
                              className="btn btn-danger"
                              onClick={() => {
                                setDeletingEventNumber(event.eventNumber);
                                setPin("");

                                if (unlocked) {
                                  handleDelete(event.eventNumber);
                                } else {
                                  setShowDeletePinModal(true);
                                }
                              }}
                              disabled={isDeleting}>
                                {isDeleting && deletingEventNumber === event.eventNumber ? "Deleting..." : "Delete" }</button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        </div>
      )}