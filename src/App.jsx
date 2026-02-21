import { useState, useCallback } from 'react'
import './App.css'

const DEFAULT_SERVER_NAME = 'webex-messaging'
const DEFAULT_MCP_URL = 'http://localhost:3001/mcp'
const DEFAULT_PORT = '3001'
const DEFAULT_API_BASE = 'https://webexapis.com/v1'
const MCP_MODES = ['http', 'stdio']

const DEFAULT_CC_SERVER_NAME = 'webex-contact-center'
const DEFAULT_CC_MCP_URL = 'http://localhost:3100/mcp'

const DEFAULT_CHAT_API_BASE = 'http://localhost:3100'
const DEFAULT_CHAT_MCP_URL = 'http://localhost:3100/mcp'

const TABS = [
  { id: 'messaging', label: 'Webex Messaging MCP' },
  { id: 'contact-center', label: 'Webex Contact Center MCP' },
  { id: 'chat', label: 'Chat (MCP client)' },
]

function buildMcpConfig({
  serverName,
  mcpUrl,
  port,
  mcpMode,
  userEmail,
  apiBaseUrl,
  apiToken,
  transport,
}) {
  const sanitizedName = (serverName || DEFAULT_SERVER_NAME).trim() || DEFAULT_SERVER_NAME
  if (transport === 'stdio') {
    return {
      mcpServers: {
        [sanitizedName]: {
          command: 'node',
          args: ['mcpServer.js', '--stdio'],
          env: {
            PORT: port || DEFAULT_PORT,
            MCP_MODE: mcpMode || 'stdio',
            WEBEX_USER_EMAIL: userEmail || '',
            WEBEX_API_BASE_URL: apiBaseUrl || DEFAULT_API_BASE,
            WEBEX_PUBLIC_WORKSPACE_API_KEY: apiToken || '',
          },
        },
      },
    }
  }
  const headers = {}
  if (port) headers.PORT = port
  if (mcpMode) headers.MCP_MODE = mcpMode
  if (userEmail) headers.WEBEX_USER_EMAIL = userEmail
  if (apiBaseUrl) headers.WEBEX_API_BASE_URL = apiBaseUrl
  if (apiToken) headers.WEBEX_PUBLIC_WORKSPACE_API_KEY = apiToken

  return {
    mcpServers: {
      [sanitizedName]: {
        url: mcpUrl || DEFAULT_MCP_URL,
        ...(Object.keys(headers).length > 0 && { headers }),
      },
    },
  }
}

function buildCcMcpConfig(serverName, mcpUrl) {
  const name = (serverName || DEFAULT_CC_SERVER_NAME).trim() || DEFAULT_CC_SERVER_NAME
  return {
    mcpServers: {
      [name]: {
        url: mcpUrl || DEFAULT_CC_MCP_URL,
      },
    },
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('messaging')
  const [serverName, setServerName] = useState(DEFAULT_SERVER_NAME)
  const [mcpUrl, setMcpUrl] = useState(DEFAULT_MCP_URL)
  const [port, setPort] = useState(DEFAULT_PORT)
  const [mcpMode, setMcpMode] = useState('http')
  const [userEmail, setUserEmail] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE)
  const [apiToken, setApiToken] = useState('')
  const [transport, setTransport] = useState('http')
  const [copied, setCopied] = useState(false)

  const [ccServerName, setCcServerName] = useState(DEFAULT_CC_SERVER_NAME)
  const [ccMcpUrl, setCcMcpUrl] = useState(DEFAULT_CC_MCP_URL)
  const [ccCopied, setCcCopied] = useState(false)

  const [chatApiBase, setChatApiBase] = useState(DEFAULT_CHAT_API_BASE)
  const [chatMcpUrl, setChatMcpUrl] = useState(DEFAULT_CHAT_MCP_URL)
  const [chatOrgId, setChatOrgId] = useState('')
  const [chatAccessToken, setChatAccessToken] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)

  const chatAuthReady = Boolean(chatAccessToken?.trim())

  const config = buildMcpConfig({
    serverName,
    mcpUrl,
    port,
    mcpMode,
    userEmail,
    apiBaseUrl,
    apiToken,
    transport,
  })

  const ccConfig = buildCcMcpConfig(ccServerName, ccMcpUrl)

  const copyConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [config])

  const copyCcConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(ccConfig, null, 2))
      setCcCopied(true)
      setTimeout(() => setCcCopied(false), 2000)
    } catch {
      setCcCopied(false)
    }
  }, [ccConfig])

  const sendChat = useCallback(async () => {
    const prompt = chatInput.trim()
    if (!prompt || chatLoading || !chatAuthReady) return
    setChatInput('')
    setChatError(null)
    setChatMessages((prev) => [...prev, { role: 'user', content: prompt }])
    setChatLoading(true)
    try {
      const base = chatApiBase.replace(/\/$/, '')
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mcpServerUrl: chatMcpUrl,
          accessToken: chatAccessToken.trim(),
          orgId: chatOrgId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || '',
          toolCalls: data.toolCalls,
        },
      ])
    } catch (err) {
      setChatError(err.message || String(err))
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message || String(err)}`, isError: true },
      ])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, chatAuthReady, chatApiBase, chatMcpUrl, chatAccessToken, chatOrgId])

  return (
    <div className="app">
      <header className="header">
        <h1>Webex MCP Config</h1>
        <p className="subtitle">
          Configure your MCP client (e.g. Cursor) to connect to Webex Messaging or Webex Contact Center MCP servers.
          Paste the generated JSON into your client config.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'messaging' && (
        <div className="layout">
          <section className="panel config-panel">
            <h2>Connection (Messaging)</h2>

            <div className="field-group">
              <label htmlFor="transport">Transport</label>
              <select
                id="transport"
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                className="input"
              >
                <option value="http">HTTP (StreamableHTTP)</option>
                <option value="stdio">STDIO (local process)</option>
              </select>
              <span className="hint">
                Use HTTP when the Webex MCP server runs remotely (e.g. <code>npm run start:http</code>).
              </span>
            </div>

            <div className="field-group">
              <label htmlFor="serverName">Server name (config key)</label>
              <input
                id="serverName"
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder={DEFAULT_SERVER_NAME}
                className="input"
              />
            </div>

            {transport === 'http' && (
              <>
                <div className="field-group">
                  <label htmlFor="mcpUrl">MCP endpoint URL</label>
                  <input
                    id="mcpUrl"
                    type="url"
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    placeholder={DEFAULT_MCP_URL}
                    className="input"
                  />
                  <span className="hint">e.g. http://localhost:3001/mcp or your deployed server URL.</span>
                </div>
                <div className="field-group">
                  <label htmlFor="port">Port (for headers)</label>
                  <input
                    id="port"
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder={DEFAULT_PORT}
                    className="input"
                  />
                </div>
              </>
            )}

            <div className="field-group">
              <label htmlFor="mcpMode">MCP mode</label>
              <select
                id="mcpMode"
                value={mcpMode}
                onChange={(e) => setMcpMode(e.target.value)}
                className="input"
              >
                {MCP_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="userEmail">Webex user email</label>
              <input
                id="userEmail"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="you@company.com"
                className="input"
                autoComplete="email"
              />
            </div>

            <div className="field-group">
              <label htmlFor="apiBaseUrl">Webex API base URL</label>
              <input
                id="apiBaseUrl"
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder={DEFAULT_API_BASE}
                className="input"
              />
            </div>

            <div className="field-group">
              <label htmlFor="apiToken">Webex API token</label>
              <input
                id="apiToken"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste token (no &quot;Bearer &quot; prefix)"
                className="input"
                autoComplete="off"
              />
              <span className="hint">
                Get a token from{' '}
                <a
                  href="https://developer.webex.com/messaging/docs/api/v1/rooms/list-rooms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  developer.webex.com
                </a>
                . Do not include &quot;Bearer &quot;.
              </span>
            </div>
          </section>

          <section className="panel output-panel">
            <h2>Generated config</h2>
            <p className="hint">Add this to your MCP client config (e.g. Cursor MCP settings).</p>
            <pre className="code-block">
              <code>{JSON.stringify(config, null, 2)}</code>
            </pre>
            <button
              type="button"
              onClick={copyConfig}
              className="copy-btn"
              aria-pressed={copied}
            >
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </section>
        </div>
      )}

      {activeTab === 'contact-center' && (
        <div className="layout">
          <section className="panel config-panel">
            <h2>Webex Contact Center MCP</h2>
            <p className="intro">
              This MCP server exposes{' '}
              <a
                href="https://developer.webex.com/webex-contact-center/docs/webex-contact-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                Webex Contact Center APIs
              </a>
              {' '}(REST, GraphQL, agents, tasks, webhooks, etc.) as MCP tools. Run the server in this repo&apos;s <code>server/</code> folder with <code>node index.js --http</code> and set <code>CONTACT_CENTER_ACCESS_TOKEN</code> (or <code>WEBEX_CC_ACCESS_TOKEN</code>) in the server environment.
            </p>

            <div className="field-group">
              <label htmlFor="ccServerName">Server name (config key)</label>
              <input
                id="ccServerName"
                type="text"
                value={ccServerName}
                onChange={(e) => setCcServerName(e.target.value)}
                placeholder={DEFAULT_CC_SERVER_NAME}
                className="input"
              />
            </div>

            <div className="field-group">
              <label htmlFor="ccMcpUrl">MCP endpoint URL</label>
              <input
                id="ccMcpUrl"
                type="url"
                value={ccMcpUrl}
                onChange={(e) => setCcMcpUrl(e.target.value)}
                placeholder={DEFAULT_CC_MCP_URL}
                className="input"
              />
              <span className="hint">Default: http://localhost:3100/mcp when running <code>node index.js --http</code> in <code>server/</code>.</span>
            </div>
          </section>

          <section className="panel output-panel">
            <h2>Generated config</h2>
            <p className="hint">Add this to your MCP client config. Token is configured on the server (env), not in this JSON.</p>
            <pre className="code-block">
              <code>{JSON.stringify(ccConfig, null, 2)}</code>
            </pre>
            <button
              type="button"
              onClick={copyCcConfig}
              className="copy-btn"
              aria-pressed={ccCopied}
            >
              {ccCopied ? 'Copied' : 'Copy JSON'}
            </button>
          </section>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="chat-layout">
          <section className="panel chat-panel">
            <h2>Chat (MCP client)</h2>
            <p className="intro">
              Set your <strong>Organization ID</strong> and <strong>Access token</strong> below to start chatting. The app uses them for Webex Contact Center API calls. Ensure the server is running (<code>node index.js --http</code> in <code>server/</code>) and <code>OPENAI_API_KEY</code> is set on the server.
            </p>
            <div className="chat-auth">
              <div className="field-group">
                <label htmlFor="chatOrgId">Organization ID <span className="required">required</span></label>
                <input
                  id="chatOrgId"
                  type="text"
                  value={chatOrgId}
                  onChange={(e) => setChatOrgId(e.target.value)}
                  placeholder="e.g. 7c3733e0-ea21-4e66-9e73-b14c6ac91c27"
                  className="input"
                  autoComplete="off"
                />
              </div>
              <div className="field-group">
                <label htmlFor="chatAccessToken">Access token <span className="required">required</span></label>
                <input
                  id="chatAccessToken"
                  type="password"
                  value={chatAccessToken}
                  onChange={(e) => setChatAccessToken(e.target.value)}
                  placeholder="Webex Contact Center API token"
                  className="input"
                  autoComplete="off"
                />
                <span className="hint">Get a token from the Webex Contact Center Developer Portal. Not stored on the server.</span>
              </div>
            </div>
            {!chatAuthReady && (
              <p className="chat-auth-required">Enter your access token above to enable the chat.</p>
            )}
            <div className="chat-settings">
              <div className="field-group">
                <label htmlFor="chatApiBase">Chat API base URL</label>
                <input
                  id="chatApiBase"
                  type="url"
                  value={chatApiBase}
                  onChange={(e) => setChatApiBase(e.target.value)}
                  placeholder={DEFAULT_CHAT_API_BASE}
                  className="input"
                />
              </div>
              <div className="field-group">
                <label htmlFor="chatMcpUrl">MCP server URL</label>
                <input
                  id="chatMcpUrl"
                  type="url"
                  value={chatMcpUrl}
                  onChange={(e) => setChatMcpUrl(e.target.value)}
                  placeholder={DEFAULT_CHAT_MCP_URL}
                  className="input"
                />
              </div>
            </div>
            <div className="chat-messages" role="log" aria-live="polite">
              {chatMessages.length === 0 && (
                <p className="chat-placeholder">e.g. &quot;List Webex Contact Center agents&quot; or &quot;Get agent statistics&quot;</p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-message chat-message-${msg.role}${msg.isError ? ' isError' : ''}`}>
                  <span className="chat-message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                  <div className="chat-message-content">{msg.content}</div>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <details className="chat-tool-calls">
                      <summary>Tools used ({msg.toolCalls.length})</summary>
                      <pre>{msg.toolCalls.map((t) => `${t.name}: ${t.result}`).join('\n\n')}</pre>
                    </details>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="chat-message chat-message-assistant">
                  <span className="chat-message-role">Assistant</span>
                  <div className="chat-message-content">Thinking…</div>
                </div>
              )}
            </div>
            {chatError && <p className="chat-error">{chatError}</p>}
            <form
              className="chat-form"
              onSubmit={(e) => { e.preventDefault(); sendChat(); }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={chatAuthReady ? 'Type a prompt to run MCP tools…' : 'Set token above to enable chat'}
                className="input chat-input"
                disabled={chatLoading || !chatAuthReady}
                aria-label="Chat prompt"
              />
              <button type="submit" className="copy-btn chat-send" disabled={chatLoading || !chatAuthReady}>
                {chatLoading ? 'Sending…' : 'Send'}
              </button>
            </form>
          </section>
        </div>
      )}

      <footer className="footer">
        <p>
          Webex Messaging:{' '}
          <a href="https://github.com/webex/webex-messaging-mcp-server" target="_blank" rel="noopener noreferrer">
            webex-messaging-mcp-server
          </a>
          . Webex Contact Center:{' '}
          <a href="https://developer.webex.com/webex-contact-center/docs/webex-contact-center" target="_blank" rel="noopener noreferrer">
            API docs
          </a>
          . Tokens are not stored in this app; they exist only in the page state and in the copied config.
        </p>
      </footer>
    </div>
  )
}

export default App
