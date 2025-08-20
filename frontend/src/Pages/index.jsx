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
        // Session exists → go straight to dashboard
        window.location.href = '/admin/dashboard';
      } else {
        // No session → go to login flow
        window.location.href = `${apiUrl}/auth/login`;
      }
    } catch (err) {
      console.error('Error checking session:', err);
      // fallback to login if something fails
      window.location.href = `${apiUrl}/auth/login`;
    }
  };
export default function Home() {
 useTitle('Home | Selection');
  return (
    <>
      <div className="container d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
      <div className="row text-center">
        <div className="col-md-6 mb-4">
          <Link to="/attendance" className="text-decoration-none">
            <div className="card p-4 shadow-sm h-100">
              <h4 className="mb-0">Attendance Site</h4>
            </div>
          </Link>
        </div>
        <div className="col-md-6 mb-4">
          <button
            onClick={handleAdminClick}
            className="text-decoration-none btn btn-link p-0"
            style={{ textDecoration: 'none' }}
          >
            <div className="card p-4 shadow-sm h-100">
              <h4 className="mb-0">Admin DashboarD</h4>
            </div>
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
