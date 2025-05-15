// Save the last visited page in sessionStorage
sessionStorage.setItem('lastPage', window.location.href);

// Auto-dismiss alerts after 3 seconds and clean the URL
setTimeout(() => {
  const successAlert = document.getElementById('alertSuccess');
  if (successAlert) successAlert.classList.remove('show');

  const errorAlert = document.getElementById('alertError');
  if (errorAlert) errorAlert.classList.remove('show');

  // Remove URL query parameters (like ?success=...)
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}, 3000);

// Select/Deselect all checkboxes functionality
const selectAllCheckbox = document.getElementById('selectAll');
const userCheckboxes = document.querySelectorAll('.userCheckbox');

if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener('change', (e) => {
    userCheckboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
    });
  });
}

const editBtn = document.getElementById('editUser');
console.log(editBtn)

document.addEventListener("click", function(event) {
  // Function to sanitize input and prevent XSS attacks
  function sanitize(input, type) {
    let sanitizedInput = input;

    // Sanitizing text content (XSS protection)
    const temp = document.createElement("div");
    temp.textContent = sanitizedInput; // Using textContent to automatically escape HTML
    sanitizedInput = temp.innerHTML;

    // Further sanitization based on input type
    if (type === "name") {
      // Allow only letters and spaces for name
      sanitizedInput = sanitizedInput.replace(/[^a-zA-Z\s]/g, "").trim();
    } else if (type === "fzNumber") {
      // Allow only digits (up to 10 characters)
      sanitizedInput = sanitizedInput.replace(/\D/g, "").slice(0, 10);
    }

    return sanitizedInput;
  }

  const row = event.target.closest("tr");

  if (event.target.classList.contains("btn-dark")) {
    // Capture the initial fzNumber value before editing begins
    const oldfzNumber = row.querySelector(".fz-number").textContent.trim(); // Capture once before editing

    // Get current values and sanitize them
    const name = sanitize(row.querySelector(".name").textContent.trim(), "name");
    const fzNumber = sanitize(row.querySelector(".fz-number").textContent.trim(), "fzNumber");
    const memberStatus = sanitize(row.querySelector(".member-status").textContent.trim(), "text");
    const memberClassification = sanitize(row.querySelector(".member-classification").textContent.trim(), "text");
    const memberType = sanitize(row.querySelector(".member-type").textContent.trim(), "text");

    // Replace name and fzNumber with input fields
    row.querySelector(".name").innerHTML = `<input type="text" value="${name}" class="edit-name form-control">`;
    row.querySelector(".fz-number").innerHTML = `<input type="text" value="${fzNumber}" class="edit-fzNumber form-control" data-oldfznumber="${oldfzNumber}">`;

    // Replace memberStatus with a select dropdown
    row.querySelector(".member-status").innerHTML = `
      <select class="edit-member-status form-select">
        <option ${memberStatus === "Active" ? "selected" : ""}>Active</option>
        <option ${memberStatus === "Active (Life)" ? "selected" : ""}>Active (Life)</option>
        <option ${memberStatus === "Inactive" ? "selected" : ""}>Inactive</option>
      </select>
    `;

    // Replace memberClassification with a select dropdown
    row.querySelector(".member-classification").innerHTML = `
      <select class="edit-member-classification form-select">
        <option ${memberClassification === "Ordinary" ? "selected" : ""}>Ordinary</option>
        <option ${memberClassification === "Probationary" ? "selected" : ""}>Probationary</option>
        <option ${memberClassification === "Associate" ? "selected" : ""}>Associate</option>
      </select>
    `;

    // Replace memberType with a select dropdown
    row.querySelector(".member-type").innerHTML = `
      <select class="edit-member-type form-select">
        <option ${memberType === "Operational" ? "selected" : ""}>Operational</option>
        <option ${memberType === "Operational Support" ? "selected" : ""}>Operational Support</option>
        <option ${memberType === "Social" ? "selected" : ""}>Social</option>
      </select>
    `;

    // Change the Edit button to a Save button
    event.target.textContent = "Save";
    event.target.classList.remove("btn-dark");
    event.target.classList.add("btn-success");
  } 

  else if (event.target.classList.contains("btn-success")) {
    const row = event.target.closest("tr");

    // Get updated input/select values and sanitize them
    const name = sanitize(row.querySelector(".edit-name").value, "name");
    const fzNumber = sanitize(row.querySelector(".edit-fzNumber").value, "fzNumber");
    const oldfzNumber = row.querySelector(".edit-fzNumber").getAttribute("data-oldfznumber"); // Retrieve the old value from the data attribute
    const memberStatus = sanitize(row.querySelector(".edit-member-status").value, "text");
    const memberClassification = sanitize(row.querySelector(".edit-member-classification").value, "text");
    const memberType = sanitize(row.querySelector(".edit-member-type").value, "text");

    // Replace inputs/selects with text
    row.querySelector(".name").textContent = name;
    row.querySelector(".fz-number").textContent = fzNumber;
    row.querySelector(".member-status").textContent = memberStatus;
    row.querySelector(".member-classification").textContent = memberClassification;
    row.querySelector(".member-type").textContent = memberType;

    // Change the Save button back to Edit
    event.target.textContent = "Edit";
    event.target.classList.remove("btn-success");
    event.target.classList.add("btn-dark");

    // Send updated data to the server
    const updatedData = {
      name,
      oldfzNumber, // old fzNumber is retrieved from the data attribute
      fzNumber,    // new fzNumber, captured after the edit
      memberStatus,
      memberClassification,
      memberType
    };

    console.log("Old fzNumber:", oldfzNumber, "New fzNumber:", fzNumber); // Log both values

    // Make a POST request to update the record in the database
    fetch('/admin/users/updateRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    })
    .then(response => response.json())
    .then(data => {
      const alertSuccess = document.getElementById('alertSuccess');
      const alertError = document.getElementById('alertError');
  
      if (data.success) {
        if (alertSuccess) {
          alertSuccess.textContent = data.message || 'Users deleted successfully';
          alertSuccess.classList.add('show');
        }
        setTimeout(() => window.location.reload(), 3000);
      } else {
        if (alertError) {
          alertError.textContent = data.message || 'Failed to delete users.';
          alertError.classList.add('show');
        }
      }
    })
    .catch(error => {
      console.error('Error:', error);
      const alertError = document.getElementById('alertError');
      if (alertError) {
        alertError.textContent = 'An error occurred while deleting users.';
        alertError.classList.add('show');
      }
    });
  }
});
