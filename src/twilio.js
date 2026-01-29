// Twilio SMS utility
const twilio = require('twilio');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Use API Key if provided, otherwise fall back to Auth Token
const client = apiKey && apiSecret 
  ? twilio(apiKey, apiSecret, { accountSid })
  : twilio(accountSid, authToken);

async function sendSMS(to, body) {
  return client.messages.create({
    body,
    from: fromNumber,
    to
  });
}

module.exports = { sendSMS };