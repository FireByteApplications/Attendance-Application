//Function to apply authgate to the protected routes in admin centre
import AuthGate from "./authGate";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  return <AuthGate requireAdmin={requireAdmin}>{children}</AuthGate>;
}