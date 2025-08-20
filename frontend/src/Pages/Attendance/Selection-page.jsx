import { useNavigate } from "react-router-dom";
import styles from "../../styles/Attendance.module.css";
import { useTitle } from '../../hooks/useTitle.jsx';
export default function OperationalSelection() {
  const navigate = useNavigate();
  const handleSelect = (type) => {
    if (type === "Operational") {
      navigate("/attendance/operational");
    } else {
      navigate("/attendance/non-operational");
    }
  };

  const goBack = () => {
    navigate(-1);
  };
  useTitle('Attendance Type');
  return (
    <div className={styles.attendanceBg}>
      <h1 className='custom-title text-center mb-4 display-6 border border-2 rounded-3 p-3 bg-danger text-black fw-semibold shadow-sm'>
        Was your attendance operational or non operational?
      </h1>
      <div className={styles.activity}>
        <button
          className={styles.selectableButton}
          data-value="Operational"
          onClick={() => handleSelect("Operational")}
        >
          Operational
        </button>
        <button
          className={styles.selectableButton}
          data-value="Non-Operational"
          onClick={() => handleSelect("Non-Operational")}
        >
          Non-Operational
        </button>
      </div>
    </div>
  );
}
