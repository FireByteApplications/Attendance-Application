const express = require('express');
const router = express.Router();
const environment = process.env.ENVIRONMENT;
const apiBaseUrl = (environment === 'dev') ? 'http://api:3000' : process.env.API_URI;

router.post('/login', async (req, res) => {
  try {
    const apiResponse = await fetch(`${apiBaseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
      });
      
      const data = await apiResponse.json();
      res.json(data);  // pass it back to the browser
  } catch (error) {
      console.error('Error proxying login request:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const apiResponse = await fetch(`${apiBaseUrl}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    console.log(req.body);

    const data = await apiResponse.json();
    
    // Forward the status code and the response message from the original API to the frontend
    res.status(apiResponse.status).json({
      statusCode: apiResponse.status,  // Send the status code back
      message: data.message,           // Send the message from the API response
      data: data                       // Optional, send the full data if necessary
    });

    console.log(data);
  } catch (error) {
    console.error('Error proxying login request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500  // Ensure that error has status code 500
    });
  }
});


router.post('/api/names', async (req, res) => {
  const apiResponse = await fetch(`${apiBaseUrl}/api/names`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  });

  const matches = await apiResponse.json(); // matches is an array of strings
  console.log('Web server received matches:', matches);

  // Check that it's an array of strings before sending
  if (!Array.isArray(matches) || matches.some(name => typeof name !== 'string')) {
    return res.status(500).json({ error: 'Invalid data from API' });
  }

  res.json({ names: matches });
});
// Example route: Login
router.get('/index', (req, res) => {
  res.render('pages/Attendance_land', { layout: false });
});
router.get('/selection', (req, res) => {
  res.render('pages/Selection-page', { layout: false });
});
router.get('/Non-Operational', (req, res) => {
  res.render('pages/Non-op-page', { layout: false });
});
router.get('/Operational', (req, res) => {
  res.render('pages/Op-page', { layout: false });
});

module.exports = router;