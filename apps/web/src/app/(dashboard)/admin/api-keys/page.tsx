// Next.js App Router requires default export — framework exception.
const ApiKeysPage = (): JSX.Element => (
  <div className="max-w-2xl">
    <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
    <p className="mt-2 text-gray-500">Choose how to power AI features in Basics OS.</p>

    <div className="mt-6 space-y-4">
      {/* Option A */}
      <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Managed API Key</h3>
            <p className="mt-1 text-sm text-gray-600">
              One key covers all AI models, speech-to-text, and text-to-speech.
              No provider accounts needed.
            </p>
          </div>
          <a
            href="https://basicsos.com/keys"
            target="_blank"
            rel="noreferrer"
            className="ml-4 flex-shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Get a key →
          </a>
        </div>
        <div className="mt-3 rounded-lg bg-white p-3 font-mono text-xs text-gray-700">
          AI_API_KEY=bsk_live_...<br />
          AI_API_URL=https://api.basicsos.com
        </div>
      </div>

      {/* Option B */}
      <div className="rounded-xl border bg-white p-5">
        <h3 className="font-semibold text-gray-900">Bring Your Own Keys</h3>
        <p className="mt-1 text-sm text-gray-600">
          Use your own Anthropic or OpenAI account.
        </p>
        <div className="mt-3 rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-700">
          ANTHROPIC_API_KEY=sk-ant-...<br />
          <span className="text-gray-400"># or</span><br />
          OPENAI_API_KEY=sk-...
        </div>
      </div>
    </div>

    <p className="mt-4 text-sm text-gray-400">
      Edit your <code className="rounded bg-gray-100 px-1">.env</code> file and restart
      the API server to apply changes.
    </p>
  </div>
);

export default ApiKeysPage;
