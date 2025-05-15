const loginForm = document.getElementById('login');
function sanitizeInput(input) {
    const regex = /^[a-zA-z.]+$/;
    let sanitizedInput = '';

    for (let i = 0; i < input.length; i++) {
        if (regex.test(input[i])) {
            sanitizedInput += input[i];
        }
    }
    return sanitizedInput;
}

if (loginForm) {
    document.getElementById('username').addEventListener('input', function () {
        const sanitizedValue = sanitizeInput(this.value);
        this.value = sanitizedValue;
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('username').value;

        try {
            const response = await fetch('/attendance/login', {
                //https://jrfblogin-a8dhhtczbwabe8at.australiaeast-01.azurewebsites.net
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username: username })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                sessionStorage.setItem('authToken', data.token);
                sessionStorage.setItem('username', username);
                window.location.href = "/attendance/Selection";
                console.log(response)
            } else {
                alert("Invalid username, usernames must be between 3 and 20 characters and only contain a full stop. Please try again.");
                console.log(response)
            }
        } catch (error) {
            alert('An error has occurred, please try again');
        }
    });
}

document.querySelectorAll('.activity button').forEach(button => {
    button.addEventListener('click', function (event) {
        const value = event.target.getAttribute('data-value');
        sessionStorage.setItem('activitySelection', value);
        if (value === 'Operational') {
            window.location.href = "/attendance/Operational";
        } else if (value === 'Non-Operational') {
            window.location.href = "/attendance/Non-Operational";
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const buttons = document.querySelectorAll('.selectable-button');
    const submitButton = document.getElementById('Submit');
    let selectedValue = '';

    buttons.forEach(button => {
        button.addEventListener('click', function () {
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedValue = '';
                sessionStorage.removeItem('activity');
            } else {
                buttons.forEach(btn => btn.classList.remove('selected'));
                this.classList.add('selected');
                selectedValue = this.getAttribute('data-value');
                sessionStorage.setItem('activity', selectedValue);
            }
        });
    });

    if (submitButton) {
        submitButton.addEventListener('click', async function () {
            const activity = sessionStorage.getItem('activity');
            if (!activity) {
                alert("Please select an option before submitting");
                return;
            }
    
            const backdate = document.getElementById('inputDate').value;
            let currentTimeStamp;
            if (backdate) {
                currentTimeStamp = new Date(backdate);
                currentTimeStamp.setHours(0, 0, 0, 0);
            } else {
                currentTimeStamp = new Date();
            }
    
            let username = sessionStorage.getItem('username');
            username = username.replace(/\./g, ' '); // Replace dots with spaces
            const activitySelection = sessionStorage.getItem('activitySelection');
    
            const data = {
                name: username,
                operational: activitySelection,
                activity: activity,
                epochTimestamp: currentTimeStamp.getTime(),
            };
    
            try {
                const response = await fetch('/attendance/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });
    
                const result = await response.json();  // Parse the JSON response
    
                // Check for error status (400 or other errors)
                if (!response.ok) {
                    // Show the error message if status is 400 or any other error
                    const errorMessage = result.message || 'An error has occurred, please try again later.';
                    alert(errorMessage);
                    window.location.href = '/attendance/index';  // Redirect after the error message
                    sessionStorage.clear();
                    return;  // Exit function if there's an error
                }
    
                // If the response is successful, proceed to show the success message
                const message = encodeURIComponent("Attendance logged successfully!");
                const type = encodeURIComponent("success");
                window.location.href = `/attendance/index?popupMessage=${message}&popupType=${type}`;
                console.log(data);  // Log the submitted data for debugging
            } catch (error) {
                // If the fetch fails (network error or something else), show a generic error message
                console.error("Submission Error:", error);
                alert("An error has occurred, please try again later.");
                window.location.href = '/attendance/index';
                sessionStorage.clear();
            }
        });
    }
    
});

function goBack() {
    window.history.back();
}

async function fetchNames(query) {
    try {
        const response = await fetch(`/attendance/api/names`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        console.log('Fetched result:', result);

        // If the result is { names: [...] }, extract it
        if (Array.isArray(result)) {
            return result;
        } else if (result.names && Array.isArray(result.names)) {
            return result.names;
        } else {
            console.error('Unexpected response format:', result);
            return [];
        }
    } catch (error) {
        console.error('Error fetching names:', error);
        return [];
    }
}


const input = document.getElementById('username');
const nameList = document.getElementById('name-list');

function filterNames(names, query) {
    if (!Array.isArray(names)) {
        console.error('Expected names to be an array, but got:', names);
        return [];
    }

    return names.filter(name => {
        if (typeof name !== 'string') {
            console.error('Expected each name to be a string, but got:', name);
            return false;
        }
        return name.toLowerCase().includes(query.toLowerCase());
    });
}

function showSuggestions(filteredNames) {
    nameList.innerHTML = ''; // Clear the previous suggestions
    if (filteredNames.length > 0) {
        nameList.style.display = 'block'; // Show the dropdown
        filteredNames.forEach(name => {
            const div = document.createElement('div');
            div.textContent = name;
            div.addEventListener('click', () => {
                input.value = name; // Set the input value to the clicked name
                nameList.style.display = 'none'; // Hide the dropdown
            });
            nameList.appendChild(div);
        });
    } else {
        nameList.style.display = 'none'; // Hide the dropdown if no matches found
    }
}

// Event listener for input field
input.addEventListener('input', async () => {
    const query = input.value;
    if (query.length > 0) {
        const names = await fetchNames(query); // Fetch names from the server
        const filteredNames = filterNames(names, query); // Filter names based on the input
        showSuggestions(filteredNames);
    } else {
        nameList.style.display = 'none'; // Hide the dropdown if input is empty
    }
});

// Hide the dropdown when clicking outside
document.addEventListener('click', (event) => {
    if (!input.contains(event.target) && !nameList.contains(event.target)) {
        nameList.style.display = 'none';
    }
});