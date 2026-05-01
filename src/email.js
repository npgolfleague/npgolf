// Zoho Mail SMTP utility using Nodemailer
const nodemailer = require('nodemailer');

const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
const bccEmail = 'commish@npgolf.net';

// Create a transporter using Zoho SMTP settings
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

/**
 * Send an email using Zoho SMTP
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML content of the email
 * @param {string} text - Plain text version (optional, will be auto-generated from html if not provided)
 * @param {Array} attachments - Array of attachment objects (optional)
 * @param {boolean} includeBcc - Whether to include BCC (default: true)
 * @returns {Promise} Nodemailer response
 */
async function sendEmail(to, subject, html, text = null, attachments = null, includeBcc = true) {
  const mailOptions = {
    from: fromEmail,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags if text not provided
  };

  if (includeBcc) {
    mailOptions.bcc = bccEmail;
  }

  if (attachments && attachments.length > 0) {
    // Nodemailer expects attachments in a slightly different format than SendGrid
    // SendGrid format: { content, filename, type, disposition }
    // Nodemailer format: { filename, content, contentType, disposition }
    mailOptions.attachments = attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.type,
      disposition: att.disposition,
      encoding: 'base64' // Assuming content is base64 like SendGrid usually provides
    }));
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${subject} (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send emails to multiple recipients
 * @param {Array<string>} recipients - Array of email addresses
 * @param {string} subject - Email subject line
 * @param {string} html - HTML content of the email
 * @param {string} text - Plain text version (optional)
 * @returns {Promise} Array of results
 */
async function sendBulkEmail(recipients, subject, html, text = null) {
  if (recipients.length === 0) {
    throw new Error('No recipients provided');
  }

  const results = { sent: 0, failed: [] };

  // Zoho (and standard SMTP) doesn't have a direct "sendMultiple" like SendGrid's API
  // We'll iterate through them. To avoid being flagged as spam, 
  // we send them individually.
  for (let i = 0; i < recipients.length; i++) {
    const to = recipients[i];
    const isFirst = i === 0;
    
    try {
      // Only BCC on the first email to avoid getting 100 BCCs
      await sendEmail(to, subject, html, text, null, isFirst);
      results.sent++;
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      results.failed.push(to);
    }
  }

  return results;
}

module.exports = { sendEmail, sendBulkEmail };
