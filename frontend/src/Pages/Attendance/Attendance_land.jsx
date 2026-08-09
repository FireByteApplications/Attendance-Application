import { useTitle } from "../../hooks/useTitle.jsx";
import { useState, useEffect, useRef } from "react";
import { useCsrfToken, csrfFetch } from "../../Components/csrfHelper.jsx";

const apiurl = import.meta.env.VITE_API_BASE_URL;

export default function Login() {
  useTitle("JRFB Attendance Log In");

  const csrfToken = useCsrfToken(apiurl);

  const [popup, setPopup] = useState({ message: "", type: "" });

  const [usernameSearch, setUsernameSearch] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [selectedUsernames, setSelectedUsernames] = useState([]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showUsernameSearch, setShowUsernameSearch] = useState(true);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const sanitizeInput = (input) => {
    const regex = /^[a-zA-Z.-]+$/;
    return input
      .split("")
      .filter((char) => regex.test(char))
      .join("");
  };

  const normalizeUsername = (value) =>
    String(value || "").trim().toLowerCase();

  const handleUsernameChange = (e) => {
    const sanitized = sanitizeInput(e.target.value);
    setUsernameSearch(sanitized);
  };

  const handleUsernameToggle = (username) => {
    const normalized = normalizeUsername(username);

    setSelectedUsernames((current) =>
      current.includes(normalized)
        ? current.filter((existingUsername) => existingUsername !== normalized)
        : [...current, normalized]
    );
  };

  const pageShellStyle = {
    minHeight: "100vh",
    width: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    paddingBottom: "2rem",
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("popupMessage");
    const type = params.get("popupType");

    if (message && type) {
      setPopup({ message: decodeURIComponent(message), type });
      const timerId = window.setTimeout(() => setPopup({ message: "", type: "" }), 5000);
      return () => window.clearTimeout(timerId);
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    const query = usernameSearch.trim();

    if (query.length < 2) {
      setNameSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiurl}/api/attendance/usernameList?q=${encodeURIComponent(query)}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setNameSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        const names = Array.isArray(result) ? result : result.names || [];

        setNameSuggestions(names);
        setShowSuggestions(names.length > 0);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error fetching names:", error);
        }

        setShowSuggestions(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [usernameSearch]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current &&
        suggestionsRef.current &&
        !inputRef.current.contains(e.target) &&
        !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedUsernames.length === 0) {
      setPopup({
        message: "Please select at least one username.",
        type: "error",
      });
      return;
    }

    try {
      const res = await csrfFetch(apiurl, "/api/attendance/checkUser", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usernames: selectedUsernames,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        throw new Error("invalid");
      }

      sessionStorage.setItem("usernames", JSON.stringify(selectedUsernames));

      sessionStorage.setItem("username", selectedUsernames[0]);

      window.location.href = "/attendance/selection";
    } catch {
      setPopup({
        message:
          "Invalid username. Please check the selected usernames and try again.",
        type: "error",
      });
    }
  };

  return (
      <div
        className="min-vh-100 w-100 py-4"
        style={{
          backgroundImage: 'url("/assets/background.jpg")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
      {popup.message && (
        <div
          className={`alert ${
            popup.type === "success"
              ? "alert-success"
              : popup.type === "error"
              ? "alert-danger"
              : "alert-info"
          } mx-auto mt-3`}
          style={{ maxWidth: "400px", zIndex: 10 }}
        >
          {popup.message}
        </div>
      )}

      <div className="d-flex flex-grow-1 justify-content-center align-items-start mt-3">
        <div
          className="w-100"
          style={{ maxWidth: "400px", position: "relative" }}
        >
          <h1 className="text-center mb-4 display-6 border border-2 rounded-3 p-3 bg-danger text-gray-700 fw-semibold shadow-sm">
            JRFB Attendance Log
          </h1>

          <form onSubmit={handleSubmit} className="p-4 bg-light rounded shadow">
            <div className="mb-3 position-relative">
              <label htmlFor="username" className="form-label">
                Search usernames:
              </label>

              <input
                autoComplete="off"
                type="text"
                name="username"
                id="username"
                placeholder="Search username"
                className="form-control"
                value={usernameSearch}
                onChange={handleUsernameChange}
                ref={inputRef}
              />

              {showSuggestions && (
                <div
                  ref={suggestionsRef}
                  id="name-list"
                  className="border bg-white shadow-sm position-absolute"
                  style={{ zIndex: 1000, width: "100%" }}
                >
                  {nameSuggestions.map((name) => {
                    const normalized = normalizeUsername(name);
                    const checked = selectedUsernames.includes(normalized);

                    return (
                      <label
                        key={normalized}
                        className="d-flex align-items-center gap-2 px-3 py-2 border-bottom"
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input m-0"
                          checked={checked}
                          onChange={() => {
                            handleUsernameToggle(name);
                            setUsernameSearch("");
                            setShowSuggestions(false);
                            setShowUsernameSearch(false);
                          }}
                        />

                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedUsernames.length > 0 && (
              <div className="mb-3">
                <div className="fw-semibold mb-2">Selected members</div>

                <div className="d-flex flex-wrap gap-2">
                  {selectedUsernames.map((username) => (
                    <button
                      key={username}
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => handleUsernameToggle(username)}
                    >
                      {username} ×
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-secondary w-100"
              disabled={selectedUsernames.length === 0}
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}