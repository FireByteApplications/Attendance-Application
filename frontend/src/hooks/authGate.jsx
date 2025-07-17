//For use on protected routes on admin centre to ensure only authenticated access via entra

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthGate({ children, requireAdmin = false }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/check`, {
          credentials: "include",
        });

        if (res.status === 401) {
          navigate("/unauthorized");
          return;
        }

        if (!res.ok) {
          navigate("/");
          return;
        }

        const data = await res.json();

        if (requireAdmin && !data.user?.isAdmin) {
          navigate("/unauthorized");
          return;
        }

        setChecking(false); // All checks passed
      } catch (err) {
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate, requireAdmin]);

  if (checking) return null; // or a loader/spinner

  return children;
}
 