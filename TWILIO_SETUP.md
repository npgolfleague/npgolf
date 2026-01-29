# Twilio SMS Integration

This document explains how to set up and use the Twilio SMS integration for sending tournament invitations.

## Setup

### 1. Install Twilio Package

The Twilio package has been installed:
```bash
npm install twilio
```

### 2. Configure Environment Variables

Add your Twilio credentials to your `.env` file (copy from `.env.example` if needed):

```env
# Twilio SMS credentials
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Base URL for SMS links (update to your production URL)
APP_BASE_URL=http://localhost:3000
```

### 3. Get Twilio Credentials

1. Sign up for a Twilio account at [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Get your **Account SID** and **Auth Token** from the Twilio Console Dashboard
3. Purchase a phone number or use the trial number
4. Add these credentials to your `.env` file

## Features

### SMS Tournament Invitations

The system can send SMS invitations to all active players who have:
- `sms_allowed = 1` in their player profile
- A valid phone number

### How It Works

1. **Admin sends invitation**: From the Tournament Players page, click "📱 Send SMS Invites"
2. **Players receive SMS**: Each player gets a personalized SMS with their name and a unique join link
3. **One-tap join**: Players click the link to automatically join the tournament
4. **Confirmation**: System prevents duplicate joins

### SMS Message Format

```
Hi [Player Name], are you playing in the next tournament? Tap to join: [unique_link]
```

## API Endpoints

### POST `/api/tournaments/:id/invite-sms`

Send SMS invites to all eligible players for a tournament.

**Response:**
```json
{
  "sent": 5,
  "failed": [
    {
      "id": 123,
      "phone": "+1234567890",
      "error": "Invalid phone number"
    }
  ]
}
```

### GET `/api/tournaments/join?playerId={id}&tournamentId={id}`

Add a player to a tournament via SMS link.

**Response:**
```json
{
  "message": "Joined tournament successfully"
}
```

## Frontend Integration

### Tournament Players Page

The Tournament Players page now includes:
- **Send SMS Invites button**: Green button to trigger SMS sending
- **Loading state**: Shows "Sending..." while processing
- **Success message**: Displays count of sent/failed messages
- **Error details**: Shows which messages failed and why

## Testing

### Test Mode (Twilio Trial)

If using a Twilio trial account:
- You can only send SMS to verified phone numbers
- Add test phone numbers in Twilio Console → Phone Numbers → Verified Caller IDs
- Messages will include a trial notice

### Production Testing

1. Ensure at least one player has:
   - `active = 1`
   - `sms_allowed = 1`
   - Valid phone number with country code (e.g., `+12025551234`)

2. Create a tournament

3. Go to Tournament Players page

4. Click "📱 Send SMS Invites"

5. Check the response for success/failure counts

## Player SMS Settings

Players can opt in/out of SMS notifications via their profile:
- **Phone**: Must be in international format (+1234567890)
- **SMS Allowed**: Checkbox to enable/disable SMS notifications

## Error Handling

The system handles various error scenarios:
- Invalid phone numbers
- Twilio API failures
- No eligible players
- Tournament not found
- Network issues

All errors are logged and returned in the API response for troubleshooting.

## Cost Considerations

- Twilio charges per SMS sent
- Check current pricing at [https://www.twilio.com/sms/pricing](https://www.twilio.com/sms/pricing)
- Monitor usage in Twilio Console
- Consider implementing rate limiting for production use

## Security

- Twilio credentials are stored in environment variables
- Never commit `.env` file to version control
- Use strong authentication for admin endpoints
- Validate phone numbers before sending
- Consider adding CAPTCHA for join links if needed

## Troubleshooting

### SMS Not Sending

1. **Check environment variables**: Ensure TWILIO_* variables are set correctly
2. **Verify phone numbers**: Must include country code
3. **Check Twilio balance**: Ensure account has sufficient credits
4. **Review Twilio logs**: Check Console for delivery status
5. **Verify player settings**: Ensure sms_allowed = 1 and phone is set

### Players Not Receiving SMS

1. **Check phone number format**: Must be E.164 format (+12025551234)
2. **Verify carrier support**: Some carriers block automated SMS
3. **Check spam filters**: Messages may be filtered
4. **Review Twilio status**: Check for service interruptions

### Invalid Phone Numbers

- Phone numbers must include country code
- Use international format: +[country code][number]
- Remove spaces, dashes, and parentheses
- Example: +12025551234 (not 202-555-1234)
