import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import PwaStatus from './PwaStatus';

export default function Layout() {
  return (
    <>
      <div className="app-shell d-flex flex-column min-vh-100">
        <Navbar />
        <PwaStatus />
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
