// Select/Deselect all user checkboxes
function setupSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const userCheckboxes = document.querySelectorAll('.userCheckbox');
  
    if (!selectAllCheckbox) return;
  
    selectAllCheckbox.addEventListener('change', (e) => {
      userCheckboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
    });
  }
  
  // Handle delete button click
function setupDeleteButton() {
  const oldBtn = document.getElementById('deleteBtn');
  if (!oldBtn) return;

  // Clone the button to remove all old listeners
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.replaceWith(newBtn);

  newBtn.addEventListener('click', (e) => {
    e.preventDefault();

    const selectedUsers = document.querySelectorAll('input[name="selectedUsers"]:checked');
    if (selectedUsers.length === 0) {
      alert('Please select at least one user to delete.');
      return;
    }

    const confirmDelete = confirm('Are you sure you want to delete the selected users? This action cannot be undone.');
    if (!confirmDelete) return;

    const userIds = Array.from(selectedUsers).map(user => user.value);
    deleteUsers(userIds);
  });
}
  
  
  
  // Send delete request
function deleteUsers(userIds) {
  fetch('/admin/users/delete/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds })
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
  
  // Initialize functions
  setupSelectAll();
  setupDeleteButton();
  