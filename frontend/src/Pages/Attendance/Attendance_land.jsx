import { useTitle } from '../../hooks/useTitle.jsx';
import {useState, useEffect, useRef} from "react";
const apiurl = import.meta.env.VITE_API_BASE_URL;
import {useCsrfToken} from "../../Components/csrfHelper.jsx"

export default function Login() {
  const [popup, setPopup] = useState({ message: "", type: "" });
  const [username, setUsername] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const [usernameManuallySelected, setUsernameManuallySelected] = useState(false);
  // Sanitize input
  const sanitizeInput = (input) => {
    const regex = /^[a-zA-Z.]+$/;
    return input.split("").filter(char => regex.test(char)).join("");
  };

  const handleUsernameChange = (e) => {
    const sanitized = sanitizeInput(e.target.value);
    setUsername(sanitized);
  };

  // Show popup message on mount (e.g. from redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("popupMessage");
    const type = params.get("popupType");
    if (message && type) {
      setPopup({ message: decodeURIComponent(message), type });
      setTimeout(() => setPopup({ message: "", type: "" }), 3000);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);
  const csrfToken = useCsrfToken(apiurl);
      useEffect(() => {
          if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
        }, [csrfToken]);
  // Autocomplete effect
  useEffect(() => {
  if (usernameManuallySelected) {
    setUsernameManuallySelected(false); // reset for future typing
    return;
  }

  const fetchNames = async () => {
    if (username.length === 0) {
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `${apiurl}/api/attendance/usernameList?q=${encodeURIComponent(username)}`,
        { credentials: "include" }          // GET + cookie, no body needed
      );
      const result = await response.json();
      const names = Array.isArray(result) ? result : result.names || [];
      const filtered = names.filter(name =>
        name.toLowerCase().includes(username.toLowerCase())
      );
      setNameSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } catch (error) {
      console.error("Error fetching names:", error);
      setShowSuggestions(false);
    }
  };

  fetchNames();
}, [username]);


  // Hide suggestions when clicking outside
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

  // Submit form
const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const res = await fetch(
      `${apiurl}/api/attendance/checkUser?u=${encodeURIComponent(username)}`,
      { credentials: 'include' },
    );

    if (!res.ok) {
      throw new Error('invalid');
    }

    const { ok } = await res.json();          // ← server now returns { ok: true/false }
    if (ok) {
      sessionStorage.setItem('username', username);
      window.location.href = '/attendance/selection';
    } else {
      throw new Error('invalid');
    }
  } catch {
    setPopup({
      message:
        'Invalid username. Usernames must be 3-20 characters and may include one dot. Please try again.',
      type: 'error',
    });
  }
};

  useTitle('JRFB Attendance Log In');
  return (
    <div
      className="d-flex flex-column"
      style={{
        minHeight: "100vh",
        backgroundImage: "url('/assets/background.jpg')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        overflow: "hidden",
      }}
    >

      {/* Popup */}
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
      {/* Centered Form */}
        <div className="d-flex flex-grow-1 justify-content-center align-items-start mt-3">
    <div className="w-100" style={{ maxWidth: "400px", position: "relative" }}>
      <h1 className="text-center mb-4 display-6 border border-2 rounded-3 p-3 bg-danger text-gray-700 fw-semibold shadow-sm">
        JRFB Attendance Log
      </h1>
      <form onSubmit={handleSubmit} className="p-4 bg-light rounded shadow">
        <div className="mb-3 position-relative">
          <label htmlFor="username" className="form-label">
            Username:
          </label>
          <input
            autoComplete="off"
            type="text"
            name="username"
            id="username"
            placeholder="Enter your username"
            required
            className="form-control"
            value={username}
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
              {nameSuggestions.map((name) => (
                <div
                  key={name}
                  onClick={() => {
                  setUsername(name);
                  setUsernameManuallySelected(true);
                  setShowSuggestions(false);
                  }}
                  className="px-3 py-2"
                  style={{ cursor: "pointer" }}
                >
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-secondary w-100">
          Login
        </button>
      </form>
    </div>
  </div>
</div>
  );
}
