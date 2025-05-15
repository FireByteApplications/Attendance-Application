require('dotenv').config();
const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const adminroutes = require('./routes/adminroutes');
const attendroutes = require('./routes/attendroutes');
const { connectDB } = require('./config/db'); // Only need connectDB now
const app = express();
const msal = require('@azure/msal-node');
const authConfig = require('./config/Authconfig');
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'mydomain.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'mydomain.crt'))
};
// Session setup
app.use(session({
  secret: process.env.SESSIONSECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
        secure: true,
        httpOnly: true, // Can't be accessed via JS
        sameSite: 'lax', // Helps prevent CSRF
        maxAge: 60 * 60 * 1000 // 1 hour session
    }
}));

const pca = new msal.ConfidentialClientApplication(authConfig);
// Locals for templates
app.use((req, res, next) => {
    res.locals.title = 'Jamberoo RFB Attendance page';
    res.locals.isadminpage = false;
    res.locals.isnotfirstpage = false;
    res.locals.navTitle = 'Jamberoo RFB Attendance';
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Layouts
app.use(expressLayouts);
app.set('layout', 'partials/layout');
app.set('view engine', 'ejs');
app.set('views', './views');

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/admin', adminroutes);
app.use('/attendance', attendroutes);
app.use((req, res, next) => {
  if (req.protocol === 'http') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// Home
app.get('/', (req, res) => {
    res.render('pages/index', {
        isadminpage: true,
        title: "JRFB Attendance Page"
    });
});
// Connect DB and start server
(async () => {
  // Connect to your database
  await connectDB();
  console.log('Connected to the database');

  // Define the HTTPS port (use 443 or any other secure port)
  const PORT = process.env.PORT || 443;

  // Create the HTTPS server
  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server running on https://localhost:${PORT}`);
  });
})();
app.get('/auth/login', (req, res) => {
  const authCodeUrlParameters = {
    scopes: ['user.read', `api://${process.env.API_CLIENT_ID}/access_as_user`],
    redirectUri: process.env.REDIRECT_URI,
  };

  pca.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
    res.redirect(response);
  }).catch((error) => console.log(JSON.stringify(error)));
});

app.get('/auth/redirect', async (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ['user.read', `api://${process.env.API_CLIENT_ID}/access_as_user`],
    redirectUri: process.env.REDIRECT_URI,
  };

  try {
    const response = await pca.acquireTokenByCode(tokenRequest);
    const idTokenClaims = response.idTokenClaims;
    const groups = idTokenClaims.groups || [];
    const isAdmin = groups.includes(ADMIN_GROUP_ID);

    // ✅ Store user and token in session
    req.session.user = {
      name: response.account.name,
      username: response.account.username,
      role: isAdmin ? 'admin' : 'user'
    };
    req.session.accessToken = response.accessToken; // ← This is key

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication error');
  }
});
