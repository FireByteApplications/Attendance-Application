const express = require('express');
const router = express.Router();
const dbModule = require('../config/db');
const environment = process.env.ENVIRONMENT;
const tenantid = process.env.TENANT_ID

const apiBaseUrl = environment === 'dev'
  ? 'http://api:3000'
  : 'https://jrfblogin-a8dhhtczbwabe8at.australiaeast-01.azurewebsites.net';

const getDB = dbModule.getDB;

// Auth check middleware (checks for admin user)
function isAuthenticated(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.redirect('/auth/login');
  }
}

// Dashboard
router.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('admin/dashboard', {
    backLink: '/',
    user: req.session.user,
    isadminpage: true,
    navTitle: "Admin Dashboard",
    isnotfirstpage: true
  });
});

// Format user display
function fetchUsers(users) {
  return users.map(user => {
    user.id = user.id.charAt(0).toUpperCase() + user.id.slice(1).toLowerCase();
    user.number = user.number.charAt(0).toUpperCase() + user.number.slice(1).toLowerCase();
    return user;
  });
}

// View users
router.get('/users', isAuthenticated, async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('Usernames');
    const users = await usersCollection.find({}).toArray();
    const capitalizedUsers = fetchUsers(users);

    res.render('admin/users', {
      backLink: '/admin/dashboard',
      users: capitalizedUsers,
      title: 'Manage Users',
      navTitle: 'Users',
      isadminpage: true,
      isnotfirstpage: true,
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error fetching users');
  }
});

// Add user page
router.get('/users/add', isAuthenticated, (req, res) => {
  res.render('admin/adduser', {
    backLink: '/admin/users',
    title: 'Add User',
    navTitle: 'Add User',
    isadminpage: true,
    isnotfirstpage: true
  });
});

// Add user action
router.post('/users/add', isAuthenticated, async (req, res) => {
  const { firstName, lastName, fireZoneNumber, Status, Classification, Type } = req.body;
  const accessToken = req.session.accessToken;

  try {
    const apiResponse = await fetch(`${apiBaseUrl}/api/addUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ firstName, lastName, fireZoneNumber, Status, Classification, Type })
    });

    const responseData = await apiResponse.json();

    if (apiResponse.status === 201) {
      res.redirect('/admin/users?success=User added successfully!');
    } else {
      res.redirect(`/admin/users?error=${encodeURIComponent(responseData.message || 'Failed to add user')}`);
    }
  } catch (error) {
    console.error('Error adding user:', error);
    res.redirect('/admin/users?error=An error occurred. Please try again.');
  }
});

// Update user
router.post('/users/updateRecord', isAuthenticated, async (req, res) => {
  const { name, oldfzNumber, fzNumber, memberStatus, memberClassification, memberType } = req.body;
  const accessToken = req.session.accessToken;

  try {
    const apiResponse = await fetch(`${apiBaseUrl}/api/updateUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ name, oldfzNumber, fzNumber, memberStatus, memberClassification, memberType })
    });

    const responseData = await apiResponse.json();

    if (apiResponse.status === 200) {
      res.json({ success: true, message: 'User updated successfully' });
    } else if (apiResponse.status === 404) {
      res.status(404).json({ success: false, message: responseData.message || 'User not found' });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Error sending request to the API' });
  }
});

// Delete users
router.post('/users/delete/confirm', isAuthenticated, async (req, res) => {
  const { userIds } = req.body;
  const accessToken = req.session.accessToken;

  if (!userIds || userIds.length === 0) {
    return res.status(400).json({ success: false, message: 'No users selected for deletion' });
  }

  try {
    const apiResponse = await fetch(`${apiBaseUrl}/api/users/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ numbers: userIds })
    });

    const responseData = await apiResponse.json();

    if (apiResponse.status === 200) {
      res.json({ success: true, message: 'Users deleted successfully' });
    } else {
      res.status(500).json({ success: false, message: responseData.message || 'Failed to delete users from API' });
    }
  } catch (error) {
    console.error('Error deleting users:', error);
    res.status(500).json({ success: false, message: 'Error sending request to the API' });
  }
});

// Reports page
router.get('/reports', isAuthenticated, async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('Usernames');
    const users = await usersCollection.find({}, { projection: { id: 1, _id: 0 } }).toArray();

    res.render('admin/reports', {
      backLink: '/admin/dashboard',
      isadminpage: true,
      navTitle: "Reporting",
      isnotfirstpage: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error fetching users');
  }
});

// Run report
router.post('/reports/run', isAuthenticated, async (req, res) => {
  const accessToken = req.session.accessToken;

  try {
    const apiResponse = await fetch(`${apiBaseUrl}/api/reports/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await apiResponse.json();
    res.status(apiResponse.status).json(data);
  } catch (error) {
    console.error("Error proxying run report:", error);
    res.status(500).json({ error: "Failed to run report" });
  }
});

// Export report to Excel
router.post('/reports/export', isAuthenticated, async (req, res) => {
  const accessToken = req.session.accessToken;

  try {
    const apiResponse = await fetch(`${apiBaseUrl}/api/reports/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(req.body)
    });

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({ error: "Failed to export report" });
    }

    const buffer = await apiResponse.arrayBuffer();
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=report.xlsx"
    });
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error proxying export report:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});
// Logout
router.get('/logout', (req, res) => {
  const tenantId = process.env.TENANT_ID;
  const postLogoutRedirectUri = encodeURIComponent('https://localhost:443/admin/post-logout'); // Use your production domain when ready
  const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirectUri}`;

  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Failed to destroy session:', err);
      }
      // Redirect to Microsoft logout after session is destroyed
      res.redirect(logoutUrl);
    });
  } else {
    // No session? Just redirect to Microsoft logout
    res.redirect(logoutUrl);
  }
});
router.get('/post-logout', (req, res) => {
  res.render('admin/post-logout'); // render the EJS view we’ll create next
});

module.exports = router;
