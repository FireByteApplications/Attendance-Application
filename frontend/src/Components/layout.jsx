//layout for the navbar
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
