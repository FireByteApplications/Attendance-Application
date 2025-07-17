import { Link } from 'react-router-dom'; 
import { Helmet } from 'react-helmet-async';
const apiUrl = import.meta.env.VITE_API_BASE_URL;
export default function Home() {
  return (
    <>
     <Helmet>
        <title>Home | Selection</title>
      </Helmet>
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
            <Link to={`${apiUrl}/auth/login`} className="text-decoration-none">
              <div className="card p-4 shadow-sm h-100">
                <h4 className="mb-0">Admin Dashboard</h4>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
