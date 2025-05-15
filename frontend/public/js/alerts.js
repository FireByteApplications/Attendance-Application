// Save the last visited page
sessionStorage.setItem('lastPage', window.location.href);

// Auto-dismiss alerts and clean URL
function dismissAlerts() {
  const successAlert = document.getElementById('alertSuccess');
  const errorAlert = document.getElementById('alertError');

  if (successAlert) successAlert.classList.remove('show');
  if (errorAlert) errorAlert.classList.remove('show');

  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}

setTimeout(dismissAlerts, 3000);
