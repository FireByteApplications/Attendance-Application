import { Link } from 'react-router-dom'; // IMPORTANT!
import { useTitle } from '../hooks/useTitle';

const apiUrl = import.meta.env.VITE_API_BASE_URL;
const handleAdminClick = async () => {
    try {
      const res = await fetch(`${apiUrl}/auth/session`, {
        method: 'GET',
        credentials: 'include', // include cookies for session check
      });

      if (res.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = `${apiUrl}/auth/login`;
      }
    } catch (err) {
      console.error('Error checking session:', err);
      window.location.href = `${apiUrl}/auth/login`;
    }
  };
export default function Home() {
 useTitle('Home | Selection');
  return (
    <>
      <div className="container d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
      <div className="row text-center">
        <div className="col-md-6 mb-4 d-flex">
          <Link
            to="/attendance"
            className="text-decoration-none btn btn-link p-0 w-100"
          >
            <div className="card p-4 shadow-sm h-100 w-100 d-flex justify-content-center align-items-center text-center">
              <h4 className="mb-0">Attendance Site</h4>
            </div>
          </Link>
        </div>
        <div className="col-md-6 mb-4 d-flex">
          <Link
            to="/manageincidents"
            className="text-decoration-none btn btn-link p-0 w-100"
          >
            <div className="card p-4 shadow-sm h-100 w-100 d-flex justify-content-center align-items-center text-center">
              <h4 className="mb-0">Event Management</h4>
            </div>
          </Link>
        </div>
        <div className="col-md-6 mb-4 d-flex">
          <Link
            to="/roles"
            className="text-decoration-none btn btn-link p-0 w-100"
          >
            <div className="card p-4 shadow-sm h-100 w-100 d-flex justify-content-center align-items-center text-center">
              <h4 className="mb-0">Role Assignment</h4>
            </div>
          </Link>
        </div>
        <div className="col-md-6 mb-4 d-flex">
          <button
            onClick={handleAdminClick}
            className="text-decoration-none btn btn-link p-0 w-100"
            style={{ textDecoration: 'none' }}
          >
            <div className="card p-4 shadow-sm h-100 w-100 h-100 justify-content-center align-items-center text-center">
              <h4 className="mb-0">Admin Dashboard</h4>
            </div>
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
