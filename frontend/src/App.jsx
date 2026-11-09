import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Components/layout';
import Index from './Pages/index';
import ProtectedRoute from "./hooks/protectedroutes";

const AddUser = lazy(() => import('./Pages/Admin/adduser'));
const Dashboard = lazy(() => import('./Pages/Admin/dashboard'));
const Postlogout = lazy(() => import('./Pages/Admin/post-logout'));
const Reports = lazy(() => import('./Pages/Admin/reports'));
const Users = lazy(() => import('./Pages/Admin/users'));
const Unauthorized = lazy(() => import('./Pages/unauthorised'));
const AttendanceLand = lazy(() => import('./Pages/Attendance/Attendance_land'));
const NonOpPage = lazy(() => import('./Pages/Attendance/Non-op-page'));
const OpPage = lazy(() => import('./Pages/Attendance/Op-page'));
const SelectionPage = lazy(() => import('./Pages/Attendance/Selection-page'));
const ManageIncidents = lazy(() => import('./Pages/Attendance/Manage-Incidents'));
const Roles = lazy(() => import('./Pages/Attendance/Roles'));
const RoleReports = lazy(() => import('./Pages/Admin/rolereports'));

function App() {
  return (
    <Suspense fallback={<div className="container py-4" role="status" aria-live="polite">Loading page…</div>}>
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
          <Route
            path="rolereports"
            element={
              <ProtectedRoute requireAdmin>
                <RoleReports />
              </ProtectedRoute>
            }
          />
         <Route path="postlogout" element={<Postlogout/>}/>
        </Route>
        <Route 
          path="manageincidents"
          element={<ManageIncidents />}/>
        <Route 
          path="roles"
          element={<Roles />}/>


        {/* Attendance pages (all under /attendance) */}
        <Route path="/attendance" element={<AttendanceLand />}/>
        <Route path="/attendance/selection" element={<SelectionPage />} />
        <Route path="/attendance/non-operational" element={<NonOpPage />} />
        <Route path="/attendance/operational" element={<OpPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

export default App;
