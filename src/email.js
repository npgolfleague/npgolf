// SendGrid Email utility
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const fromEmail = process.env.SENDGRID_FROM_EMAIL;

/**
 * Send an email using SendGrid
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML content of the email
 * @param {string} text - Plain text version (optional, will be auto-generated from html if not provided)
 * @param {Array} attachments - Array of attachment objects (optional)
 * @returns {Promise} SendGrid response
 */
async function sendEmail(to, subject, html, text = null, attachments = null) {
  const msg = {
    to,
    from: fromEmail,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags if text not provided
  };

  if (attachments && attachments.length > 0) {
    msg.attachments = attachments;
  }

  try {
    const response = await sgMail.send(msg);
    console.log(`Email sent to ${to}: ${subject}`);
    return response;
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid error body:', error.response.body);
    }
    throw error;
  }
}

/**
 * Send emails to multiple recipients
 * @param {Array<string>} recipients - Array of email addresses
 * @param {string} subject - Email subject line
 * @param {string} html - HTML content of the email
 * @param {string} text - Plain text version (optional)
 * @returns {Promise} SendGrid response
 */
async function sendBulkEmail(recipients, subject, html, text = null) {
  const msg = {
    to: recipients,
    from: fromEmail,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '')
  };

  try {
    const response = await sgMail.sendMultiple(msg);
    console.log(`Bulk email sent to ${recipients.length} recipients: ${subject}`);
    return response;
  } catch (error) {
    console.error('Error sending bulk email:', error);
    if (error.response) {
      console.error('SendGrid error body:', error.response.body);
    }
    throw error;
  }
}

module.exports = { sendEmail, sendBulkEmail };
