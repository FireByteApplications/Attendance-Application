// authConfig.js
const clientSecret = process.env.AUTHSECRET
module.exports = {
  auth: {
    clientId: 'c8a45841-37b1-4472-b958-16af91df0f73',
    authority: 'https://login.microsoftonline.com/fbbb42b0-5d10-4bf1-9d90-cb02e8f150f2',
    clientSecret: `${clientSecret}`,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: 'Info',
    },
  },
};
