// SendGrid Email utility
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const fromEmail = process.env.SENDGRID_FROM_EMAIL;
const bccEmail = 'commish@npgolf.net';

/**
 * Send an email using SendGrid
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML content of the email
 * @param {string} text - Plain text version (optional, will be auto-generated from html if not provided)
 * @param {Array} attachments - Array of attachment objects (optional)
 * @param {boolean} includeBcc - Whether to include BCC (default: true)
 * @returns {Promise} SendGrid response
 */
async function sendEmail(to, subject, html, text = null, attachments = null, includeBcc = true) {
  const msg = {
    to,
    from: fromEmail,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags if text not provided
  };

  // Only add BCC if requested (for first email in batch)
  if (includeBcc) {
    msg.bcc = bccEmail;
  }

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
  if (recipients.length === 0) {
    throw new Error('No recipients provided');
  }

  try {
    // Send first email with BCC if multiple recipients
    if (recipients.length > 1) {
      const firstMsg = {
        to: recipients[0],
        from: fromEmail,
        bcc: bccEmail,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '')
      };
      await sgMail.send(firstMsg);
      console.log(`Email sent to ${recipients[0]} (with BCC): ${subject}`);

      // Send remaining emails without BCC
      if (recipients.length > 1) {
        const remainingMsg = {
          to: recipients.slice(1),
          from: fromEmail,
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, '')
        };
        await sgMail.sendMultiple(remainingMsg);
        console.log(`Bulk email sent to ${recipients.length - 1} additional recipients: ${subject}`);
      }
    } else {
      // Single recipient - send normally with BCC
      const msg = {
        to: recipients[0],
        from: fromEmail,
        bcc: bccEmail,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '')
      };
      await sgMail.send(msg);
      console.log(`Email sent to ${recipients[0]}: ${subject}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending bulk email:', error);
    if (error.response) {
      console.error('SendGrid error body:', error.response.body);
    }
    throw error;
  }
}

module.exports = { sendEmail, sendBulkEmail };
