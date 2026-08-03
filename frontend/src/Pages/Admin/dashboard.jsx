import { useTitle } from '../../hooks/useTitle.jsx';
const Dashboard = () => {
  useTitle('Admin Dashboard');
  return (
    <>
      <div className="container my-4">
        <h1>Dashboard</h1>
        <div className="row">
          <div className="col-md-4">
            <div className="card text-white bg-primary mb-3">
              <div className="card-body">
                <h5 className="card-title">Users</h5>
                <p className="card-text">Manage system users.</p>
                <a href="/admin/users" className="btn btn-light">
                  Go
                </a>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card text-white bg-success mb-3">
              <div className="card-body">
                <h5 className="card-title">Attendance Reports</h5>
                <p className="card-text">Create Attendance reports.</p>
                <a href="/admin/reports" className="btn btn-light">
                  Go
                </a>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card text-white bg-info mb-3">
              <div className="card-body">
                <h5 className="card-title">Role Reports</h5>
                <p className="card-text">Report on event role attendance for users</p>
                <a href="/admin/rolereports" className="btn btn-light">
                  Go
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
  </>
  );
};

export default Dashboard;
