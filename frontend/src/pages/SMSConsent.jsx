export function SMSConsent() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SMS Messaging Consent & Terms</h1>
          <p className="mt-2 text-sm text-gray-600">NPGolf Tournament Management System</p>
        </div>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Overview</h2>
            <p>
              NPGolf provides SMS text message notifications to help members stay informed about 
              upcoming golf tournaments, schedule changes, and tournament-related updates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Collect Consent</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800">During Registration</h3>
                <p>
                  When new players register for NPGolf, they are required to provide a phone number. 
                  After registration, they receive an SMS with a link to opt-in to tournament notifications. 
                  By clicking the opt-in link, users explicitly consent to receive SMS messages.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Via Opt-In Link</h3>
                <p>
                  All SMS opt-in confirmations are sent via a secure link that users must actively click 
                  to enable SMS notifications. No messages are sent until consent is confirmed.
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
                <strong>Reply STOP:</strong> Reply with the word "STOP" to any message from NPGolf 
                and you will immediately be unsubscribed
              </li>
              <li>
                <strong>Account Settings:</strong> Log into your NPGolf account and disable SMS 
                notifications in your player profile settings
              </li>
              <li>
                <strong>Contact Admin:</strong> Contact your league administrator to manually 
                disable SMS for your account
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
              contact your league administrator through the NPGolf website at{' '}
              <a href="https://npgolf.net" className="text-blue-600 hover:underline">
                https://npgolf.net
              </a>
            </p>
          </section>

          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Registration Screenshot</h2>
            <p className="text-sm text-gray-600 mb-4">
              Below is an example of our registration form where users provide their phone number 
              and subsequently receive an SMS opt-in link:
            </p>
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500 italic">
                [Screenshot showing registration form with phone number field and explanation that 
                users receive SMS opt-in link after registration]
              </p>
              <p className="text-sm text-gray-500 mt-4">
                The registration process at https://npgolf.net/register includes a required phone 
                number field. Upon successful registration, users receive an automated SMS with a 
                secure opt-in link to enable tournament notifications.
              </p>
            </div>
          </section>

          <div className="border-t pt-6 mt-8 text-sm text-gray-500 text-center">
            <p>NPGolf SMS Messaging Program</p>
            <p>Last Updated: February 25, 2026</p>
            <p className="mt-2">
              For questions, visit{' '}
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
