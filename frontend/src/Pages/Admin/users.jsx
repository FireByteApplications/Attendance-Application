import { useTitle } from '../../hooks/useTitle.jsx';
import { useState, useEffect } from 'react';
import {useCsrfToken} from "../../Components/csrfHelper.jsx"

const apiUrl = import.meta.env.VITE_API_BASE_URL;

export default function Users() {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editingNumber, setEditingNumber] = useState(null);
  //Grab list of users from 
  const fetchUsers = () => {
    fetch(`${apiUrl}/api/users/list`, {
      method: "GET",
      credentials: "include"  // <-- include session cookie
    })
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => setErrorMessage("Failed to load users."));
  };
  const csrfToken = useCsrfToken(apiUrl);
      useEffect(() => {
          if (csrfToken) sessionStorage.setItem("csrf", csrfToken);
        }, [csrfToken]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('lastPage', window.location.href);
    const timer = setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 3000);
    return () => clearTimeout(timer);
  }, [successMessage, errorMessage]);

  const sanitize = (input, type) => {
    const temp = document.createElement("div");
    temp.textContent = input;
    let sanitizedInput = temp.innerHTML;
    if (type === "name") return sanitizedInput.replace(/[^a-zA-Z\s]/g, "").trim();
    if (type === "fzNumber") return sanitizedInput.replace(/[^0-9]/g, "").slice(0, 12);
    return sanitizedInput;
  };

  const handleEditClick = (user) => {
    setEditingUser({
      ...user,
      oldfzNumber: user.number,
      name: user.id,
    });
    setEditingNumber(user.number);
  };

  const handleEditChange = (field, value) => {
    setEditingUser(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const sanitizedName = sanitize(editingUser.name, "name");
    const sanitizedNumber = sanitize(editingUser.number, "fzNumber");

    const updatedData = {
      name: sanitizedName,
      fzNumber: sanitizedNumber,
      oldfzNumber: editingUser.oldfzNumber,
      memberStatus: editingUser.member_status,
      memberClassification: editingUser.membership_classification,
      memberType: editingUser.membership_type,
    };

    fetch(`${apiUrl}/api/users/updateRecord`, {
      method: 'POST',
      credentials: "include",
      headers: { 
        'Content-Type': 'application/json',
        "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf")
      },
      body: JSON.stringify(updatedData),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSuccessMessage(data.message || "User updated.");
          setEditingUser(null);
          setEditingNumber(null);
          fetchUsers();
        } else {
          setErrorMessage(data.message || "Record not found.");
        }
      })
      .catch(() => setErrorMessage("Internal error updating user. Contact system admin"));
  };

  const handleCancel = () => {
    setEditingUser(null);
    setEditingNumber(null);
  };

  const handleUserCheckbox = (number) => {
    const newSet = new Set(selectedUsers);
    newSet.has(number) ? newSet.delete(number) : newSet.add(number);
    setSelectedUsers(newSet);
    setSelectAll(newSet.size === users.length);
  };

  const handleDelete = async () => {
    if (!selectedUsers.size || !window.confirm("Are you sure you want to delete selected users?")) return;
    fetch(`${apiUrl}/api/users/delete`, {
      method: 'POST',
      credentials: "include",
      headers: { 
        'Content-Type': 'application/json',
        "X-CSRF-Token": csrfToken || sessionStorage.getItem("csrf"),
      },
      body: JSON.stringify({ numbers: Array.from(selectedUsers) })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(prev => prev.filter(u => !selectedUsers.has(u.number)));
          setSelectedUsers(new Set());
          setSuccessMessage(data.message || "Users deleted successfully.");
          setTimeout(() => {
          window.location.reload();
      }, 1000);
        } else {
          setErrorMessage(data.message || "Failed to delete users.");
        }
      })
      .catch(() => setErrorMessage("Error occurred during deletion."));
  };
  useTitle('Users');
  return (
    <>
      <div className="container mt-4">
        <h1 className="mb-3">Manage Users</h1>

        {successMessage && <div className="alert alert-success fade show">{successMessage}</div>}
        {errorMessage && <div className="alert alert-danger fade show">{errorMessage}</div>}

        <div className="d-flex gap-2 mt-3">
          <a href="/admin/add-user" className="btn btn-primary">Add New User</a>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete Selected Users</button>
        </div>

        <table className="table table-striped mt-4">
          <thead>
            <tr>
              <th>Name</th>
              <th>Fire Zone Number</th>
              <th>Status</th>
              <th>Membership Classification</th>
              <th>Membership Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.number}>
                <td><input type="checkbox" checked={selectedUsers.has(user.number)} onChange={() => handleUserCheckbox(user.number)} /></td>
                {editingNumber === user.number ? (
                  <>
                    <td><input value={editingUser.name} onChange={e => handleEditChange("name", e.target.value)} /></td>
                    <td><input value={editingUser.number} onChange={e => handleEditChange("number", e.target.value)} /></td>
                    <td>
                      <select value={editingUser.member_status} onChange={e => handleEditChange("member_status", e.target.value)}>
                        <option value="Active">Active</option>
                        <option value="Active(Life)">Active(Life)</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </td>
                    <td>
                      <select value={editingUser.membership_classification} onChange={e => handleEditChange("membership_classification", e.target.value)}>
                        <option value="Ordinary">Ordinary</option>
                        <option value="Associate">Associate</option>
                        <option value="Probationary">Probationary</option>
                      </select>
                    </td>
                    <td>
                      <select value={editingUser.membership_type} onChange={e => handleEditChange("membership_type", e.target.value)}>
                        <option value="Operational">Operational</option>
                        <option value="Social">Social</option>
                        <option value="Operational Support">Operational Support</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-success btn-sm me-2" onClick={handleSave}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{user.id}</td>
                    <td>{user.number}</td>
                    <td>{user.member_status}</td>
                    <td>{user.membership_classification}</td>
                    <td>{user.membership_type}</td>
                    <td>
                      <button className="btn btn-dark btn-sm" onClick={() => handleEditClick(user)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
