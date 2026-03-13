# Enterprise Integrations: ServiceNow + DigitalAi Agility

## Context

PromptToIssue currently integrates only with GitLab for issue creation. The user wants to add **ServiceNow** (ITSM) and **DigitalAi Agility** (agile work management) integrations so enterprise users can create incidents, stories, defects, and other work items directly from AI chat conversations. These two platforms are widely used in large enterprises and would significantly expand the tool's value.

The existing GitLab integration provides a well-structured pattern to follow: tool factory → OAuth routes → DB settings → chat API wiring → settings UI.

---

## Integration 1: ServiceNow

### Auth: OAuth 2.0 (instance-scoped)
- Each enterprise has its own ServiceNow instance (e.g., `https://mycompany.service-now.com`)
- User provides their instance URL in settings
- OAuth 2.0 Authorization Code flow against `https://<instance>/oauth_auth.do`
- Token endpoint: `https://<instance>/oauth_token.do`
- Tokens are Bearer tokens passed in `Authorization` header
- Env vars: `SERVICENOW_CLIENT_ID`, `SERVICENOW_CLIENT_SECRET`, `SERVICENOW_REDIRECT_URI`
- User-specific: `servicenowInstanceUrl` stored in settings

### API: ServiceNow Table API
- Base URL: `https://<instance>/api/now/table/<table_name>`
- JSON request/response with standard REST verbs
- Create incident: `POST /api/now/table/incident` with `{ "short_description": "...", "priority": "1", ... }`
- Query incidents: `GET /api/now/table/incident?sysparm_query=...&sysparm_fields=...`
- Update: `PUT /api/now/table/incident/<sys_id>`

### AI Tools to implement

| Tool | Description |
|------|-------------|
| `create_snow_incident` | Create an incident with short_description, description, priority, urgency, impact, category, assignment_group |
| `search_snow_incidents` | Search incidents by query string, state, priority, assignment_group |
| `get_snow_incident` | Get full details of an incident by number or sys_id |
| `update_snow_incident` | Update incident fields (state, priority, assignment, comments) |
| `add_snow_work_note` | Add a work note or comment to an incident |
| `create_snow_change_request` | Create a change request (table: `change_request`) |
| `search_snow_catalog` | Search the service catalog for items |

### Files to create/modify

| File | Action |
|------|--------|
| `lib/mcp/servicenow-tools.ts` | **Create** — Tool factory with Zod schemas, executors, `createServiceNowTools()` |
| `app/api/servicenow/route.ts` | **Create** — OAuth initiation (redirects to instance OAuth endpoint) |
| `app/api/servicenow/callback/route.ts` | **Create** — OAuth callback, exchange code for token, store in DB |
| `app/api/servicenow/disconnect/route.ts` | **Create** — Clear ServiceNow tokens from user settings |
| `lib/db/schema.ts` | **Modify** — Add `servicenowAccessToken`, `servicenowRefreshToken`, `servicenowTokenExpiry`, `servicenowUsername`, `servicenowInstanceUrl` to UserSettings |
| `lib/db/dynamodb.ts` | **Modify** — Handle new ServiceNow fields in read/write |
| `app/api/chat/route.ts` | **Modify** — Conditionally load and merge ServiceNow tools when token exists |
| `components/SettingsPanel.tsx` | **Modify** — Add ServiceNow section (instance URL input + connect/disconnect) |
| `components/MCPStatus.tsx` | **Modify** — Show ServiceNow connection status |
| `.env.example` | **Modify** — Add ServiceNow env vars |

---

## Integration 2: DigitalAi Agility

### Auth: Access Token (Bearer)
- DigitalAi Agility uses **Access Tokens** (not standard OAuth Authorization Code flow)
- Users create an Application in Agility admin, then generate a personal access token via the UI
- Token is passed as `Authorization: Bearer <token>` in API requests
- No OAuth dance needed — user pastes their token + instance URL in settings
- User-specific: `agilityAccessToken`, `agilityInstanceUrl` stored in settings

### API: DigitalAi Agility REST API
- Base URL: `https://<instance>/rest-1.v1/Data/<AssetType>`
- Supports both XML and JSON (use `Accept: application/json` and `Content-Type: application/json`)
- Create story: `POST /rest-1.v1/Data/Story` with asset payload
- Create defect: `POST /rest-1.v1/Data/Defect`
- Query: `GET /rest-1.v1/Data/Story?sel=Name,Description,Status&where=Scope='Scope:1005'`
- Assets reference Scopes (projects) via OID format like `Scope:1005`

### AI Tools to implement

| Tool | Description |
|------|-------------|
| `list_agility_projects` | List scopes/projects (`GET /rest-1.v1/Data/Scope`) |
| `search_agility_workitems` | Search stories/defects with filters (scope, status, team) |
| `get_agility_workitem` | Get details of a story or defect by OID |
| `create_agility_story` | Create a story in a scope with name, description, estimate, priority |
| `create_agility_defect` | Create a defect in a scope with name, description, severity, priority |
| `update_agility_workitem` | Update a story/defect (status, description, assignment) |
| `list_agility_teams` | List teams in a scope |

### Files to create/modify

| File | Action |
|------|--------|
| `lib/mcp/agility-tools.ts` | **Create** — Tool factory with Zod schemas, executors, `createAgilityTools()` |
| `app/api/agility/connect/route.ts` | **Create** — Validate and store access token + instance URL |
| `app/api/agility/disconnect/route.ts` | **Create** — Clear Agility tokens from user settings |
| `lib/db/schema.ts` | **Modify** — Add `agilityAccessToken`, `agilityInstanceUrl`, `agilityUsername` to UserSettings |
| `lib/db/dynamodb.ts` | **Modify** — Handle new Agility fields |
| `app/api/chat/route.ts` | **Modify** — Conditionally load and merge Agility tools |
| `components/SettingsPanel.tsx` | **Modify** — Add Agility section (instance URL + token input + connect/disconnect) |
| `components/MCPStatus.tsx` | **Modify** — Show Agility connection status |
| `.env.example` | **Modify** — Add Agility env vars (if any global config needed) |

Note: DigitalAi Agility does **not** use OAuth — it uses personal access tokens. So instead of OAuth routes, we create a simple `/api/agility/connect` POST endpoint that validates the token by calling the API, then stores it.

---

## Shared Changes

### `app/api/chat/route.ts` — Multi-integration tool merging
```typescript
let tools = {};

// GitLab tools
if (userSettings?.gitlabAccessToken && toolsEnabled) {
  const { createGitLabTools } = await import('@/lib/mcp/gitlab-tools');
  tools = { ...tools, ...createGitLabTools(userSettings.gitlabAccessToken, modelId) };
}

// ServiceNow tools
if (userSettings?.servicenowAccessToken && toolsEnabled) {
  const { createServiceNowTools } = await import('@/lib/mcp/servicenow-tools');
  tools = { ...tools, ...createServiceNowTools(userSettings.servicenowAccessToken, userSettings.servicenowInstanceUrl) };
}

// DigitalAi Agility tools
if (userSettings?.agilityAccessToken && toolsEnabled) {
  const { createAgilityTools } = await import('@/lib/mcp/agility-tools');
  tools = { ...tools, ...createAgilityTools(userSettings.agilityAccessToken, userSettings.agilityInstanceUrl) };
}
```

### `components/SettingsPanel.tsx` — Integration sections
Add collapsible sections for each integration in the settings panel, following the existing GitLab pattern:
- ServiceNow: Instance URL input + OAuth connect button + disconnect
- DigitalAi Agility: Instance URL input + access token input + connect/test button + disconnect

### System Prompt Updates
Update the system prompt in `lib/ai/prompts/` to inform the AI about available integrations and when to use which tools.

---

## Implementation Order

1. **ServiceNow** (OAuth flow + 7 tools + settings UI)
   - Start with `create_snow_incident` and `search_snow_incidents` as MVP
   - Add remaining tools incrementally
2. **DigitalAi Agility** (token-based + 7 tools + settings UI)
   - Start with `list_agility_projects`, `create_agility_story`, `create_agility_defect` as MVP
   - Add remaining tools incrementally
3. **Shared UI updates** (multi-integration status, settings panel)

---

## Verification

For each integration:
1. **Auth flow**: Connect → token stored in DB → disconnect clears token
2. **Tool execution**: In chat, ask "list my ServiceNow incidents" or "create a story in Agility project X" and verify API calls succeed
3. **Error handling**: Test with invalid/expired tokens — verify graceful error messages
4. **Multi-integration**: Connect both GitLab and ServiceNow simultaneously, verify both tool sets are available in chat
5. **Settings UI**: Verify connect/disconnect buttons, status indicators, and instance URL inputs work correctly
6. **Existing tests**: Run `npm test` / `npm run build` to ensure no regressions

---

## Sources
- [ServiceNow OAuth 2.0 Setup](https://www.servicenow.com/community/developer-articles/oauth-2-0-setup-in-servicenow/ta-p/3307347)
- [ServiceNow REST API Use Cases 2025](https://servicenowspectaculars.com/servicenow-rest-api-use-cases-2025/)
- [ServiceNow Table API - Creating Incidents](https://vexpose.blog/2021/04/20/creating-servicenow-incidents-via-rest-api/)
- [DigitalAi Agility Access Token Auth](https://docs.digital.ai/agility/docs/developerlibrary/access-token-authentication)
- [DigitalAi Agility API Authentication](https://docs.digital.ai/agility/docs/developerlibrary/api-authentication)
- [DigitalAi Agility REST API Tutorial](https://docs.digital.ai/agility/docs/developerlibrary/version-one-rest-api-tutorial)
- [Creating a Story in Agility](https://docs.digital.ai/agility/docs/developerlibrary/exercise-4-create-your-own-story-backlog-item-within-a-scope)
