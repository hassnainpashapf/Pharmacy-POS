# Multitenant mobile pharmacy backend

Python **3.10+**, standard library only (`http.server`, `sqlite3`, `hashlib`). Tested with Python 3.11.6. There are no third-party packages or seeded users, credentials, medicines or stock. SQLite is the supported local functional-development backend; PostgreSQL deployment/migration is deferred and not implemented here.

## Run locally

From the repository root:

```sh
python3 server/mobile_server.py
```

The default listener is `127.0.0.1:8787`; the database is `server/data/inventory.sqlite3`. The database folder is git-ignored, newly created with mode `0700`, and the database has mode `0600`. Keep the directory private to the server account. Never place it under the static web root.

Start the frontend separately. Its development proxy must forward `/api/mobile` to `http://127.0.0.1:8787`, preserving the browser's `Origin`; either preserved or rewritten Host works with the default local origins. Use the app through `http://localhost:5173` or `http://127.0.0.1:5173`. `localhost` and `127.0.0.1` have separate browser cookie stores; use one consistently. API calls are same-origin fetches; no CORS access is provided.

Create the first **platform SUPERADMIN** from the app on this computer, before exposing it to phones. Setup succeeds only when no superadmin exists, the immediate connection and any `X-Forwarded-For` addresses are loopback, the browser origin names localhost/127.0.0.1/::1, and no `Forwarded` header exists. The transaction prevents concurrent first-admin creation. Phone requests through a loopback reverse proxy do not qualify as local setup. The SUPERADMIN then provisions pharmacies and their first ADMIN accounts.

If only the API is running, this local Python command securely prompts for bootstrap credentials (no password in the command line or shell history):

```sh
python3 -c '
import getpass, json, urllib.request
body = json.dumps({"username": input("Username: "), "name": input("Name: "),
                   "password": getpass.getpass("Password (12+ characters): ")}).encode()
request = urllib.request.Request("http://127.0.0.1:8787/api/mobile/setup", data=body,
    headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8787"})
with urllib.request.urlopen(request) as response:
    print("Administrator created:", json.load(response)["user"]["username"])
'
```

### Configuration

| Environment variable | Default / behavior |
| --- | --- |
| `MOBILE_HOST` | `127.0.0.1`; keep the backend private behind a reverse proxy |
| `MOBILE_PORT` | `8787` |
| `MOBILE_DB` | `server/data/inventory.sqlite3` relative to the server script's directory |
| `MOBILE_ORIGINS` | Exact comma-separated origins; defaults to localhost and 127.0.0.1 on ports 5173 and 8787 |
| `MOBILE_SECURE_COOKIES` | `0`; set `1` behind HTTPS. An HTTPS login/setup Origin also automatically produces a Secure cookie |

CLI alternatives: `--host`, `--port`, `--database`. Custom ports/hostnames require corresponding origins. Origins cannot contain paths, trailing slashes, credentials or wildcards. The allowed Host set is derived from these origins. If a proxy rewrites Host to the backend address, include `http://127.0.0.1:8787`; the example below preserves the external Host.

## HTTPS for Android and iPhone

Both phones must reach **the same server and database**. Installable PWAs and browser camera access need a browser-trusted HTTPS origin on phones; plain LAN HTTP is insufficient. Use a TLS reverse proxy with a certificate trusted by both phones (public certificate and working DNS, or a local CA explicitly trusted on both devices). This service does not provision DNS, certificates, network access or the PWA itself.

After local first-admin setup, a deployment might run:

```sh
MOBILE_ORIGINS=https://inventory.example.com MOBILE_SECURE_COOKIES=1 python3 server/mobile_server.py
```

Example **Caddy** configuration, installed/configured separately:

```caddyfile
inventory.example.com {
    # Bootstrap remains a local computer operation.
    handle /api/mobile/setup {
        respond "Local setup only" 403
    }
    handle /api/mobile/* {
        request_body {
            max_size 64KB
        }
        reverse_proxy 127.0.0.1:8787
    }
    handle {
        root * /absolute/path/to/pharmacy-pos/dist
        try_files {path} /index.html
        file_server
    }
}
```

Replace the example domain and build output path; build the frontend before serving it. Preserve browser `Origin` and external `Host`, do not expose port 8787, and have the proxy overwrite untrusted forwarding headers. Never proxy a remote user's request with a forged localhost Origin or strip evidence of remote setup. Protect the edge with connection/body/time limits appropriate to your deployment: the standard-library HTTP listener is intended as a small private backend behind this edge, not an internet-facing production HTTP stack.

Visit the HTTPS site on each phone, sign in using a staff account created by an administrator, and use the browser's install/Add to Home Screen feature. The computer/server and proxy must stay running. Requests from phones are authenticated independently. All logins behind one reverse proxy share the backend's per-peer-IP login throttle (30 attempts per 15 minutes); apply a client-IP-aware limit at the edge for larger deployments. The in-memory throttle resets on server restart.

## Exact API contract

Base URL: `/api/mobile`. Success and errors are JSON. Every write requires `Content-Type: application/json`, a JSON object, and an exact allowed `Origin`. Browser fetch supplies Origin automatically. Requests have a 64 KiB maximum. No wildcard origins or cross-site requests are accepted. Non-browser clients must send Origin explicitly.

Errors are `{ "error": "Readable reason" }`, with HTTP `400` validation, `401` unauthenticated, `403` forbidden/CSRF, `404` missing resource, `409` conflict, `413` oversized/missing body, `415` media type, `429` throttling or `503` temporary storage errors. Unsupported methods are JSON `501`.

Sessions are opaque random 256-bit tokens in an HttpOnly, SameSite=Strict, `/api/mobile` cookie, expiring after 12 hours; HTTPS deployments use Secure. Only token hashes are stored in SQLite. Passwords use PBKDF2-HMAC-SHA256, 600,000 iterations and independent random 24-byte salts. Password resets and disabling a user invalidate that user's sessions. Role and grant changes apply on the next request, without waiting for sign-in again. Logout is idempotent.

### User object and permissions

```json
{
  "id": "opaque-generated-id",
  "tenantId": "opaque-tenant-id-or-null-for-superadmin",
  "appId": "PH-... or null",
  "pharmacyName": "Pharmacy name or null",
  "username": "staffname",
  "name": "Staff Name",
  "role": "CASHIER",
  "canManageInventory": false,
  "disabled": false
}
```

Roles: `SUPERADMIN`, `ADMIN`, `MANAGER`, `CASHIER`. Only an enabled pharmacy `ADMIN` can manage users; only `SUPERADMIN` can manage platform tenants. Admins inherently manage inventory; a manager or cashier needs an explicit `canManageInventory: true` grant. Role names alone grant no inventory write permission to non-admins. Every authenticated pharmacy user can read that pharmacy's inventory, including purchase prices. No credentials/hashes are returned.

| Method/path | Request | Success |
| --- | --- | --- |
| `GET /status` | None; public | `200 {setupRequired: boolean}` |
| `POST /setup` | `{username,password,name}`; local first-user only | `201 {user}` plus session cookie |
| `POST /login` | `{appId,username,password}`; empty `appId` is SUPERADMIN-only | `200 {user}` plus rotated session cookie |
| `POST /logout` | `{}` | `200 {ok:true}`; cookie cleared |
| `GET /session` | Session cookie | `200 {user}`; otherwise `401` |
| `GET /inventory` | Pharmacy session cookie | `200 {medicines:[...],batches:[...],permissions:{canManageInventory,canManageUsers}}` |
| `POST /medicines` | Medicine fields below, without `id`; inventory permission | `201 {medicine}` |
| `POST /stock` | Stock fields below; inventory permission | `201 {receipt,batch}`; identical retry `200` with original response |
| `GET /users` | Admin session | `200 {users:[...]}` |
| `POST /users` | `{username,password,name,role?,canManageInventory?,disabled?}`; admin | `201 {user}` |
| `PATCH /users/:id` | One or more of `{name,role,canManageInventory,disabled,password}`; admin | `200 {user}` |

Usernames are trimmed, lowercased, unique per tenant and 3–80 characters matching `[a-z0-9][a-z0-9_.@-]{2,79}`. Passwords are 12–256 characters (not trimmed); names are required, maximum 120 characters. New users default to enabled `CASHIER` with no inventory grant. Username changes and deletion are not provided. The last enabled admin cannot be disabled or demoted. `canManageInventory` in responses is the effective permission; an admin's inherent permission does not automatically grant inventory access after demotion.

### Platform provisioning

Platform routes require a SUPERADMIN session. They never accept a tenant identifier in a pharmacy
request body, and a SUPERADMIN session cannot read or mutate pharmacy inventory.

| Method/path | Request | Success |
| --- | --- | --- |
| `GET /platform/tenants` | SUPERADMIN session | `{tenants:[{id,appId,name,disabled,adminUsername,medicineCount,stockUnits,userCount}]}` |
| `POST /platform/tenants` | `{name,adminName,username,password}` | `{tenant,admin}`; generated appId |
| `PATCH /platform/tenants/:id` | `{disabled?,name?}` | `{tenant}`; disabling immediately rejects sessions/logins |
| `POST /platform/tenants/:id/reset-admin` | `{password}` | `{tenant,admin}`; invalidates that admin's sessions |

Pharmacy sessions include `tenantId`, `appId`, `pharmacyName`, and `role`; SUPERADMIN sessions have
`tenantId: null` and cannot use pharmacy endpoints. Usernames, medicine barcodes, medicine IDs,
batch IDs, and receipt idempotency are tenant-scoped. Cross-tenant IDs return not-found or forbidden
responses without disclosing the other tenant.

### Medicine object

```json
{
  "id": "generated-id",
  "name": "Medicine name",
  "generic": "Generic name",
  "barcode": "001234567890",
  "form": "Tablet",
  "strength": "10mg",
  "manufacturer": "Manufacturer",
  "packSize": 10,
  "salePrice": 5.5,
  "purchasePrice": 4.25
}
```

Required: nonempty name (max 200), numeric salePrice and purchasePrice. Optional strings default to empty; `packSize` defaults to 1 and must be an integer 1–1,000,000. generic/manufacturer max 200; form/strength max 80; barcode max 128. Nonempty barcodes are unique and case-sensitive; leading zeroes are preserved. Several medicines may have no barcode. Barcode lookup is an exact match against the authenticated inventory list; there is no separate lookup endpoint. Control characters are rejected. Prices must be finite JSON numbers from 0 to 10,000,000 with at most two decimal places, stored as integer minor units. Currency is not configured by this backend.

### Stock-in and batch objects

```json
{
  "medicineId": "generated-id",
  "batchNo": "B-001",
  "expiry": "2028-12-31",
  "qty": 12,
  "purchasePrice": 4.25,
  "salePrice": 5.5,
  "requestId": "client-generated-unique-uuid"
}
```

All fields are required. `qty` is a positive integer (max 1,000,000 per request); it is the stock unit selected by the user, **not multiplied by packSize**. Expiry must be an actual `YYYY-MM-DD` date; historical/expired stock is allowed. Batch numbers are max 100 characters. requestId must be 8–128 characters matching `[A-Za-z0-9_.:-]+`; generate a fresh UUID for each intended stock-in and retain it for uncertain-network retries.

```json
{
  "receipt": {
    "id": "client-generated-unique-uuid",
    "requestId": "client-generated-unique-uuid",
    "medicineId": "generated-id",
    "batchId": "generated-batch-id",
    "qty": 12,
    "createdAt": "2026-09-30T12:00:00+00:00"
  },
  "batch": {
    "id": "generated-batch-id",
    "medicineId": "generated-id",
    "batchNo": "B-001",
    "expiry": "2028-12-31",
    "qty": 12,
    "purchasePrice": 4.25,
    "salePrice": 5.5
  }
}
```

Stock additions and receipts commit in one immediate SQLite transaction. Same requestId + same normalized payload + same pharmacy user returns the original receipt and batch snapshot without adding stock. A reused ID with different data for that tenant/user returns `409`; another tenant or user has an independent idempotency namespace. Authorization is rechecked before a replay. The response's batch is a historical snapshot on replay: refresh `GET /inventory` for current totals.

The same medicine and batch number accumulate quantity only when expiry and prices match; conflicts return `409`. Total batch quantity is capped at 1,000,000,000. Adding stock does not modify the medicine's catalog prices. Neither failed validation nor conflicting retries leave partial inventory updates.

## Scope, backups and limitations

- On first start against the former single-tenant schema, the server creates a private SQLite backup named `inventory.sqlite3.pre-multitenant-<random>.bak`, migrates all users, medicines, batches and receipts into the explicit `LEGACY` pharmacy, and invalidates old sessions. It checks row counts and foreign keys before committing. Do not delete the backup until it is independently retained. Migration is local-only and does not run against a remote or production database from the test suite.
- Existing desktop/localStorage products, sales, users and stock are not synchronized beyond this one-time legacy SQLite migration. Inventory added here does not automatically update legacy checkout, purchasing or reports.
- Available writes are medicine creation, stock-in and user management. No medicine editing, stock-out, sales integration, negative adjustments, stock transfers or receipt-list endpoint exists. The stock receipt table is an append-only record of successful stock-in, not a comprehensive audit log.
- Connectivity to the shared server is required. There is no offline mutation queue, peer-to-peer synchronization, push update or background synchronization guarantee. Clients must refresh inventory after writes and to see another phone's changes. Keep API responses out of frontend/service-worker caches; the API sends `Cache-Control: no-store`.
- Single SQLite service/database deployment, integer stock quantities and two-decimal prices. PostgreSQL is a deferred follow-up, not an available migration target. No schema migration framework, password reset email, MFA or built-in account recovery is included. Keep at least one working administrator account. Credentials and sessions exist only in your private database; no default password or emergency backdoor exists.
- Back up using SQLite's backup API, or stop the server and copy the database. Do not copy just the main file while it is running in WAL mode. Example consistent backup: `python3 -c 'import sqlite3; s=sqlite3.connect("server/data/inventory.sqlite3"); d=sqlite3.connect("/private/backup/inventory.sqlite3"); s.backup(d); d.close(); s.close()'`. Create the destination privately first and protect backup files because they contain password hashes and live session records. Never add them to source control. Restoring while the server is stopped restores accounts, stock, receipts and sessions together.

## Tests

```sh
python3 -m unittest server.test_mobile_server -v
```

Tests use temporary private SQLite files, ephemeral loopback HTTP ports and reduced password iterations **only via the test constructor**. Runtime always defaults to 600,000; no runtime environment knob weakens it. Coverage includes local-only bootstrap, empty inventory, credentials/session hashing, cookie flags, CSRF/Host rejection, unauthenticated and role denials, grant revocation, disabled accounts, password-reset session invalidation, last-admin protection, unique/blank barcodes, money/date/quantity validation, atomic stock-in, simultaneous retry idempotency, request ownership, restart persistence, expiry and login throttling. No real database is created by the tests.
