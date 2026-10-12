# @optix/suite-sdk

The shared pieces of the Optix suite. Every product keeps its own repo, backend, website and domain; these are the parts they have in common:

| Piece | For | Import |
|---|---|---|
| `createHub` — sign in with the Optix account, one-time SSO ticket, jump to another product | a product's website | `@optix/suite-sdk` |
| `createMessaging` — shared WhatsApp / SIM SMS / Email of the business | a product's website or backend | `@optix/suite-sdk` |
| `createVerifier`, `requireHubAuth` — trust a hub token in the product's own backend | a product's backend (Node) | `@optix/suite-sdk/node` |

No dependencies, no build step (plain ES modules, Node 20+ / any browser). See the hub contract in `docs/PRODUCT-INTEGRATION.md` of the lab repo.

```js
import { createHub, createMessaging } from '@optix/suite-sdk'

export const hub = createHub({ api: 'https://hub.example', appId: 'crm', sessionKey: 'optix_crm_session' })
export const messaging = createMessaging(hub)

// sign-in page
const result = await hub.login(business, username, password)   // { token, user, lab, apps, catalog }
hub.rememberSession(result)
if (result.apps.length > 1) showChooser(result.catalog.filter((a) => result.apps.includes(a.id)))
else if (!result.apps.includes('crm')) await hub.openApp(result.apps[0])

// #/sso?ticket=... landing page
const r = await hub.exchangeTicket(ticket)
if (!r.apps.includes('crm')) throw new Error('No access')
hub.rememberSession(r)

// menu: "Switch to ..."
hub.otherApps().forEach((app) => addMenuItem(app.name, () => hub.openApp(app.id)))
```

```js
// backend
import { createVerifier, requireHubAuth } from '@optix/suite-sdk/node'
app.use('/api', requireHubAuth(createVerifier({ api: process.env.HUB_API, appId: 'crm' })))   // req.hub = { user, lab, apps, catalog }
```

Test: `npm test`. Install in a product: `npm install github:hassnainpashapf/optix-suite-sdk#v0.1.0`.
