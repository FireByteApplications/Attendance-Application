const roles = [
  "Crew Leader",
  "Driver",
  "Pump Operator",
  "BA Operator",
  "BACO",
  "Hose Operator",
  "Chainsaw Operator"
]
export default function CheckboxContainer({selectedRoles = [], setSelectedRoles}){
    console.log(selectedRoles)
    function handleChange(e) {
        const {value, checked } = e.target
        setSelectedRoles((prev) => {
            if (checked) return prev.includes(value) ? prev: [...prev, value]
            return prev.filter((r) => r !== value);
        })
    }
        return(
      <div id ="checkBoxes" className="text-center border border-2 rounded-3 bg-secondary text-black fw-semibold shadow-sm mx-auto"
            style={{
              fontSize: "1rem",
              padding: "0.25rem 0.75rem",
              maxWidth: "400px",       // ✅ limit total width
              width: "100%",
              marginBottom: "1rem"           // ✅ ensure it shrinks on smaller screens
            }}>
        <div className=" ms-2 fs-5 form-label">Select the role you actively performed:</div>
        {roles.map((role) => {
            const id = `role-${String(role).toLowerCase().replace(/\s+/g, "-")}`;
        return(
          <label key={role} htmlFor={id} className="ms-2">
          <input
            id={id}
            type="checkbox"
            className=" ms-2 fs-5 w-auto d-inlineblock ms-2"
            value={role}
            checked={selectedRoles.includes(role)}
            onChange= {handleChange}
          />
          {role}
          </label>
        );
        })}
      </div>
    );
}