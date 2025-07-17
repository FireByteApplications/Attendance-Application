//Navbar with back button and logout button on admin pages
import { useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const isAdmin = location.pathname.startsWith("/admin");
  const isAttendance = location.pathname.startsWith("/attendance");
  const isIndex = location.pathname === "/";
  const pathBackMap = {
  "/attendance/selection": "/attendance",
  "/attendance/operational": "/attendance/selection",
  "/attendance/non-operational": "/attendance/selection",
  "/admin/dashboard": "/admin",
  "/admin/add-user": "/admin/users",
  "/admin/users": "/admin/dashboard",
  "/admin/reports": "/admin/dashboard",
};
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  if (path.startsWith("/attendance/")) {
  sessionStorage.removeItem("activity");
  }

  const handleSmartBack = () => {
    const backPath = pathBackMap[location.pathname] || "/";
    navigate(backPath);
  };

  const getTitle = () => {
    if (isAdmin) return "Admin Portal";
    if (isAttendance) return "Attendance System";
    return "JRFB Attendance Application";
  };

  return (
    <nav className="navbar navbar-dark bg-dark">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          {/* Back Button (not on index) */}
          {!isIndex && (
            <button onClick={handleSmartBack} className="btn btn-outline-light">
              <i className="bi bi-arrow-left"></i> Back
            </button>
          )}

          {/* Logout (admin only) */}
          {isAdmin && (
            <a href={`${apiUrl}/auth/logout`} className="btn btn-outline-light">
              Logout
            </a>
          )}

          {/* Title */}
          <span className="navbar-brand mb-0 h1">{getTitle()}</span>
        </div>
      </div>
    </nav>
  );
}
