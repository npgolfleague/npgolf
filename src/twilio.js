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
  // Check if SMS is enabled (default: false until Twilio approves)
  const smsEnabled = process.env.SMS_ENABLED === 'true';
  
  if (!smsEnabled) {
    console.log(`SMS disabled - would have sent to ${to}: ${body}`);
    return { 
      sid: 'SMS_DISABLED', 
      status: 'skipped',
      message: 'SMS messaging is currently disabled pending Twilio approval'
    };
  }
  
  return client.messages.create({
    body,
    from: fromNumber,
    to
  });
}

module.exports = { sendSMS };