// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Components/layout';
import Index from './Pages/index';
import AddUser from './Pages/Admin/adduser';
import Dashboard from './Pages/Admin/dashboard';
import Postlogout from './Pages/Admin/post-logout';
import Reports from './Pages/Admin/reports';
import Users from './Pages/Admin/users';
import Unauthorized from './Pages/unauthorised';
import AttendanceLand from './Pages/Attendance/Attendance_land';
import NonOpPage from './Pages/Attendance/Non-op-page';
import OpPage from './Pages/Attendance/Op-page';
import SelectionPage from './Pages/Attendance/Selection-page';
import ProtectedRoute from "./hooks/protectedroutes";

function App() {
  return (
    <Routes>
      {/* Root site-wide layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Index />} />
        <Route path="/admin">
        <Route index element={<Navigate to="/" replace />} />
          <Route
            path="add-user"
            element={
              <ProtectedRoute requireAdmin>
                <AddUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute requireAdmin>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute requireAdmin>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute requireAdmin>
                <Users />
              </ProtectedRoute>
            }
          />
         <Route path="postlogout" element={<Postlogout/>}/>
        </Route>

        {/* Attendance pages (all under /attendance) */}
        <Route path="/attendance" element={<AttendanceLand />}/>
        <Route path="/attendance/selection" element={<SelectionPage />} />
        <Route path="/attendance/non-operational" element={<NonOpPage />} />
        <Route path="/attendance/operational" element={<OpPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
