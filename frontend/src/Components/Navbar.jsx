import { useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const isProd = import.meta.env.VITE_STAGE === 'prod';
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;

  const isAdmin = path.startsWith("/admin");
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
    "/admin/reports": "Attendance Reports",
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
    <nav className={`navbar navbar-dark app-navbar ${isProd === true ? "bg-dark" : "bg-danger"}`} aria-label="Page navigation">
      <div className="container-fluid app-navbar__inner">
        <div className="app-navbar__actions">
          {/* Dont put back button on home page */}
          {!isIndex && (
            <button type="button" onClick={handleSmartBack} className="btn btn-outline-light">
              <span aria-hidden="true">←</span> Back
            </button>
          )}

          {/* Logout on admin pages only */}
          {isAdmin && (
            <a href={`${apiUrl}/auth/logout`} className="btn btn-outline-light">
              Logout
            </a>
          )}

        </div>
        <span className="navbar-brand app-navbar__title mb-0 h1">{getTitle()}</span>
      </div>
    </nav>
  );
}
