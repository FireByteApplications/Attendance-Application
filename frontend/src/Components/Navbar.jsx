// src/Components/Navbar.jsx
import { useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const isProd = import.meta.env.VITE_STAGE === 'prod';
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;

  const isAdmin = path.startsWith("/admin");
  const isAttendance = path.startsWith("/attendance");
  const isIndex = path === "/";

  const pathBackMap = {
    "/attendance/selection": "/attendance",
    "/attendance/operational": "/attendance/selection",
    "/attendance/non-operational": "/attendance/selection",
    "/admin/dashboard": "/admin",
    "/admin/add-user": "/admin/users",
    "/admin/users": "/admin/dashboard",
    "/admin/reports": "/admin/dashboard",
    "/admin/rolereports": "/admin/dashboard"
  };

  const pageTitleMap = {
    "/": "JRFB Attendance Application",

    "/attendance": "Attendance System",
    "/attendance/selection": "Select Attendance Type",
    "/attendance/operational": "Operational Attendance",
    "/attendance/non-operational": "Non-Operational Attendance",

    "/admin": "Admin Portal",
    "/admin/dashboard": "Admin Dashboard",
    "/admin/add-user": "Add User",
    "/admin/users": "Manage Users",
    "/admin/reports": "Reports",
    "/admin/rolereports": "Role Reports",

    "/manageincidents": "Event Management",
    "/roles": "Role Assignment"
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
    if (isProd === true){
      if (pageTitleMap[path] !== undefined){
       return pageTitleMap[path] 
      } else{
        return "JRFB Attendance Application"
      } ;
    } else {
        if(pageTitleMap[path] !== undefined){
          return pageTitleMap[path] + " (Dev)"
        } else{
          return "JRFB Attendance Application" + " (Dev)"
        }
    }
    
  };

  return (
    <nav className={`navbar navbar-dark ${isProd === true ? "bg-dark" : "bg-danger"}`}>
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
