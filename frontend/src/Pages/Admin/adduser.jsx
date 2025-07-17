//This page adds users to the database
import { Helmet } from 'react-helmet-async';
import {useState, useEffect} from "react";
//Import component that fetches csrf token from api
import {useCsrfToken} from "../../Components/csrfHelper.jsx"
//Defines API url
const apiUrl = import.meta.env.VITE_API_BASE_URL
//gets a csrf token from the api for calls
const AddUser = () => {
  const csrfToken = useCsrfToken(apiUrl);
      useEffect(() => {
          if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
        }, [csrfToken]);
  //Fields for adding a new user with a honeypot to avoid bots
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
  //error and success messages to display
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  //watcher for change in values
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
//watcher for form submission
 const handleSubmit = async (e) => {
  e.preventDefault();
  //form sanitisation
  const sanitizedData = {
    ...formData,
    firstName: sanitizeName(formData.firstName),
    lastName: sanitizeName(formData.lastName),
  };
  //error catching 
  const errors = validateUserForm(sanitizedData);
  if (errors.length > 0) {
    alert(errors.join("\n"));
    return;
  }
  //Post form to endpoint
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/adduser`, {
      method: "POST",
      headers: {
        "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
        "Content-Type": "application/json",
      },
      credentials: "include",
      //only send sanitised data
      body: JSON.stringify(sanitizedData),
    });

    if (res.ok) {
      //success and error messages, redirects back to previous page if successful
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
    setErrorMessage("internal error occurred adding user please try again or contact admin");
  }
};


  return (
    <>
    <Helmet>
      <title>Add User</title>
    </Helmet>
        <div className="container my-4">
          <h1>Add a New User</h1>
          {successMessage && <div className="alert alert-success fade show">{successMessage}</div>}
          {errorMessage && <div className="alert alert-danger fade show">{errorMessage}</div>}
          <form id="addUserForm" onSubmit={handleSubmit}>
            {/* First Name form */}
            <input
              type="text"
              name="firstName"
              className="form-control mb-3"
              placeholder="First Name"
              maxLength="25"
              required
              pattern="[A-Za-z\s]+"
              value={formData.firstName}
              onChange={handleChange}
            />

            {/* Last Name form */}
            <input
              type="text"
              name="lastName"
              className="form-control mb-3"
              placeholder="Last Name"
              maxLength="25"
              required
              pattern="[A-Za-z\s]+"
              value={formData.lastName}
              onChange={handleChange}
            />

            {/* Fire Zone Number form */}
            <input
              type="text"
              name="fireZoneNumber"
              className="form-control mb-3"
              placeholder="Fire Zone Number"
              maxLength="15"
              pattern="[1-9]+"
              required
              value={formData.fireZoneNumber}
              onChange={handleChange}
            />

            {/* Status form */}
            <select
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

            {/* Classification form */}
            <select
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

            {/* Membership Type form */}
            <select
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

            {/* Honeypot test */}
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
            {/* submission button */}
            <button type="submit" className="btn btn-primary">Add User</button>
            <a href="/admin/users" className="btn btn-secondary ms-2">Back</a>
          </form>
        </div>
    </>
  );
};

export default AddUser;
//import form validation and user sanitisation
import {
  validateUserForm,
  sanitizeName
} from '../../Utils/formValidation'; 