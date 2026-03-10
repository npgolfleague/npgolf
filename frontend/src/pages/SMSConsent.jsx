export function SMSConsent() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SMS Messaging Consent & Terms</h1>
          <p className="mt-2 text-sm text-gray-600">NP Golf League</p>
        </div>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Overview</h2>
            <p>
              NP Golf League provides SMS text message notifications to help members stay informed about 
              upcoming golf tournaments, schedule changes, and tournament-related updates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Collect Consent</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800">During Registration</h3>
                <p>
                  When new players register at <a href="https://npgolf.net/register" className="text-blue-600 hover:underline">https://npgolf.net/register</a>, 
                  they are required to provide a phone number and must explicitly check a consent checkbox to opt-in to SMS notifications. 
                  The checkbox is unchecked by default, requiring active user consent. The consent text clearly states: 
                  "I agree to receive SMS text messages from NP Golf League at the phone number provided above. 
                  I understand I will receive tournament notifications and updates. Message and data rates may apply. 
                  I can reply STOP to opt out at any time."
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Express Written Consent</h3>
                <p>
                  By checking the SMS opt-in checkbox during registration, users provide express written consent 
                  to receive SMS messages from NP Golf League. No messages are sent unless the user actively checks this box.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What Messages You'll Receive</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tournament invitation notifications</li>
              <li>RSVP confirmation links for upcoming tournaments</li>
              <li>Tournament schedule updates or changes</li>
              <li>Important tournament-related announcements</li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              <strong>Frequency:</strong> You will only receive messages when there are active tournaments 
              or important updates. Typical frequency is 1-3 messages per tournament event.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              <strong>Message & Data Rates:</strong> Message and data rates may apply based on your 
              mobile carrier's plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Opt-Out</h2>
            <p>
              You can opt-out of SMS messages at any time using any of these methods:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Reply STOP:</strong> Reply with the word "STOP" to any message from NP Golf League 
                and you will immediately be unsubscribed
              </li>
              <li>
                <strong>Account Settings:</strong> Log into your account at npgolf.net and disable SMS 
                notifications in your player profile settings
              </li>
              <li>
                <strong>Contact Admin:</strong> Email{' '}
                <a href="mailto:commish@npgolf.net" className="text-blue-600 hover:underline">
                  commish@npgolf.net
                </a>
                {' '}to manually disable SMS for your account
              </li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              After opting out, you will not receive any further SMS messages unless you opt back in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Privacy & Data Protection</h2>
            <p>
              Your phone number is stored securely and is only used for sending tournament-related 
              SMS notifications. We do not share your phone number with third parties for marketing 
              purposes. Your consent status and phone number are stored in our secure database.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Help & Support</h2>
            <p>
              For help with SMS notifications or to report issues, reply HELP to any message or 
              contact NP Golf League:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Email: <a href="mailto:commish@npgolf.net" className="text-blue-600 hover:underline">commish@npgolf.net</a></li>
              <li>Website: <a href="https://npgolf.net" className="text-blue-600 hover:underline">https://npgolf.net</a></li>
            </ul>
          </section>

          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Registration Screenshot</h2>
            <p className="text-sm text-gray-600 mb-4">
              Below is an example of our registration form showing the SMS opt-in consent checkbox:
            </p>
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500 italic">
                [Screenshot showing registration form with phone number field and SMS consent checkbox that is unchecked by default]
              </p>
              <p className="text-sm text-gray-500 mt-4">
                The registration form at <a href="https://npgolf.net/register" className="text-blue-600 hover:underline">https://npgolf.net/register</a> includes:
              </p>
              <ul className="text-sm text-gray-500 mt-2 text-left max-w-2xl mx-auto">
                <li>• Required phone number field with country code</li>
                <li>• SMS consent checkbox (unchecked by default)</li>
                <li>• Clear consent language describing what messages users will receive</li>
                <li>• Information about message/data rates and opt-out instructions</li>
                <li>• Link to this SMS consent policy page</li>
              </ul>
            </div>
          </section>

          <div className="border-t pt-6 mt-8 text-sm text-gray-500 text-center">
            <p>NP Golf League SMS Messaging Program</p>
            <p>Last Updated: December 2024</p>
            <p className="mt-2">
              For questions, email{' '}
              <a href="mailto:commish@npgolf.net" className="text-blue-600 hover:underline">
                commish@npgolf.net
              </a>
              {' '}or visit{' '}
              <a href="https://npgolf.net" className="text-blue-600 hover:underline">
                https://npgolf.net
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
