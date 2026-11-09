import { useTitle } from '../../hooks/useTitle.jsx';
import { useState } from "react";
import {csrfFetch} from "../../Components/csrfHelper.jsx"


const apiUrl = import.meta.env.VITE_API_BASE_URL
const AddUser = () => {
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    fireZoneNumber: "",
    Status: "",
    Classification: "",
    Type: "",
    honeypot: "",
    middleName: "",
  });

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  const sanitizedData = {
    ...formData,
    firstName: sanitizeName(formData.firstName),
    lastName: sanitizeName(formData.lastName),
  };

  const errors = validateUserForm(sanitizedData);
  if (errors.length > 0) {
    alert(errors.join("\n"));
    return;
  }
  try {
    const res = await csrfFetch(apiUrl, "/api/users/adduser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(sanitizedData),
    });

    if (res.ok) {
      setSuccessMessage("User added successfully.");
      setTimeout(() => {
        window.location.href = "/admin/users";
      }, 2000);
    } else {
      const data = await res.json();
      setErrorMessage(data.message || "Failed to add user please try again.");
    }
  } catch (err) {
    console.error(err);
    setErrorMessage("An internal error occurred adding the user. Please try again or contact an administrator.");
  }
};
  useTitle('Add User');
  return (
    <>
        <div className="container my-4">
          <h1>Add a New User</h1>
          {successMessage && <div className="alert alert-success fade show">{successMessage}</div>}
          {errorMessage && <div className="alert alert-danger fade show">{errorMessage}</div>}
          <form id="addUserForm" onSubmit={handleSubmit}>
            {/* First Name */}
            <label htmlFor="firstName" className="form-label">First name</label>
            <input
              id="firstName"
              type="text"
              name="firstName"
              className="form-control mb-3"
              placeholder="First Name"
              maxLength={25}
              required
              pattern={"^[A-Za-z\\s\\-]+$"}
              value={formData.firstName}
              onChange={handleChange}
            />

            {/* Last Name */}
            <label htmlFor="lastName" className="form-label">Last name</label>
            <input
              id="lastName"
              type="text"
              name="lastName"
              className="form-control mb-3"
              placeholder="Last Name"
              maxLength={25}
              required
              pattern={"^[a-zA-Z' -]{1,25}$"}
              value={formData.lastName}
              onChange={handleChange}
            />

            {/* Fire Zone Number */}
            <label htmlFor="fireZoneNumber" className="form-label">Fire zone number</label>
            <input
              id="fireZoneNumber"
              type="text"
              name="fireZoneNumber"
              className="form-control mb-3"
              placeholder="Fire Zone Number"
              maxLength={15}
              pattern={"^[0-9]+$"}
              inputMode="numeric"
              required
              value={formData.fireZoneNumber}
              onChange={handleChange}
            />

            {/* Status */}
            <label htmlFor="memberStatus" className="form-label">Status</label>
            <select
              id="memberStatus"
              name="Status"
              className="form-control mb-3"
              required
              value={formData.Status}
              onChange={handleChange}
            >
              <option value="">Select Status</option>
              <option value="Active">Active</option>
              <option value="Active(Life)">Active(Life)</option>
              <option value="Inactive">Inactive</option>
            </select>

            {/* Classification */}
            <label htmlFor="memberClassification" className="form-label">Membership classification</label>
            <select
              id="memberClassification"
              name="Classification"
              className="form-control mb-3"
              required
              value={formData.Classification}
              onChange={handleChange}
            >
              <option value="">Select Classification</option>
              <option value="Ordinary">Ordinary</option>
              <option value="Associate">Associate</option>
              <option value="Probationary">Probationary</option>
            </select>

            {/* Type */}
            <label htmlFor="membershipType" className="form-label">Membership type</label>
            <select
              id="membershipType"
              name="Type"
              className="form-control mb-3"
              required
              value={formData.Type}
              onChange={handleChange}
            >
              <option value="">Select Type</option>
              <option value="Operational">Operational</option>
              <option value="Social">Social</option>
              <option value="Operational Support">Operational Support</option>
            </select>

            {/* Honeypot */}
            <input
              type="text"
              name="honeypot"
              style={{ display: "none" }}
              value={formData.honeypot}
              onChange={handleChange}
            />

            {/* Hidden middle name */}
            <div style={{ display: "none" }}>
              <input
                type="text"
                name="middleName"
                autoComplete="off"
                value={formData.middleName}
                onChange={handleChange}
              />
            </div>

            <button type="submit" className="btn btn-primary">Add User</button>
            <a href="/admin/users" className="btn btn-secondary ms-2">Back</a>
          </form>
        </div>
    </>
  );
};

export default AddUser;
import {
  validateUserForm,
  sanitizeName
} from '../../Utils/formValidation';
