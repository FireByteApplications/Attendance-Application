import { useNavigate } from "react-router-dom";
import {useEffect} from 'react'
const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear client-side storage
    localStorage.removeItem("accessToken");
    sessionStorage.clear();

    // Redirect after 1 second delay
    const timer = setTimeout(() => {
      navigate("/");
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return <p>Logging you out…</p>;
};

export default Logout;
