import { useState, useCallback } from 'react'
import './App.css'

const DEFAULT_CC_SERVER_NAME = 'webex-contact-center'
// Default MCP URL: use current page origin so it works both locally (e.g. :8080) and when deployed
function getDefaultCcMcpUrl() {
  if (typeof window !== 'undefined') return window.location.origin + '/mcp'
  return 'http://localhost:8080/mcp'
}

function getDefaultChatApiBase() {
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:8080'
}
function getDefaultChatMcpUrl() {
  if (typeof window !== 'undefined') return window.location.origin + '/mcp'
  return 'http://localhost:8080/mcp'
}
const DEFAULT_CHAT_API_BASE = 'http://localhost:8080'
const DEFAULT_CHAT_MCP_URL = 'http://localhost:8080/mcp'

const TABS = [
  { id: 'chat', label: 'Chat (MCP Client)' },
  { id: 'contact-center', label: 'Webex Contact Center MCP' },
]

const MCP_TOOLS_DOCS = [
  {
    name: 'cc_list_address_books',
    description: 'Lists address books for the organization. Calls Webex Contact Center API: GET organization/{orgId}/v3/address-book. Requires Organization ID (provide in Chat or in MCP arguments as __orgId, or set on server as CONTACT_CENTER_ORG_ID).',
    howToUseFromChat: 'In the Chat tab, enter your Organization ID and Access token, then type a natural prompt such as: "What address books do you have?", "List all address books", or "Show me the address books for my org." The assistant will call this tool and return the list.',
    examplePrompts: ['What address books do you have?', 'List all address books', 'Show me the address books for my org'],
  },
  {
    name: 'cc_end_task',
    description: 'Ends (clears) an interaction/task by task ID. Calls POST v1/tasks/{taskID}/end. You must provide the task ID. Uses the access token from the Chat tab or from MCP arguments (__accessToken), or server env.',
    howToUseFromChat: 'In Chat, after your Org ID and token are set, ask to end a specific task by ID, for example: "End task abc-123-def", "Clear the interaction for task xyz-456", or "Close task 12345."',
    examplePrompts: ['End task abc-123-def', 'Clear the interaction for task xyz-456', 'Close task 12345'],
  },
  {
    name: 'cc_check_agent_outbound',
    description: 'Checks if an agent is configured to place outbound calls. Uses org ID and token from Chat or MCP arguments. Internally: (1) GET user bulk-export to find the user and agent profile name, (2) GET agent-profile to read outdialEnabled.',
    howToUseFromChat: 'In Chat, with Org ID and token set, ask about a specific agent by email, e.g.: "Can agent john@company.com place outbound calls?", "Is outbound enabled for jane@example.com?", or "Check if this agent has outdial: user@org.com."',
    examplePrompts: ['Can agent john@company.com place outbound calls?', 'Is outbound enabled for jane@example.com?', 'Check if this agent has outdial: user@org.com'],
  },
]

function buildCcMcpConfig(serverName, mcpUrl) {
  const name = (serverName || DEFAULT_CC_SERVER_NAME).trim() || DEFAULT_CC_SERVER_NAME
  return {
    mcpServers: {
      [name]: {
        url: mcpUrl || (typeof window !== 'undefined' ? window.location.origin + '/mcp' : DEFAULT_CHAT_MCP_URL),
      },
    },
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [docsModalOpen, setDocsModalOpen] = useState(false)
  const [ccServerName, setCcServerName] = useState(DEFAULT_CC_SERVER_NAME)
  const [ccMcpUrl, setCcMcpUrl] = useState(getDefaultCcMcpUrl)
  const [ccCopied, setCcCopied] = useState(false)

  const [chatApiBase, setChatApiBase] = useState(getDefaultChatApiBase)
  const [chatMcpUrl, setChatMcpUrl] = useState(getDefaultChatMcpUrl)
  const [chatOrgId, setChatOrgId] = useState('')
  const [chatAccessToken, setChatAccessToken] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)

  const chatAuthReady = Boolean(chatAccessToken?.trim())

  const ccConfig = buildCcMcpConfig(ccServerName, ccMcpUrl)

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
        <div className="header-left">
          <h1>Webex Contact Center MCP</h1>
        </div>
        <div className="header-right">
          <button
            type="button"
            className="doc-link-btn"
            onClick={() => setDocsModalOpen(true)}
          >
            Documentation
          </button>
        </div>
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

      {activeTab === 'contact-center' && (
        <div className="layout">
          <section className="panel config-panel">
            <h2>How third parties can configure and use this MCP</h2>
            <p className="intro">
              This server exposes{' '}
              <a href="https://developer.webex.com/webex-contact-center/docs/webex-contact-center" target="_blank" rel="noopener noreferrer">
                Webex Contact Center APIs
              </a>
              {' '}as MCP tools. Third parties can connect <strong>Cursor</strong>, <strong>Claude Desktop</strong>, or any MCP client, or use <strong>Chat (MCP Client)</strong> on this page with their own Org ID and token.
            </p>

            <h3>1. What you need</h3>
            <ul className="doc-list">
              <li><strong>MCP endpoint URL</strong> — This server’s URL plus <code>/mcp</code> (e.g. <code>https://your-domain.awsapprunner.com/mcp</code>). When opened from this site, the field below defaults to the current origin.</li>
              <li><strong>Server name</strong> — Optional; the key used in your MCP client config (e.g. <code>webex-contact-center</code>).</li>
            </ul>

            <h3>2. Sending Organization ID and token</h3>
            <p><strong>Option A — Chat on this page</strong></p>
            <ul className="doc-list">
              <li>Use <strong>Chat (MCP Client)</strong>. Enter your <strong>Organization ID</strong> and <strong>Access token</strong> in the form.</li>
              <li>Each message is sent to <code>POST /api/chat</code> with JSON body: <code>{'{"prompt":"...","accessToken":"...","orgId":"..."}'}</code>. The server uses <code>accessToken</code> and <code>orgId</code> for Webex Contact Center API calls. Tokens are not stored.</li>
            </ul>
            <p><strong>Option B — Direct MCP (e.g. Cursor, Claude Desktop)</strong></p>
            <ul className="doc-list">
              <li>Add this server to your client config (paste the <strong>Generated config</strong> from the right panel). The config only contains the MCP URL; it does not include credentials.</li>
              <li>To pass <strong>Org ID and token per request</strong>, include them in the MCP <code>tools/call</code> arguments. The server accepts two reserved keys in <code>arguments</code>:
                <ul>
                  <li><code>__accessToken</code> — Webex Contact Center API access token (string)</li>
                  <li><code>__orgId</code> — Organization ID (string)</li>
                </ul>
                Example JSON-RPC request body for <code>tools/call</code>: <code>{'{"method":"tools/call","params":{"name":"cc_list_address_books","arguments":{"__accessToken":"YOUR_TOKEN","__orgId":"YOUR_ORG_ID"}}}'}</code>. The server strips these from the tool arguments and uses them for authentication.
              </li>
              <li>Alternatively, the server can use a single token/org set by the administrator in the environment (<code>CONTACT_CENTER_ACCESS_TOKEN</code>, <code>CONTACT_CENTER_ORG_ID</code>). Then clients do not need to send <code>__accessToken</code> or <code>__orgId</code> in each call.</li>
            </ul>

            <h3>3. Steps to add to your MCP client</h3>
            <ol className="doc-list">
              <li>Set <strong>MCP endpoint URL</strong> below to this server’s URL (e.g. <code>https://your-app.awsapprunner.com/mcp</code>).</li>
              <li>Optionally change the <strong>Server name</strong>.</li>
              <li>Click <strong>Copy JSON</strong> and paste into your MCP client configuration (e.g. Cursor → Settings → MCP → config JSON).</li>
              <li>Save and restart the client. When calling tools, pass <code>__accessToken</code> and <code>__orgId</code> in the request arguments if the server does not use env-based credentials.</li>
            </ol>

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
                placeholder="e.g. https://your-app.awsapprunner.com/mcp"
                className="input"
              />
              <span className="hint">This server’s URL + <code>/mcp</code>. When opened from the deployed site, it defaults to the current origin.</span>
            </div>
          </section>

          <section className="panel output-panel">
            <h2>Generated config</h2>
            <p className="hint">Paste this into your MCP client config file. The server handles authentication via its environment (or use the Chat tab for your own token).</p>
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

      {docsModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="docs-modal-title">
          <div className="modal-content docs-modal">
            <div className="modal-header">
              <h2 id="docs-modal-title">Documentation — MCP tools</h2>
              <button type="button" className="modal-close" onClick={() => setDocsModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <p className="intro">
                Use <strong>Chat (MCP Client)</strong> with your Org ID and Access token, or an MCP client configured with this server.
              </p>
              {MCP_TOOLS_DOCS.map((tool) => (
                <div key={tool.name} className="doc-tool-block">
                  <h3><code>{tool.name}</code></h3>
                  <p className="doc-tool-examples"><strong>Example prompts:</strong></p>
                  <ul className="doc-tool-examples-list">
                    {tool.examplePrompts.map((prompt, i) => (
                      <li key={i}><code>{prompt}</code></li>
                    ))}
                  </ul>
                  <p className="doc-tool-desc">{tool.description}</p>
                  <p className="doc-tool-how"><strong>How to use from Chat:</strong> {tool.howToUseFromChat}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="chat-layout">
          <section className="panel chat-panel">
            <h2>Chat (MCP Client)</h2>
            <p className="intro">
              Set your <strong>Organization ID</strong> and <strong>Access token</strong> below to start chatting. The app uses them for Webex Contact Center API calls. Use <strong>Chat API base URL</strong> and <strong>MCP server URL</strong> below to point to a local server or a deployed one (e.g. App Runner). The server must have <code>CLAUDE_API_KEY</code> or <code>OPENAI_API_KEY</code> set in its environment (e.g. App Runner) so everyone can use the Chat; keys are never stored in code.
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
          Webex Contact Center:{' '}
          <a href="https://developer.webex.com/webex-contact-center/docs/webex-contact-center" target="_blank" rel="noopener noreferrer">
            API docs
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
