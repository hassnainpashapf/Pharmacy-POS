#!/usr/bin/env python3
"""Authenticated shared inventory API. Run: python3 server/mobile_server.py."""

import argparse
import datetime as dt
import hashlib
import hmac
import ipaddress
import json
import math
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid
from decimal import Decimal
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

PREFIX = "/api/mobile"
COOKIE = "pharmacy_mobile_session"
SESSION_SECONDS = 12 * 60 * 60
MAX_BODY = 64 * 1024
ROLES = {"ADMIN", "MANAGER", "PHARMACIST", "CASHIER", "RECEPTIONIST"}
DEFAULT_ORIGINS = (
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8787", "http://127.0.0.1:8787",
)


class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def fail(message, status=400):
    raise APIError(status, message)


def text(data, key, maximum=200, required=False):
    value = data.get(key, "")
    if not isinstance(value, str) or len(value) > maximum:
        fail(f"{key} must be text of at most {maximum} characters")
    value = value.strip()
    if required and not value:
        fail(f"{key} is required")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        fail(f"{key} cannot contain control characters")
    return value


def integer(data, key, minimum=0, maximum=1_000_000, default=None):
    value = data.get(key, default)
    if type(value) is not int or not minimum <= value <= maximum:
        fail(f"{key} must be an integer from {minimum} to {maximum}")
    return value


def money(data, key):
    value = data.get(key)
    if type(value) not in (float, int) or (isinstance(value, float) and not math.isfinite(value)):
        fail(f"{key} must be a finite number")
    if not 0 <= value <= 10_000_000:
        fail(f"{key} must be between 0 and 10000000")
    amount = Decimal(str(value))
    if amount < 0 or amount > 10_000_000 or amount != amount.quantize(Decimal("0.01")):
        fail(f"{key} must be between 0 and 10000000 with at most two decimal places")
    return int(amount * 100)


def boolean(data, key, default=False):
    value = data.get(key, default)
    if type(value) is not bool:
        fail(f"{key} must be true or false")
    return value


def username(data):
    val = text(data, "email", 120) or text(data, "username", 120, True)
    value = val.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_.+@-]{2,119}", value):
        fail("username or email must be 3–120 letters, digits, dots, underscores, @, + or hyphens")
    return value


def password(data):
    value = data.get("password")
    if not isinstance(value, str) or not 12 <= len(value) <= 256:
        fail("password must contain 12–256 characters")
    return value


def public_user(row):
    keys = row.keys() if hasattr(row, 'keys') else []
    email_val = row["email"] if ("email" in keys and row["email"]) else row["username"]
    return {"id": row["id"], "username": row["username"], "email": email_val, "name": row["name"],
            "tenantId": row["tenant_id"], "appId": row["app_id"], "pharmacyName": row["pharmacy_name"],
            "role": row["role"], "canManageInventory": row["role"] != "SUPERADMIN" and (row["role"] == "ADMIN" or bool(row["can_manage_inventory"])),
            "disabled": bool(row["disabled"])}


def medicine(row):
    return {"id": row["id"], "name": row["name"], "generic": row["generic"],
            "barcode": row["barcode"] or "", "form": row["form"], "strength": row["strength"],
            "manufacturer": row["manufacturer"], "packSize": row["pack_size"],
            "salePrice": row["sale_cents"] / 100, "purchasePrice": row["purchase_cents"] / 100}


def batch(row):
    return {"id": row["id"], "medicineId": row["medicine_id"], "batchNo": row["batch_no"],
            "expiry": row["expiry"], "qty": row["qty"],
            "purchasePrice": row["purchase_cents"] / 100, "salePrice": row["sale_cents"] / 100}


USER_SELECT = "SELECT u.*, t.app_id, t.name AS pharmacy_name, t.disabled AS tenant_disabled FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id "
SCHEMA_VERSION = 2
LEGACY_TENANT_ID = "00000000000000000000000000000001"

SCHEMA = """
CREATE TABLE IF NOT EXISTS tenants (
 id TEXT PRIMARY KEY, app_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 admin_user_id TEXT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('SUPERADMIN','ADMIN','MANAGER','PHARMACIST','CASHIER','RECEPTIONIST')),
 can_manage_inventory INTEGER NOT NULL DEFAULT 0 CHECK(can_manage_inventory IN (0,1)),
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 tenant_id TEXT REFERENCES tenants(id),
 email TEXT,
 CHECK((role='SUPERADMIN' AND tenant_id IS NULL AND can_manage_inventory=0) OR (role!='SUPERADMIN' AND tenant_id IS NOT NULL)),
 UNIQUE(tenant_id, username), UNIQUE(tenant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS superadmin_username ON users(username) WHERE tenant_id IS NULL;
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS medicines (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, generic TEXT NOT NULL, barcode TEXT,
 form TEXT NOT NULL, strength TEXT NOT NULL, manufacturer TEXT NOT NULL,
 pack_size INTEGER NOT NULL CHECK(pack_size > 0), purchase_cents INTEGER NOT NULL CHECK(purchase_cents >= 0),
 sale_cents INTEGER NOT NULL CHECK(sale_cents >= 0),
 tenant_id TEXT NOT NULL REFERENCES tenants(id), UNIQUE(tenant_id, barcode), UNIQUE(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS batches (
 id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL REFERENCES medicines(id), batch_no TEXT NOT NULL,
 expiry TEXT NOT NULL, qty INTEGER NOT NULL CHECK(qty >= 0),
 purchase_cents INTEGER NOT NULL CHECK(purchase_cents >= 0), sale_cents INTEGER NOT NULL CHECK(sale_cents >= 0),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  FOREIGN KEY(tenant_id, medicine_id) REFERENCES medicines(tenant_id, id),
  UNIQUE(tenant_id, medicine_id, batch_no)
);
CREATE TABLE IF NOT EXISTS stock_receipts (
 request_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), payload_hash TEXT NOT NULL,
 response TEXT NOT NULL, created_at TEXT NOT NULL,
 tenant_id TEXT NOT NULL REFERENCES tenants(id),
 FOREIGN KEY(tenant_id, user_id) REFERENCES users(tenant_id, id),
 PRIMARY KEY(tenant_id, user_id, request_id)
);
"""


def initialize_database(db, db_path):
    """Atomic v1 -> v2 upgrade, with a consistent private pre-migration backup."""
    db.execute("BEGIN IMMEDIATE")
    try:
        version = db.execute("PRAGMA user_version").fetchone()[0]
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if version == SCHEMA_VERSION:
            cols = {row[1] for row in db.execute("PRAGMA table_info(users)")}
            if "email" not in cols:
                db.execute("ALTER TABLE users ADD COLUMN email TEXT")
            db.commit()
            return
        if version not in (0, 1):
            raise RuntimeError(f"Unsupported database schema version: {version}")
        legacy = "users" in tables
        old_tables = ("users", "sessions", "medicines", "batches", "stock_receipts")
        if tables and (not legacy or tables != set(old_tables) or
                       "tenant_id" in {row[1] for row in db.execute("PRAGMA table_info(users)")}):
            raise RuntimeError("Unrecognized database schema; refusing automatic migration")
        if legacy:
            backup_path = db_path.with_name(db_path.name + ".pre-multitenant-" + uuid.uuid4().hex + ".bak")
            fd = os.open(backup_path, os.O_CREAT | os.O_EXCL | os.O_RDWR, 0o600)
            os.close(fd)
            # Read from a separate connection: the reserved write lock prevents
            # concurrent writes while allowing backup of the committed snapshot.
            source = sqlite3.connect(db_path)
            destination = sqlite3.connect(backup_path)
            try:
                source.backup(destination)
            finally:
                destination.close()
                source.close()
            for table in old_tables:
                db.execute(f"ALTER TABLE {table} RENAME TO legacy_{table}")
        for statement in SCHEMA.split(";"):
            if statement.strip():
                db.execute(statement)
        if legacy:
            db.execute("INSERT INTO tenants(id,app_id,name) VALUES (?,?,?)",
                       (LEGACY_TENANT_ID, "LEGACY", "Legacy Pharmacy"))
            for table in ("users", "medicines", "batches", "stock_receipts"):
                columns = [row[1] for row in db.execute(f"PRAGMA table_info(legacy_{table})")]
                names = ",".join(columns)
                db.execute(f"INSERT INTO {table} ({names},tenant_id) SELECT {names},? FROM legacy_{table}",
                           (LEGACY_TENANT_ID,))
                if db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] != db.execute(f"SELECT COUNT(*) FROM legacy_{table}").fetchone()[0]:
                    raise RuntimeError("Migration row count mismatch")
            admin = db.execute("SELECT id FROM users WHERE role='ADMIN' ORDER BY disabled,username LIMIT 1").fetchone()
            if admin:
                db.execute("UPDATE tenants SET admin_user_id=? WHERE id=?", (admin[0], LEGACY_TENANT_ID))
            # Session invalidation is intentional. Keep renamed source tables as an
            # in-database archive as well as the backup: migration never silently
            # deletes the original rows.
        if db.execute("PRAGMA foreign_key_check").fetchone():
            raise RuntimeError("Migration foreign key check failed")
        db.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
        db.commit()
        if legacy:
            print(f"Migrated inventory to LEGACY pharmacy; old sessions invalidated and source tables archived. Backup: {backup_path}", flush=True)
    except Exception:
        db.rollback()
        raise


class InventoryServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, db_path, origins=DEFAULT_ORIGINS, secure_cookies=False, password_rounds=600_000):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.origins = set(origins)
        if not self.origins or any(not self.valid_origin(origin) for origin in self.origins):
            raise ValueError("Origins must be exact http(s) origins without a path, credentials or wildcard")
        self.allowed_hosts = {urlsplit(origin).netloc.lower() for origin in self.origins}
        self.secure_cookies = secure_cookies
        self.password_rounds = password_rounds
        self.attempts = {}
        self.attempt_lock = threading.Lock()
        # Restrict even the initial SQLite file creation; sidecars inherit restrictive mode.
        fd = os.open(self.db_path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        os.chmod(self.db_path, 0o600)
        db = self.connect()
        try:
            db.execute("PRAGMA journal_mode=WAL")
            initialize_database(db, self.db_path)
        finally:
            db.close()
        super().__init__(address, Handler)

    @staticmethod
    def valid_origin(origin):
        try:
            parsed = urlsplit(origin)
            return (parsed.scheme in ("http", "https") and parsed.hostname and parsed.port != 0
                    and not parsed.username and not parsed.password and not parsed.path
                    and not parsed.query and not parsed.fragment and "*" not in origin)
        except ValueError:
            return False

    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def hash_password(self, value):
        salt = secrets.token_bytes(24)
        digest = hashlib.pbkdf2_hmac("sha256", value.encode(), salt, self.password_rounds)
        return f"pbkdf2_sha256${self.password_rounds}${salt.hex()}${digest.hex()}"

    def verify_password(self, value, stored):
        _, rounds, salt, expected = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", value.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(digest.hex(), expected)

    def rate_limit_login(self, ip):
        now = time.monotonic()
        with self.attempt_lock:
            self.attempts = {key: times for key, times in self.attempts.items() if times[-1] > now - 900}
            attempts = [value for value in self.attempts.get(ip, []) if value > now - 900]
            if len(attempts) >= 30:
                fail("Too many login attempts; try again in 15 minutes", 429)
            attempts.append(now)
            self.attempts[ip] = attempts


class Handler(BaseHTTPRequestHandler):
    server_version = "InventoryAPI"

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def log_message(self, format, *args):
        # Never record request bodies, cookies, usernames or URL query strings.
        return

    def send_json(self, status, payload, cookie=None):
        body = json.dumps(payload, allow_nan=False, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_error(self, code, message=None, explain=None):
        self.send_json(code, {"error": message or HTTPStatus(code).phrase})

    def cookie(self, token, max_age=SESSION_SECONDS):
        secure = self.server.secure_cookies or self.headers.get("Origin", "").startswith("https://")
        return (f"{COOKIE}={token}; Path={PREFIX}; Max-Age={max_age}; HttpOnly; SameSite=Strict"
                + ("; Secure" if secure else ""))

    def token_hash(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
            token = cookies[COOKIE].value if COOKIE in cookies else ""
        except Exception:
            token = ""
        return hashlib.sha256(token.encode()).hexdigest()

    def read_json(self):
        if self.headers.get("Transfer-Encoding"):
            fail("Transfer-Encoding is not supported")
        if self.headers.get_content_type() != "application/json":
            fail("Content-Type must be application/json", 415)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            fail("Invalid Content-Length")
        if not 1 <= length <= MAX_BODY:
            fail("JSON request body must be 1–65536 bytes", 413)
        try:
            body = self.rfile.read(length)
            data = json.loads(body, parse_constant=lambda value: fail("Non-finite numbers are not allowed"))
        except (ValueError, UnicodeDecodeError, RecursionError):
            fail("Invalid JSON")
        if not isinstance(data, dict):
            fail("JSON body must be an object")
        return data

    def check_request(self, write):
        host = self.headers.get("Host", "").lower()
        if host not in self.server.allowed_hosts:
            fail("Host is not allowed", 403)
        origin = self.headers.get("Origin")
        if origin is not None and origin not in self.server.origins:
            fail("Origin is not allowed", 403)
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            fail("Cross-site requests are not allowed", 403)
        if write and not origin:
            fail("Origin header is required", 403)

    def authenticate(self, db, manage=False, admin=False, platform=False, session=False):
        user = db.execute(USER_SELECT + "JOIN sessions s ON u.id=s.user_id "
                          "WHERE s.token_hash=? AND s.expires>? AND u.disabled=0 AND (u.tenant_id IS NULL OR t.disabled=0)",
                          (self.token_hash(), int(time.time()))).fetchone()
        if not user:
            fail("Sign in required", 401)
        if platform and user["role"] != "SUPERADMIN":
            fail("Superadmin permission required", 403)
        if not platform and not session and user["tenant_id"] is None:
            fail("Sign in to a pharmacy to access pharmacy data", 403)
        if admin and user["role"] != "ADMIN":
            fail("Administrator permission required", 403)
        if manage and user["role"] != "ADMIN" and not user["can_manage_inventory"]:
            fail("Inventory management permission required", 403)
        return user

    def do_GET(self):
        self.handle_api(False)

    def do_POST(self):
        self.handle_api(True)

    def do_PATCH(self):
        self.handle_api(True)

    def handle_api(self, write):
        db = None
        try:
            self.check_request(write)
            path = urlsplit(self.path).path
            if not path.startswith(PREFIX + "/"):
                fail("Endpoint not found", 404)
            data = self.read_json() if write else {}
            db = self.server.connect()
            # Serialize writes before authentication: permission revocation and stock
            # additions cannot race with an authorization decision.
            db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            status, response, cookie = self.route(db, path[len(PREFIX):], data)
            db.commit()
            self.send_json(status, response, cookie)
        except APIError as error:
            if db:
                db.rollback()
            self.send_json(error.status, {"error": error.message})
        except sqlite3.IntegrityError:
            if db:
                db.rollback()
            self.send_json(409, {"error": "A username, barcode or stock request already exists"})
        except (sqlite3.Error, OSError):
            if db:
                db.rollback()
            self.send_json(503, {"error": "Inventory storage is temporarily unavailable"})
        except Exception:
            if db:
                db.rollback()
            self.send_json(500, {"error": "Unable to process request"})
        finally:
            if db:
                db.close()

    def route(self, db, path, data):
        method = self.command
        if "tenantId" in data or "tenant_id" in data:
            fail("Tenant ownership cannot be supplied by the client")
        if path == "/status" and method == "GET":
            return 200, {"setupRequired": not bool(db.execute("SELECT 1 FROM users WHERE role='SUPERADMIN' LIMIT 1").fetchone())}, None
        if path == "/setup" and method == "POST":
            # An external reverse proxy is often a loopback peer. Require a local
            # browser origin as well, and refuse forwarded remote addresses.
            origin_host = urlsplit(self.headers.get("Origin", "")).hostname
            forwarded = self.headers.get("X-Forwarded-For", "")
            local_forwarded = all(self.is_loopback(part.strip()) for part in forwarded.split(",") if part.strip())
            if (not self.is_loopback(self.client_address[0]) or origin_host not in ("localhost", "127.0.0.1", "::1")
                    or not local_forwarded or self.headers.get("Forwarded")):
                fail("First administrator setup is available only from localhost", 403)
            if db.execute("SELECT 1 FROM users WHERE role='SUPERADMIN' LIMIT 1").fetchone():
                fail("Setup has already been completed", 409)
            if set(data) - {"username", "password", "name"}:
                fail("Setup accepts username, password and name")
            user = self.create_user(db, data, tenant_id=None, first=True)
            cookie = self.new_session(db, user["id"])
            return 201, {"user": user}, cookie
        if path == "/login" and method == "POST":
            self.server.rate_limit_login(self.client_address[0])
            name = username(data)
            app_id = text(data, "appId", 80).upper()
            secret = data.get("password", "")
            if not isinstance(secret, str) or len(secret) > 256:
                fail("Invalid username or password", 401)
            cols = {row[1] for row in db.execute("PRAGMA table_info(users)")}
            email_clause = " OR LOWER(COALESCE(u.email,''))=?" if "email" in cols else ""
            if app_id:
                if app_id in ("SUPERADMIN", "PLATFORM"):
                    query = USER_SELECT + f"WHERE (LOWER(u.username)=?{email_clause}) AND u.tenant_id IS NULL AND u.role='SUPERADMIN'"
                    user = db.execute(query, (name, name) if email_clause else (name,)).fetchone()
                else:
                    query = USER_SELECT + f"WHERE (LOWER(u.username)=?{email_clause}) AND t.app_id=?"
                    user = db.execute(query, (name, name, app_id) if email_clause else (name, app_id)).fetchone()
            else:
                query = USER_SELECT + f"WHERE LOWER(u.username)=?{email_clause}"
                user = db.execute(query, (name, name) if email_clause else (name,)).fetchone()
            if user:
                valid = self.server.verify_password(secret, user["password_hash"])
            else:
                hashlib.pbkdf2_hmac("sha256", secret.encode(), b"missing-user-timing-salt", self.server.password_rounds)
                valid = False
            if not valid or user["disabled"] or (user["tenant_id"] and user["tenant_disabled"]):
                fail("Invalid username or password", 401)
            cookie = self.new_session(db, user["id"])
            return 200, {"user": public_user(user)}, cookie
        if path == "/sync" and method == "POST":
            user = self.authenticate(db)
            tenant_id = user["tenant_id"]
            if not tenant_id:
                fail("Tenant sync only available for pharmacy stations", 403)
            offline_sales = data.get("offlineSales", []) if isinstance(data, dict) else []
            if not isinstance(offline_sales, list):
                fail("offlineSales must be a list")
            meds = [medicine(row) for row in db.execute("SELECT * FROM medicines WHERE tenant_id=? ORDER BY name, id", (tenant_id,))]
            batches = [batch(row) for row in db.execute("SELECT * FROM batches WHERE tenant_id=? ORDER BY expiry, id", (tenant_id,))]
            users = [public_user(row) for row in db.execute(USER_SELECT + "WHERE u.tenant_id=? AND u.disabled=0 ORDER BY u.username", (tenant_id,))]
            return 200, {
                "ok": True,
                "serverTime": dt.datetime.now(dt.timezone.utc).isoformat(),
                "medicines": meds,
                "batches": batches,
                "users": users,
                "syncedSalesCount": len(offline_sales),
                "permissions": {
                    "canManageInventory": public_user(user)["canManageInventory"],
                    "canManageUsers": user["role"] == "ADMIN"
                }
            }, None
        if path == "/logout" and method == "POST":
            db.execute("DELETE FROM sessions WHERE token_hash=?", (self.token_hash(),))
            return 200, {"ok": True}, self.cookie("", 0)
        if path == "/session" and method == "GET":
            return 200, {"user": public_user(self.authenticate(db, session=True))}, None
        if path == "/platform/tenants" or path.startswith("/platform/tenants/"):
            self.authenticate(db, platform=True)
            return self.platform_tenants(db, path, data)
        if path == "/inventory" and method == "GET":
            user = self.authenticate(db)
            return 200, {"medicines": [medicine(row) for row in db.execute("SELECT * FROM medicines WHERE tenant_id=? ORDER BY name, id", (user["tenant_id"],))],
                         "batches": [batch(row) for row in db.execute("SELECT * FROM batches WHERE tenant_id=? ORDER BY expiry, id", (user["tenant_id"],))],
                         "permissions": {"canManageInventory": public_user(user)["canManageInventory"],
                                         "canManageUsers": user["role"] == "ADMIN"}}, None
        if path == "/medicines" and method == "POST":
            user = self.authenticate(db, manage=True)
            if set(data) - {"name", "generic", "barcode", "form", "strength", "manufacturer", "packSize", "purchasePrice", "salePrice"}:
                fail("Unknown medicine fields")
            ident = uuid.uuid4().hex
            db.execute("INSERT INTO medicines VALUES (?,?,?,?,?,?,?,?,?,?,?)", (
                ident, text(data, "name", 200, True), text(data, "generic"),
                text(data, "barcode", 128) or None, text(data, "form", 80), text(data, "strength", 80),
                text(data, "manufacturer"), integer(data, "packSize", 1, default=1),
                money(data, "purchasePrice"), money(data, "salePrice"), user["tenant_id"]))
            return 201, {"medicine": medicine(db.execute("SELECT * FROM medicines WHERE id=? AND tenant_id=?", (ident, user["tenant_id"])).fetchone())}, None
        if path == "/stock" and method == "POST":
            user = self.authenticate(db, manage=True)
            return self.add_stock(db, user, data)
        if path == "/users" and method in ("GET", "POST"):
            user = self.authenticate(db, admin=True)
            if method == "GET":
                return 200, {"users": [public_user(row) for row in db.execute(USER_SELECT + "WHERE u.tenant_id=? ORDER BY u.username", (user["tenant_id"],))]}, None
            return 201, {"user": self.create_user(db, data, user["tenant_id"])}, None
        if re.fullmatch(r"/users/[a-f0-9]{32}", path) and method == "PATCH":
            user = self.authenticate(db, admin=True)
            return 200, {"user": self.update_user(db, path.rsplit("/", 1)[1], data, user["tenant_id"])}, None
        fail("Endpoint not found", 404)

    def tenant_summary(self, db, ident):
        row = db.execute("SELECT t.*, u.username AS admin_username, "
                         "(SELECT COUNT(*) FROM medicines m WHERE m.tenant_id=t.id) AS medicine_count, "
                         "(SELECT COALESCE(SUM(qty),0) FROM batches b WHERE b.tenant_id=t.id) AS stock_units, "
                         "(SELECT COUNT(*) FROM users s WHERE s.tenant_id=t.id) AS user_count "
                         "FROM tenants t LEFT JOIN users u ON u.id=t.admin_user_id AND u.tenant_id=t.id WHERE t.id=?", (ident,)).fetchone()
        if not row:
            fail("Pharmacy not found", 404)
        return {"id": row["id"], "appId": row["app_id"], "name": row["name"], "disabled": bool(row["disabled"]),
                "adminUsername": row["admin_username"], "medicineCount": row["medicine_count"],
                "stockUnits": row["stock_units"], "userCount": row["user_count"]}

    def platform_tenants(self, db, path, data):
        if path == "/platform/tenants":
            if self.command == "GET":
                return 200, {"tenants": [self.tenant_summary(db, row[0]) for row in db.execute("SELECT id FROM tenants ORDER BY name,id")]}, None
            if self.command == "POST":
                if set(data) - {"name", "adminName", "username", "email", "password"}:
                    fail("Provisioning accepts name, adminName, email, username and password")
                user_email = (text(data, "email", 120) or text(data, "username", 120, True)).strip().lower()
                ident, app_id = uuid.uuid4().hex, "PH-" + secrets.token_hex(6).upper()
                db.execute("INSERT INTO tenants(id,app_id,name) VALUES (?,?,?)", (ident, app_id, text(data, "name", 200, True)))
                admin = self.create_user(db, {"username": user_email, "email": user_email, "password": data.get("password"),
                                             "name": text(data, "adminName", 120, True), "role": "ADMIN"}, ident)
                db.execute("UPDATE tenants SET admin_user_id=? WHERE id=?", (admin["id"], ident))
                return 201, {"tenant": self.tenant_summary(db, ident), "admin": admin}, None
        match = re.fullmatch(r"/platform/tenants/([a-f0-9]{32})(/reset-admin)?", path)
        if match:
            ident, reset = match.groups()
            tenant = db.execute("SELECT * FROM tenants WHERE id=?", (ident,)).fetchone()
            if not tenant:
                fail("Pharmacy not found", 404)
            if reset and self.command == "POST":
                if set(data) != {"password"}:
                    fail("Reset accepts password only")
                admin = db.execute("SELECT * FROM users WHERE id=? AND tenant_id=?", (tenant["admin_user_id"], ident)).fetchone()
                if not admin:
                    fail("Pharmacy has no provisioned administrator", 409)
                db.execute("UPDATE users SET password_hash=? WHERE id=? AND tenant_id=?",
                           (self.server.hash_password(password(data)), admin["id"], ident))
                db.execute("DELETE FROM sessions WHERE user_id=?", (admin["id"],))
                return 200, {"tenant": self.tenant_summary(db, ident),
                             "admin": public_user(db.execute(USER_SELECT + "WHERE u.id=? AND u.tenant_id=?", (admin["id"], ident)).fetchone())}, None
            if not reset and self.command == "PATCH":
                if not data or set(data) - {"disabled", "name"}:
                    fail("Update accepts disabled and name")
                disabled = boolean(data, "disabled", bool(tenant["disabled"]))
                name = text(data, "name", 200, True) if "name" in data else tenant["name"]
                db.execute("UPDATE tenants SET disabled=?,name=? WHERE id=?", (disabled, name, ident))
                if disabled:
                    db.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id=?)", (ident,))
                return 200, {"tenant": self.tenant_summary(db, ident)}, None
        fail("Endpoint not found", 404)

    @staticmethod
    def is_loopback(value):
        try:
            return ipaddress.ip_address(value).is_loopback
        except ValueError:
            return False

    def new_session(self, db, user_id):
        db.execute("DELETE FROM sessions WHERE expires<=? OR token_hash=?", (int(time.time()), self.token_hash()))
        token = secrets.token_urlsafe(32)
        db.execute("INSERT INTO sessions VALUES (?,?,?)", (
            hashlib.sha256(token.encode()).hexdigest(), user_id, int(time.time()) + SESSION_SECONDS))
        return self.cookie(token)

    def create_user(self, db, data, tenant_id, first=False):
        if set(data) - {"username", "email", "password", "name", "role", "canManageInventory", "disabled"}:
            fail("Unknown user fields")
        role = "SUPERADMIN" if first else data.get("role", "CASHIER")
        if not first and (not isinstance(role, str) or role not in ROLES):
            fail(f"role must be one of {', '.join(sorted(ROLES))}")
        ident = uuid.uuid4().hex
        u_name = username(data)
        u_email = text(data, "email", 120) or u_name
        cols = {row[1] for row in db.execute("PRAGMA table_info(users)")}
        if "email" in cols:
            db.execute("INSERT INTO users (id, username, name, password_hash, role, can_manage_inventory, disabled, tenant_id, email) VALUES (?,?,?,?,?,?,?,?,?)", (
                ident, u_name, text(data, "name", 120, True), self.server.hash_password(password(data)),
                role, False if first else boolean(data, "canManageInventory"),
                False if first else boolean(data, "disabled"), tenant_id, u_email))
        else:
            db.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)", (
                ident, u_name, text(data, "name", 120, True), self.server.hash_password(password(data)),
                role, False if first else boolean(data, "canManageInventory"),
                False if first else boolean(data, "disabled"), tenant_id))
        return public_user(db.execute(USER_SELECT + "WHERE u.id=? AND u.tenant_id IS ?", (ident, tenant_id)).fetchone())

    def update_user(self, db, ident, data, tenant_id):
        unknown = set(data) - {"name", "email", "role", "canManageInventory", "disabled", "password"}
        if unknown or not data:
            fail("Update accepts name, email, role, canManageInventory, disabled and password")
        current = db.execute("SELECT * FROM users WHERE id=? AND tenant_id=?", (ident, tenant_id)).fetchone()
        if not current:
            fail("User not found", 404)
        role = data.get("role", current["role"])
        if not isinstance(role, str) or role not in ROLES:
            fail(f"role must be one of {', '.join(sorted(ROLES))}")
        disabled = boolean(data, "disabled", bool(current["disabled"]))
        if current["role"] == "ADMIN" and not current["disabled"] and (role != "ADMIN" or disabled):
            if db.execute("SELECT COUNT(*) FROM users WHERE tenant_id=? AND role='ADMIN' AND disabled=0", (tenant_id,)).fetchone()[0] <= 1:
                fail("At least one enabled administrator must remain", 409)
        new_hash = self.server.hash_password(password(data)) if "password" in data else current["password_hash"]
        cols = {row[1] for row in db.execute("PRAGMA table_info(users)")}
        if "email" in cols and "email" in data:
            db.execute("UPDATE users SET name=?,email=?,role=?,can_manage_inventory=?,disabled=?,password_hash=? WHERE id=? AND tenant_id=?", (
                text(data, "name", 120, True) if "name" in data else current["name"],
                text(data, "email", 120).strip().lower(),
                role, boolean(data, "canManageInventory", bool(current["can_manage_inventory"])), disabled, new_hash, ident, tenant_id))
        else:
            db.execute("UPDATE users SET name=?,role=?,can_manage_inventory=?,disabled=?,password_hash=? WHERE id=? AND tenant_id=?", (
                text(data, "name", 120, True) if "name" in data else current["name"], role,
                boolean(data, "canManageInventory", bool(current["can_manage_inventory"])), disabled, new_hash, ident, tenant_id))
        if disabled or "password" in data:
            db.execute("DELETE FROM sessions WHERE user_id=?", (ident,))
        return public_user(db.execute(USER_SELECT + "WHERE u.id=? AND u.tenant_id=?", (ident, tenant_id)).fetchone())

    def add_stock(self, db, user, data):
        if set(data) - {"requestId", "medicineId", "batchNo", "expiry", "qty", "purchasePrice", "salePrice"}:
            fail("Unknown stock fields")
        tenant_id = user["tenant_id"]
        request_id = text(data, "requestId", 128, True)
        if not re.fullmatch(r"[A-Za-z0-9_.:-]{8,128}", request_id):
            fail("requestId must be 8–128 letters, digits, dots, colons, underscores or hyphens")
        medicine_id = text(data, "medicineId", 64, True)
        batch_no = text(data, "batchNo", 100, True)
        expiry = text(data, "expiry", 10, True)
        try:
            if dt.date.fromisoformat(expiry).isoformat() != expiry:
                raise ValueError()
        except ValueError:
            fail("expiry must be a valid YYYY-MM-DD date")
        qty = integer(data, "qty", 1)
        purchase, sale = money(data, "purchasePrice"), money(data, "salePrice")
        canonical = json.dumps([medicine_id, batch_no, expiry, qty, purchase, sale], separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        previous = db.execute("SELECT * FROM stock_receipts WHERE request_id=? AND tenant_id=? AND user_id=?", (request_id, tenant_id, user["id"])).fetchone()
        if previous:
            if previous["user_id"] != user["id"] or previous["payload_hash"] != digest:
                fail("requestId was already used for a different stock request", 409)
            return 200, json.loads(previous["response"]), None
        if not db.execute("SELECT 1 FROM medicines WHERE id=? AND tenant_id=?", (medicine_id, tenant_id)).fetchone():
            fail("Medicine not found", 404)
        existing = db.execute("SELECT * FROM batches WHERE medicine_id=? AND batch_no=? AND tenant_id=?", (medicine_id, batch_no, tenant_id)).fetchone()
        ident = existing["id"] if existing else uuid.uuid4().hex
        if existing:
            if (existing["expiry"], existing["purchase_cents"], existing["sale_cents"]) != (expiry, purchase, sale):
                fail("Existing batch expiry and prices must match; use a distinct batch number", 409)
            if existing["qty"] + qty > 1_000_000_000:
                fail("Batch quantity limit exceeded", 409)
            db.execute("UPDATE batches SET qty=qty+? WHERE id=? AND tenant_id=?", (qty, ident, tenant_id))
        else:
            db.execute("INSERT INTO batches VALUES (?,?,?,?,?,?,?,?)", (ident, medicine_id, batch_no, expiry, qty, purchase, sale, tenant_id))
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        response = {"receipt": {"id": request_id, "requestId": request_id, "medicineId": medicine_id,
                                "batchId": ident, "qty": qty, "createdAt": now},
                    "batch": batch(db.execute("SELECT * FROM batches WHERE id=? AND tenant_id=?", (ident, tenant_id)).fetchone())}
        db.execute("INSERT INTO stock_receipts VALUES (?,?,?,?,?,?)", (request_id, user["id"], digest, json.dumps(response), now, tenant_id))
        return 201, response, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=os.environ.get("MOBILE_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("MOBILE_PORT", "8787")))
    parser.add_argument("--database", default=os.environ.get("MOBILE_DB", str(Path(__file__).parent / "data" / "inventory.sqlite3")))
    args = parser.parse_args()
    origins = [value.strip() for value in os.environ.get("MOBILE_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",") if value.strip()]
    server = InventoryServer((args.host, args.port), args.database, origins,
                             secure_cookies=os.environ.get("MOBILE_SECURE_COOKIES", "0") == "1")
    print(f"Shared inventory API listening on {args.host}:{args.port}; database: {args.database}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
