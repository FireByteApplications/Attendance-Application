import { useNavigate } from "react-router-dom";
import { useTitle } from '../../hooks/useTitle.jsx';

const pageShellStyle = {
  backgroundImage: 'url("/assets/background.jpg")',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  minHeight: '100vh',
  width: '100%',
};

export default function OperationalSelection() {
  const navigate = useNavigate();
  const handleSelect = (type) => {
    if (type === "Operational") {
      navigate("/attendance/operational");
    } else {
      navigate("/attendance/non-operational");
    }
  };

  useTitle('Attendance Type');

  return (
    <div className="min-vh-100 w-100 d-flex flex-column py-4" style={pageShellStyle}>
      <div className="container text-center">
        <h1 className="display-6 border border-2 rounded-3 p-3 bg-danger text-black fw-semibold shadow-sm mx-auto mb-4" style={{ maxWidth: '720px' }}>
          Was your attendance operational or non operational?
        </h1>
        <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
          <button
            className="btn btn-lg px-5 py-3 shadow-sm text-white"
            style={{ backgroundColor: "var(--bs-gray-700)", width: "300px"}}
            data-value="Operational"
            onClick={() => handleSelect("Operational")}
          >
            Operational
          </button>
          <button
            className="btn btn-lg px-5 py-3 shadow-sm text-white"
            style={{ backgroundColor: "var(--bs-gray-700)", width: "300px"}}
            data-value="Non-Operational"
            onClick={() => handleSelect("Non-Operational")}
          >
            Non-Operational
          </button>
        </div>
      </div>
    </div>
  );
}
