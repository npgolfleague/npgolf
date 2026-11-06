import { useAppVersion, formatDateTime } from '../utils/version'

export const About = () => {
  const appVersion = useAppVersion()

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">About</h1>

          <div className="space-y-4 text-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Business Name</h2>
              <p className="mt-1">NPGOLF</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-800">Business Address</h2>
              <p className="mt-1">12302 Glenfield Ave, Tampa, FL 33626</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-800">SMS Compliance</h2>
              <a
                href="/sms-consent"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View SMS Compliance Page
              </a>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-800">Version</h2>
              {appVersion ? (
                <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-gray-500">Version</dt>
                  <dd>{appVersion.version ? `v${appVersion.version}` : 'Unknown'}</dd>
                  <dt className="text-gray-500">Commit</dt>
                  <dd className="font-mono">{appVersion.commit || 'Unknown'}</dd>
                  <dt className="text-gray-500">Branch</dt>
                  <dd className="font-mono">{appVersion.branch || 'Unknown'}</dd>
                  <dt className="text-gray-500">Built</dt>
                  <dd>{formatDateTime(appVersion.buildTime) || 'Unknown'}</dd>
                  <dt className="text-gray-500">Server started</dt>
                  <dd>{formatDateTime(appVersion.startedAt) || 'Unknown'}</dd>
                </dl>
              ) : (
                <p className="mt-1 text-sm text-gray-500">Version information unavailable.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
