// Store the last visited page
sessionStorage.setItem('lastPage', window.location.href);

// Initialize form event listeners
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addUserForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
});

// Handle form submission
function validateSelections(value) {
  return /^[a-z\s]+$/.test(value);
}
function handleFormSubmit(event) {
  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const Status = document.getElementById('Status');
  const Classification = document.getElementById('Membership-Classification');
  const Type = document.getElementById('Membership-Type');
  const fireZone = document.getElementById('fireZoneNumber');
  const honeypot = document.getElementById('honeypot');


  if (honeypot.value) {
    event.preventDefault();
    alert("You've failed a bot test, please try again.");
    return;
  }

  sanitizeName(firstName);
  sanitizeName(lastName);

  if (!validateFireZoneNumber(fireZone.value)) {
    event.preventDefault();
    alert('Fire zone number must only contain numbers 1-9.');
    return;
  }

  if (!validateName(firstName.value) || !validateName(lastName.value)) {
    event.preventDefault();
    alert('Names must only contain letters and spaces.');
    return;
  }

  if (!validateSelections(Status.value) || !validateSelections(Classification.value) || !validateSelections(Type.value)) {
    event.preventDefault();
    console.log(Status.value, Classification.value, Type.value);
    alert('Values must only contain letters and spaces.');
    return;
  }
}

// Validate fire zone number (only 1-9 digits)
function validateFireZoneNumber(value) {
  return /^[1-9]+$/.test(value);
}

// Validate names (only letters, spaces and hyphens)
function validateName(value) {
  return /^[aA-zZ\s-]+$/.test(value);
}
function validateSelections(value){
  return /^[aA-zZ\s-()]+$/.test(value)
}
