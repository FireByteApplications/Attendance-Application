import { useEffect, useState } from "react";
import { useTitle } from "../../hooks/useTitle.jsx";
import { useCsrfToken } from "../../Components/csrfHelper.jsx";

const apiurl = import.meta.env.VITE_API_BASE_URL;

const skills = {
  "Crew Leader": [
    "Incident-Call",
    "Pile-Burn",
    "Hazard-Reduction",
    "Deployment",
    "Strike-Team",
    "Training",
    "Other-operational",
    "Community-Engagement"
  ],
  "Pump operator": [
    "Incident-Call",
    "Pile-Burn",
    "Hazard-Reduction",
    "Deployment",
    "Strike-Team",
    "Training",
    "Other-operational",
    "Community-Engagement"
  ],
  Driver: [
    "Incident-Call",
    "Pile-Burn",
    "Hazard-Reduction",
    "Deployment",
    "Strike-Team",
    "Training",
    "Other-operational",
    "Community-Engagement"
  ],
  "Hose Operator": [
    "Incident-Call",
    "Pile-Burn",
    "Hazard-Reduction",
    "Deployment",
    "Strike-Team",
    "Training",
    "Other-operational",
    "Community-Engagement"
  ],
  "BA Operator": [
    "Incident-Call",
    "Deployment",
    "Strike-Team",
    "Training",
    "Other-operational",
    "Community-Engagement"
  ],
  "Traffic management": [
    "Incident-Call",
    "Hazard-Reduction",
    "Deployment",
    "Strike-Team",
    "Other-operational",
    "Community-Engagement"
  ],
  "Chainsaw Operator": [
    "Incident-Call",
    "Pile-Burn",
    "Hazard-Reduction",
    "Deployment",
    "Training",
    "Other-operational",
  ],
  "First Aid": [
    "Incident-Call",
    "Pile-Burn",
    "Hazard-Reduction",
    "Deployment",
    "Training",
    "Other-operational",
  ],
  Navigation: [
    "Incident-Call",
    "Hazard-Reduction",
    "Training",
    "Other-operational",
  ],
  Foam: [
    "Incident-Call",
    "Pile-Burn",
    "Training",
    "Other-operational",
  ],
  Hydrants: [
    "Incident-Call",
    "Hazard-Reduction",
    "Deployment",
    "Strike-Team",
    "Training",
    "Other-operational",
  ],
  Ladders: [
    "Incident-Call",
    "Deployment",
    "Strike-Team",
    "Training",
    "Other-operational",
  ],
  "Working on roofs": ["Deployment", "Other-operational"],
  TIC: [
    "Incident-Call",
    "Hazard-Reduction",
    "Training",
    "Other-operational",
  ],
  "Flood Rescue": ["Deployment", "Other-operational"],
  Burnover: [
    "Incident-Call",
    "Strike-Team",
    "Training",
    "Other-operational",
  ],
};

function getRolesForActivity(activity) {
  return Object.entries(skills)
    .filter(([, activities]) => activities.includes(activity))
    .map(([role]) => role);
}

export default function RoleAssignment() {
  useTitle("Role Assignment");

  const csrfToken = useCsrfToken(apiurl);

  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [selectedDate, setSelectedDate] = useState("");
  const [events, setEvents] = useState([]);
  const [selectedEventNumber, setSelectedEventNumber] = useState("");

  const [attendees, setAttendees] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (csrfToken) {
      sessionStorage.setItem("csrf", csrfToken);
    }
  }, [csrfToken]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `${apiurl}/api/attendance/roleAssignment/status`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const result = await response.json();

        if (response.ok) {
          setUnlocked(!!result.unlocked);
        }
      } catch (error) {
        console.error("Failed to check role assignment status:", error);
      } finally {
        setLoadingStatus(false);
      }
    };

    checkStatus();
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();

    setMessage(null);

    if (!/^\d{4}$/.test(pin)) {
      setMessage({
        type: "danger",
        text: "PIN must be exactly 4 digits.",
      });
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
        setMessage({
          type: "danger",
          text: result.message || "Invalid PIN.",
        });
        return;
      }

      setUnlocked(true);
      setPin("");
      setMessage({
        type: "success",
        text: result.message || "Role assignment unlocked.",
      });
    } catch (error) {
      console.error("Failed to unlock role assignment:", error);

      setMessage({
        type: "danger",
        text: "Failed to unlock role assignment.",
      });
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      if (!unlocked || !selectedDate) {
        setEvents([]);
        setSelectedEventNumber("");
        setAttendees([]);
        setRoleDrafts({});
        return;
      }

      setLoadingEvents(true);
      setMessage(null);
      setEvents([]);
      setSelectedEventNumber("");
      setAttendees([]);
      setRoleDrafts({});

      try {
        const response = await fetch(
          `${apiurl}/api/attendance/roleAssignment/events?date=${encodeURIComponent(
            selectedDate
          )}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setMessage({
            type: "danger",
            text: result.message || "Failed to load events.",
          });
          return;
        }

        setEvents(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error("Failed to load events:", error);

        setMessage({
          type: "danger",
          text: "Failed to load events.",
        });
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [unlocked, selectedDate]);

  useEffect(() => {
    const fetchAttendees = async () => {
      if (!unlocked || !selectedEventNumber) {
        setAttendees([]);
        setRoleDrafts({});
        return;
      }

      setLoadingAttendees(true);
      setMessage(null);
      setAttendees([]);
      setRoleDrafts({});

      try {
        const response = await fetch(
          `${apiurl}/api/attendance/roleAssignment/attendees?eventNumber=${encodeURIComponent(
            selectedEventNumber
          )}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setMessage({
            type: "danger",
            text: result.message || "Failed to load attendees.",
          });
          return;
        }

        const rows = Array.isArray(result) ? result : [];

        setAttendees(rows);

        const drafts = {};

        for (const row of rows) {
          drafts[row.recordId] = Array.isArray(row.roles) ? row.roles : [];
        }

        setRoleDrafts(drafts);
      } catch (error) {
        console.error("Failed to load attendees:", error);

        setMessage({
          type: "danger",
          text: "Failed to load attendees.",
        });
      } finally {
        setLoadingAttendees(false);
      }
    };

    fetchAttendees();
  }, [unlocked, selectedEventNumber]);

  const handleRoleToggle = (recordId, role) => {
    setRoleDrafts((current) => {
      const existingRoles = current[recordId] || [];

      const updatedRoles = existingRoles.includes(role)
        ? existingRoles.filter((existingRole) => existingRole !== role)
        : [...existingRoles, role];

      return {
        ...current,
        [recordId]: updatedRoles,
      };
    });
  };

  const handleSaveRoles = async () => {
    if (!selectedEventNumber) {
      setMessage({
        type: "danger",
        text: "Please select an event first.",
      });
      return;
    }

    const updates = attendees.map((attendee) => ({
      recordId: attendee.recordId,
      roles: roleDrafts[attendee.recordId] || [],
    }));

    if (updates.length === 0) {
      setMessage({
        type: "danger",
        text: "There are no attendees to update.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `${apiurl}/api/attendance/roleAssignment/updateRoles`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
          },
          body: JSON.stringify({
            eventNumber: selectedEventNumber,
            updates,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage({
          type: "danger",
          text: result.message || "Failed to save roles.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: result.message || "Roles saved successfully.",
      });
    } catch (error) {
      console.error("Failed to save roles:", error);

      setMessage({
        type: "danger",
        text: "Failed to save roles.",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedEvent = events.find(
    (event) => event.eventNumber === selectedEventNumber
  );

  if (loadingStatus) {
    return (
      <div className="container mt-5">
        <p>Loading role assignment page...</p>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Role Assignment</h1>

      {message && (
        <div className={`alert alert-${message.type}`} role="alert">
          {message.text}
        </div>
      )}

      {!unlocked ? (
        <div className="card p-4 mb-4" style={{ maxWidth: "400px" }}>
          <h2 className="h5 mb-3">Enter Role Assignment PIN</h2>

          <form onSubmit={handleUnlock}>
            <div className="mb-3">
              <label className="form-label">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                className="form-control"
                value={pin}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "");
                  setPin(digitsOnly.slice(0, 4));
                }}
                autoComplete="off"
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Unlock
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="card p-4 mb-4">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Event</label>
                <select
                  className="form-select"
                  value={selectedEventNumber}
                  onChange={(e) => setSelectedEventNumber(e.target.value)}
                  disabled={!selectedDate || loadingEvents}
                >
                  <option value="">
                    {loadingEvents ? "Loading events..." : "Select event"}
                  </option>

                  {events.map((event) => (
                    <option key={event.eventNumber} value={event.eventNumber}>
                      {event.eventNumber} — {event.eventType} —{" "}
                      {event.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedDate && !loadingEvents && events.length === 0 && (
            <div className="alert alert-info">
              No events found for this date.
            </div>
          )}

          {selectedEventNumber && (
            <div className="card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="h4 mb-1">Attendees</h2>

                  {selectedEvent && (
                    <div className="text-muted">
                      {selectedEvent.eventNumber} — {selectedEvent.description}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSaveRoles}
                  disabled={saving || attendees.length === 0}
                >
                  {saving ? "Saving..." : "Save Roles"}
                </button>
              </div>

              {loadingAttendees ? (
                <p>Loading attendees...</p>
              ) : attendees.length === 0 ? (
                <p className="mb-0">
                  No attendance records found for this event.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Activity</th>
                        <th>Time</th>
                        <th>Roles</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attendees.map((attendee) => {
                        const availableRoles = getRolesForActivity(
                          attendee.activity
                        );

                        const selectedRoles =
                          roleDrafts[attendee.recordId] || [];

                        return (
                          <tr key={attendee.recordId}>
                            <td>{attendee.name}</td>
                            <td>{attendee.activity}</td>
                            <td>{attendee.timestampLocal}</td>
                            <td>
                              {availableRoles.length === 0 ? (
                                <span className="text-muted">
                                  No roles available for this activity
                                </span>
                              ) : (
                                <div className="d-flex flex-wrap gap-3">
                                  {availableRoles.map((role) => (
                                    <div className="form-check" key={role}>
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`${attendee.recordId}-${role}`}
                                        checked={selectedRoles.includes(role)}
                                        onChange={() =>
                                          handleRoleToggle(
                                            attendee.recordId,
                                            role
                                          )
                                        }
                                      />

                                      <label
                                        className="form-check-label"
                                        htmlFor={`${attendee.recordId}-${role}`}
                                      >
                                        {role}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}