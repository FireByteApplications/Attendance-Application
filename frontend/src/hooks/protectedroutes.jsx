// src/hooks/ProtectedRoute.jsx
import AuthGate from "./authGate";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  return <AuthGate requireAdmin={requireAdmin}>{children}</AuthGate>;
}