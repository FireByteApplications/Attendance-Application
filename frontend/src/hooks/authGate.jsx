import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthGate({ children, requireAdmin = false }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/auth/check`, {
          credentials: "include",
          cache: "no-store",
          signal: ac.signal,
        });

        if (res.status === 401) {
          // No app session -> kick off Microsoft login at your API
          window.location.href = `${apiUrl}/auth/login`;
          return;
        }

        if (!res.ok) {
          // Any other server error -> show Unauthorized (or an error page)
          navigate("/unauthorized", { replace: true });
          return;
        }

        const data = await res.json();

        if (requireAdmin && !data.user?.isAdmin) {
          navigate("/unauthorized", { replace: true });
          return;
        }
        setChecking(false);
      } catch (err) {
        if (!ac.signal.aborted) {
          // Network error, etc. Choose where to send them; home is fine.
          navigate("/", { replace: true });
        }
      }
    })();

    return () => ac.abort();
  }, [navigate, requireAdmin, apiUrl]);

  if (checking) return null;
  
  return children;
}
