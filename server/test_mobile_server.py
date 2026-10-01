"""Integration tests: isolated temporary SQLite and real loopback HTTP."""

import concurrent.futures
import hashlib
import http.client
import json
import os
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path

from server.mobile_server import COOKIE, InventoryServer, LEGACY_TENANT_ID


class MobileAPITest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "inventory.sqlite3"
        self.origin = "http://localhost:5173"
        self.start_server()

    def start_server(self):
        self.server = InventoryServer(("127.0.0.1", 0), self.db_path,
                                      [self.origin, "https://inventory.example.test"], password_rounds=1000)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def tearDown(self):
        self.stop_server()
        self.temp.cleanup()

    def request(self, method, path, data=None, cookie=None, headers=None, raw=None):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=10)
        request_headers = {"Host": "localhost:5173", "Origin": self.origin, "Content-Type": "application/json"}
        if cookie:
            request_headers["Cookie"] = cookie
        request_headers.update(headers or {})
        request_headers = {key: value for key, value in request_headers.items() if value is not None}
        body = raw if raw is not None else (json.dumps(data) if data is not None else None)
        connection.request(method, "/api/mobile" + path, body, request_headers)
        response = connection.getresponse()
        result = (response.status, json.loads(response.read()), response.getheader("Set-Cookie"))
        connection.close()
        return result

    def setup_superadmin(self):
        status, response, cookie = self.request("POST", "/setup", {
            "username": "owner", "password": "test-owner-passphrase", "name": "Owner"})
        self.assertEqual(status, 201, response)
        return response["user"], cookie.split(";", 1)[0]

    def provision(self, platform, name="Test Pharmacy", username="owner"):
        status, response, _ = self.request("POST", "/platform/tenants", {
            "name": name, "adminName": "Owner", "username": username,
            "password": "test-owner-passphrase"}, platform)
        self.assertEqual(status, 201, response)
        tenant = response["tenant"]
        status, login, cookie = self.request("POST", "/login", {
            "appId": tenant["appId"], "username": username, "password": "test-owner-passphrase"})
        self.assertEqual(status, 200, login)
        return tenant, response["admin"], cookie.split(";", 1)[0]

    def setup_admin(self):
        _, self.platform_cookie = self.setup_superadmin()
        self.tenant, admin, cookie = self.provision(self.platform_cookie)
        return admin, cookie

    def create_staff(self, admin_cookie, role="CASHIER", grant=False, name="staff"):
        status, response, _ = self.request("POST", "/users", {
            "username": name, "name": "Staff", "password": "test-staff-passphrase",
            "role": role, "canManageInventory": grant}, admin_cookie)
        self.assertEqual(status, 201, response)
        status, session, cookie = self.request("POST", "/login", {"appId": response["user"]["appId"], "username": name, "password": "test-staff-passphrase"})
        self.assertEqual(status, 200, session)
        return response["user"], cookie.split(";", 1)[0]

    def create_medicine(self, cookie, **overrides):
        data = {"name": "Medicine", "generic": "Generic", "barcode": "001234567890",
                "form": "Tablet", "strength": "10mg", "manufacturer": "Maker", "packSize": 10,
                "purchasePrice": 4.25, "salePrice": 5.5}
        data.update(overrides)
        return self.request("POST", "/medicines", data, cookie)

    def stock(self, medicine_id, **overrides):
        data = {"medicineId": medicine_id, "batchNo": "B-001", "expiry": "2028-12-31",
                "qty": 12, "purchasePrice": 4.25, "salePrice": 5.5, "requestId": "request-00000001"}
        data.update(overrides)
        return data

    def test_empty_initial_database_and_local_only_one_time_setup(self):
        self.assertEqual(self.request("GET", "/status")[1], {"setupRequired": True})
        payload = {"username": "owner", "password": "test-owner-passphrase", "name": "Owner"}
        self.assertEqual(self.request("POST", "/setup", payload, headers={"Origin": "https://inventory.example.test"})[0], 403)
        self.assertEqual(self.request("POST", "/setup", payload, headers={"X-Forwarded-For": "192.168.1.25"})[0], 403)
        user, cookie = self.setup_superadmin()
        self.assertEqual(user["role"], "SUPERADMIN")
        self.assertFalse(user["canManageInventory"])
        self.assertIsNone(user["tenantId"])
        self.assertEqual(self.request("GET", "/status")[1], {"setupRequired": False})
        self.assertEqual(self.request("POST", "/setup", payload)[0], 409)
        self.assertEqual(self.request("GET", "/inventory", cookie=cookie)[0], 403)
        _, _, pharmacy = self.provision(cookie)
        inventory = self.request("GET", "/inventory", cookie=pharmacy)[1]
        self.assertEqual(inventory["medicines"], [])
        self.assertEqual(inventory["batches"], [])

    def test_unauthenticated_endpoints_deny_access(self):
        self.setup_admin()
        for method, path, body in [("GET", "/session", None), ("GET", "/inventory", None),
                                   ("GET", "/users", None), ("POST", "/medicines", {}),
                                   ("POST", "/stock", {}), ("POST", "/users", {}),
                                   ("PATCH", "/users/" + "a" * 32, {"role": "ADMIN"})]:
            with self.subTest(path=path):
                status, result, _ = self.request(method, path, body)
                self.assertEqual(status, 401, result)
                self.assertIn("error", result)

    def test_simultaneous_setup_creates_only_one_admin(self):
        def setup(index):
            return self.request("POST", "/setup", {"username": f"owner{index}", "name": "Owner",
                                                     "password": "test-owner-passphrase"})
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            replies = list(pool.map(setup, range(4)))
        self.assertEqual(sorted(reply[0] for reply in replies), [201, 409, 409, 409])
        with sqlite3.connect(self.db_path) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM users").fetchone()[0], 1)

    def test_password_hash_session_cookie_login_and_logout(self):
        self.setup_superadmin()
        self.assertEqual(self.request("POST", "/login", {"username": "owner", "password": "incorrect"})[0], 401)
        status, result, cookie = self.request("POST", "/login", {"username": "OWNER", "password": "test-owner-passphrase"})
        self.assertEqual(status, 200)
        for attribute in ("HttpOnly", "SameSite=Strict", "Path=/api/mobile"):
            self.assertIn(attribute, cookie)
        self.assertNotIn("password", json.dumps(result))
        cookie = cookie.split(";", 1)[0]
        with sqlite3.connect(self.db_path) as db:
            stored = db.execute("SELECT password_hash FROM users").fetchone()[0]
            self.assertTrue(stored.startswith("pbkdf2_sha256$"))
            self.assertNotIn("test-owner-passphrase", stored)
            tokens = [row[0] for row in db.execute("SELECT token_hash FROM sessions")]
            self.assertNotIn(cookie.split("=", 1)[1], tokens)
        self.assertEqual(self.request("GET", "/session", cookie=cookie)[0], 200)
        self.assertEqual(self.request("POST", "/logout", {}, cookie)[0], 200)
        self.assertEqual(self.request("GET", "/session", cookie=cookie)[0], 401)
        self.assertEqual(os.stat(self.db_path).st_mode & 0o777, 0o600)

    def test_https_origin_sets_secure_cookie(self):
        self.setup_admin()
        status, _, cookie = self.request("POST", "/login", {"username": "owner", "password": "test-owner-passphrase"},
                                        headers={"Origin": "https://inventory.example.test"})
        self.assertEqual(status, 200)
        self.assertIn("; Secure", cookie)

    def test_csrf_origin_host_and_content_type_protection(self):
        _, cookie = self.setup_admin()
        for headers, expected in [({"Origin": "https://evil.test"}, 403), ({"Origin": None}, 403),
                                  ({"Sec-Fetch-Site": "cross-site"}, 403), ({"Host": "evil.test"}, 403),
                                  ({"Content-Type": "text/plain"}, 415)]:
            self.assertEqual(self.request("POST", "/logout", {}, cookie, headers)[0], expected)
        self.assertEqual(self.request("GET", "/session", cookie=cookie)[0], 200)

    def test_roles_require_explicit_inventory_grant_and_admin_for_users(self):
        _, admin = self.setup_admin()
        for role in ("CASHIER", "MANAGER"):
            staff, cookie = self.create_staff(admin, role=role, name=role.lower())
            inventory = self.request("GET", "/inventory", cookie=cookie)[1]
            self.assertEqual(inventory["permissions"], {"canManageInventory": False, "canManageUsers": False})
            self.assertEqual(self.create_medicine(cookie)[0], 403)
            self.assertEqual(self.request("POST", "/stock", {}, cookie)[0], 403)
            self.assertEqual(self.request("GET", "/users", cookie=cookie)[0], 403)
            self.assertEqual(self.request("POST", "/users", {}, cookie)[0], 403)
            self.assertEqual(self.request("PATCH", "/users/" + staff["id"], {"role": "ADMIN"}, cookie)[0], 403)
            self.assertEqual(self.request("PATCH", "/users/" + staff["id"], {"canManageInventory": True}, admin)[0], 200)
            status, response, _ = self.create_medicine(cookie, barcode=role)
            self.assertEqual(status, 201)
            self.assertEqual(self.request("POST", "/stock", self.stock(response["medicine"]["id"],
                             requestId=f"request-for-{role}"), cookie)[0], 201)
            self.request("PATCH", "/users/" + staff["id"], {"canManageInventory": False}, admin)
            self.assertEqual(self.create_medicine(cookie, barcode="denied")[0], 403)

    def test_disabled_users_and_password_reset_revoke_sessions(self):
        _, admin = self.setup_admin()
        user, cookie = self.create_staff(admin)
        path = "/users/" + user["id"]
        self.assertEqual(self.request("PATCH", path, {"disabled": True}, admin)[0], 200)
        self.assertEqual(self.request("GET", "/inventory", cookie=cookie)[0], 401)
        self.assertEqual(self.request("POST", "/login", {"appId": user["appId"], "username": "staff", "password": "test-staff-passphrase"})[0], 401)
        self.request("PATCH", path, {"disabled": False}, admin)
        self.assertEqual(self.request("GET", "/session", cookie=cookie)[0], 401)
        _, _, new_cookie = self.request("POST", "/login", {"appId": user["appId"], "username": "staff", "password": "test-staff-passphrase"})
        self.request("PATCH", path, {"password": "a-new-test-passphrase"}, admin)
        self.assertEqual(self.request("GET", "/session", cookie=new_cookie.split(";", 1)[0])[0], 401)

    def test_last_admin_cannot_be_disabled_or_demoted(self):
        user, cookie = self.setup_admin()
        for body in ({"disabled": True}, {"role": "CASHIER"}):
            self.assertEqual(self.request("PATCH", "/users/" + user["id"], body, cookie)[0], 409)

    def test_demoted_initial_admin_does_not_keep_inherent_inventory_access(self):
        user, original = self.setup_admin()
        _, second = self.create_staff(original, role="ADMIN")
        status, response, _ = self.request("PATCH", "/users/" + user["id"], {"role": "MANAGER"}, second)
        self.assertEqual(status, 200)
        self.assertFalse(response["user"]["canManageInventory"])
        self.assertEqual(self.create_medicine(original)[0], 403)

    def test_unique_barcodes_and_independent_blank_barcodes(self):
        _, cookie = self.setup_admin()
        status, result, _ = self.create_medicine(cookie)
        self.assertEqual(status, 201)
        self.assertEqual(result["medicine"]["barcode"], "001234567890")
        self.assertEqual(self.create_medicine(cookie)[0], 409)
        for _ in range(2):
            self.assertEqual(self.create_medicine(cookie, barcode="")[0], 201)
        self.assertEqual(len(self.request("GET", "/inventory", cookie=cookie)[1]["medicines"]), 3)

    def test_stock_idempotency_atomicity_and_conflicts(self):
        _, cookie = self.setup_admin()
        ident = self.create_medicine(cookie)[1]["medicine"]["id"]
        data = self.stock(ident)
        first = self.request("POST", "/stock", data, cookie)
        self.assertEqual(first[0], 201, first)
        repeat = self.request("POST", "/stock", data, cookie)
        self.assertEqual(repeat[0], 200)
        self.assertEqual(first[1], repeat[1])
        self.assertEqual(self.request("POST", "/stock", self.stock(ident, qty=13), cookie)[0], 409)
        self.assertEqual(self.request("POST", "/stock", self.stock(ident, requestId="request-00000002", expiry="2029-12-31"), cookie)[0], 409)
        self.assertEqual(self.request("POST", "/stock", self.stock("missing-medicine", requestId="request-00000003"), cookie)[0], 404)
        self.assertEqual(self.request("GET", "/inventory", cookie=cookie)[1]["batches"][0]["qty"], 12)
        self.assertEqual(self.request("POST", "/stock", self.stock(ident, requestId="request-00000002", qty=3), cookie)[0], 201)
        self.assertEqual(self.request("GET", "/inventory", cookie=cookie)[1]["batches"][0]["qty"], 15)
        # Replay is the original receipt snapshot, not a new stock operation.
        self.assertEqual(self.request("POST", "/stock", data, cookie)[1], first[1])

    def test_concurrent_retries_add_stock_exactly_once(self):
        _, cookie = self.setup_admin()
        ident = self.create_medicine(cookie)[1]["medicine"]["id"]
        data = self.stock(ident)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            replies = list(pool.map(lambda _: self.request("POST", "/stock", data, cookie), range(6)))
        self.assertEqual(sorted(reply[0] for reply in replies), [200, 200, 200, 200, 200, 201])
        self.assertEqual(self.request("GET", "/inventory", cookie=cookie)[1]["batches"][0]["qty"], 12)

    def test_stock_request_namespace_is_per_user(self):
        _, admin = self.setup_admin()
        ident = self.create_medicine(admin)[1]["medicine"]["id"]
        data = self.stock(ident)
        self.assertEqual(self.request("POST", "/stock", data, admin)[0], 201)
        _, staff = self.create_staff(admin, grant=True)
        second = self.request("POST", "/stock", data, staff)
        self.assertEqual(second[0], 201)
        self.assertEqual(second[1]["batch"]["qty"], 24)
        self.assertEqual(self.request("POST", "/stock", data, staff)[0], 200)
        self.assertEqual(self.request("GET", "/inventory", cookie=admin)[1]["batches"][0]["qty"], 24)

    def test_input_validation_does_not_mutate_inventory(self):
        _, cookie = self.setup_admin()
        for overrides in ({"name": ""}, {"packSize": True}, {"salePrice": -1}, {"purchasePrice": 1.001},
                          {"purchasePrice": 10**200}, {"name": "x\x00"}):
            self.assertEqual(self.create_medicine(cookie, **overrides)[0], 400)
        self.assertEqual(self.request("POST", "/medicines", cookie=cookie, raw='{"salePrice":NaN}')[0], 400)
        ident = self.create_medicine(cookie)[1]["medicine"]["id"]
        for overrides in ({"qty": -1}, {"qty": 1.5}, {"qty": True}, {"expiry": "2027-02-30"},
                          {"expiry": "20281231"}, {"requestId": "bad"}, {"salePrice": "5.50"}):
            self.assertEqual(self.request("POST", "/stock", self.stock(ident, **overrides), cookie)[0], 400)
        self.assertEqual(self.request("GET", "/inventory", cookie=cookie)[1]["batches"], [])

    def test_persistence_across_restart(self):
        _, cookie = self.setup_admin()
        ident = self.create_medicine(cookie)[1]["medicine"]["id"]
        original = self.request("POST", "/stock", self.stock(ident), cookie)[1]
        self.stop_server()
        self.start_server()
        status, inventory, _ = self.request("GET", "/inventory", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(inventory["medicines"][0]["id"], ident)
        self.assertEqual(inventory["batches"][0]["qty"], 12)
        self.assertEqual(self.request("POST", "/stock", self.stock(ident), cookie)[1], original)

    def test_expired_sessions_are_rejected(self):
        _, cookie = self.setup_admin()
        with sqlite3.connect(self.db_path) as db:
            db.execute("UPDATE sessions SET expires=0")
        self.assertEqual(self.request("GET", "/inventory", cookie=cookie)[0], 401)

    def test_login_attempts_are_throttled(self):
        self.setup_superadmin()
        for _ in range(30):
            self.assertEqual(self.request("POST", "/login", {"username": "owner", "password": "wrong"})[0], 401)
        self.assertEqual(self.request("POST", "/login", {"username": "owner", "password": "wrong"})[0], 429)

    def test_tenants_isolate_same_usernames_barcodes_and_ids(self):
        _, platform = self.setup_superadmin()
        first, first_admin, first_cookie = self.provision(platform, "First", "sameuser")
        second, second_admin, second_cookie = self.provision(platform, "Second", "sameuser")
        self.assertNotEqual(first["appId"], second["appId"])
        first_medicine = self.create_medicine(first_cookie, barcode="shared-barcode")[1]["medicine"]
        second_medicine = self.create_medicine(second_cookie, barcode="shared-barcode")[1]["medicine"]
        self.assertNotEqual(first_medicine["id"], second_medicine["id"])
        first_stock = self.stock(first_medicine["id"])
        self.assertEqual(self.request("POST", "/stock", first_stock, first_cookie)[0], 201)
        # The same receipt ID is independent in another tenant, but its medicine
        # must still be selected from that tenant rather than trusted from input.
        self.assertEqual(self.request("POST", "/stock", self.stock(first_medicine["id"]), second_cookie)[0], 404)
        self.assertEqual(self.request("POST", "/stock", self.stock(second_medicine["id"]), second_cookie)[0], 201)
        self.assertEqual(self.request("PATCH", "/users/" + first_admin["id"], {"disabled": True}, second_cookie)[0], 404)
        self.assertEqual(len(self.request("GET", "/inventory", cookie=second_cookie)[1]["medicines"]), 1)

    def test_platform_permissions_disabled_tenant_and_admin_reset(self):
        _, platform = self.setup_superadmin()
        tenant, admin, pharmacy = self.provision(platform)
        self.assertEqual(self.request("GET", "/platform/tenants", cookie=pharmacy)[0], 403)
        self.assertEqual(self.request("PATCH", "/platform/tenants/" + tenant["id"], {"disabled": True}, platform)[0], 200)
        self.assertEqual(self.request("GET", "/session", cookie=pharmacy)[0], 401)
        self.assertEqual(self.request("POST", "/login", {"appId": tenant["appId"], "username": admin["username"], "password": "test-owner-passphrase"})[0], 401)
        self.assertEqual(self.request("PATCH", "/platform/tenants/" + tenant["id"], {"disabled": False}, platform)[0], 200)
        self.assertEqual(self.request("POST", "/platform/tenants/" + tenant["id"] + "/reset-admin", {"password": "new-admin-passphrase"}, platform)[0], 200)
        self.assertEqual(self.request("POST", "/login", {"appId": tenant["appId"], "username": admin["username"], "password": "test-owner-passphrase"})[0], 401)
        self.assertEqual(self.request("POST", "/login", {"appId": tenant["appId"], "username": admin["username"], "password": "new-admin-passphrase"})[0], 200)

    def test_legacy_schema_backup_migration_and_session_invalidation(self):
        self.stop_server()
        self.db_path.unlink()
        with sqlite3.connect(self.db_path) as db:
            db.executescript("""
            CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                password_hash TEXT NOT NULL, role TEXT NOT NULL, can_manage_inventory INTEGER NOT NULL, disabled INTEGER NOT NULL);
            CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
            CREATE TABLE medicines (id TEXT PRIMARY KEY, name TEXT NOT NULL, generic TEXT NOT NULL, barcode TEXT,
                form TEXT NOT NULL, strength TEXT NOT NULL, manufacturer TEXT NOT NULL, pack_size INTEGER NOT NULL,
                purchase_cents INTEGER NOT NULL, sale_cents INTEGER NOT NULL);
            CREATE TABLE batches (id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL, batch_no TEXT NOT NULL, expiry TEXT NOT NULL,
                qty INTEGER NOT NULL, purchase_cents INTEGER NOT NULL, sale_cents INTEGER NOT NULL);
            CREATE TABLE stock_receipts (request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
                response TEXT NOT NULL, created_at TEXT NOT NULL);
            INSERT INTO users VALUES ('u1','legacyuser','Legacy','pbkdf2_sha256$1000$00$00','ADMIN',1,0);
            INSERT INTO sessions VALUES ('old-token-hash','u1',9999999999);
            INSERT INTO medicines VALUES ('m1','Old Med','Old Generic','legacy-barcode','Tablet','10mg','Maker',1,100,200);
            INSERT INTO batches VALUES ('b1','m1','old-batch','2030-01-01',5,100,200);
            INSERT INTO stock_receipts VALUES ('legacy-request','u1','hash','{}','2026-01-01');
            """)
        self.start_server()
        with sqlite3.connect(self.db_path) as db:
            tenant = db.execute("SELECT id,app_id FROM tenants WHERE app_id='LEGACY'").fetchone()
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM medicines WHERE tenant_id=?", (LEGACY_TENANT_ID,)).fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM legacy_medicines").fetchone()[0], 1)
        backups = list(self.db_path.parent.glob(self.db_path.name + ".pre-multitenant-*.bak"))
        self.assertEqual(len(backups), 1)
        status, response, cookie = self.request("POST", "/login", {"appId": "LEGACY", "username": "legacyuser", "password": "wrong"})
        self.assertEqual(status, 401)

    def test_login_with_email_without_app_id_and_sync(self):
        self.start_server()
        # 1. Setup superadmin
        status, response, cookie = self.request("POST", "/setup", {
            "username": "superadmin", "name": "Super Admin", "password": "supersecretpassword1"
        })
        self.assertEqual(status, 201)
        self.assertEqual(response["user"]["role"], "SUPERADMIN")

        # 2. Provision tenant with email
        status, response, _ = self.request("POST", "/platform/tenants", {
            "name": "Health First Pharmacy",
            "adminName": "Dr. Sarah",
            "email": "sarah@healthfirst.com",
            "password": "pharmacyadminpass123"
        }, cookie=cookie)
        self.assertEqual(status, 201)
        tenant_id = response["tenant"]["id"]
        app_id = response["tenant"]["appId"]

        # 3. Log in as pharmacy admin using EMAIL ONLY without appId!
        status, login_res, pharmacy_cookie = self.request("POST", "/login", {
            "email": "sarah@healthfirst.com",
            "password": "pharmacyadminpass123"
        })
        self.assertEqual(status, 200)
        self.assertEqual(login_res["user"]["email"], "sarah@healthfirst.com")
        self.assertEqual(login_res["user"]["role"], "ADMIN")
        self.assertEqual(login_res["user"]["pharmacyName"], "Health First Pharmacy")
        self.assertEqual(login_res["user"]["appId"], app_id)

        # 4. Add staff with PHARMACIST role
        status, staff_res, _ = self.request("POST", "/users", {
            "username": "pharmacist_ali",
            "email": "ali@healthfirst.com",
            "name": "Ali Pharmacist",
            "password": "pharmacistpass123",
            "role": "PHARMACIST",
            "canManageInventory": True
        }, cookie=pharmacy_cookie)
        self.assertEqual(status, 201)
        self.assertEqual(staff_res["user"]["role"], "PHARMACIST")

        # 5. Log in as staff using email without appId!
        status, staff_login_res, staff_cookie = self.request("POST", "/login", {
            "email": "ali@healthfirst.com",
            "password": "pharmacistpass123"
        })
        self.assertEqual(status, 200)
        self.assertEqual(staff_login_res["user"]["role"], "PHARMACIST")

        # 6. Test /sync endpoint
        status, sync_res, _ = self.request("POST", "/sync", {
            "offlineSales": [{"invoiceNo": "INV-100", "total": 15.0}],
            "lastSync": 0
        }, cookie=staff_cookie)
        self.assertEqual(status, 200)
        self.assertTrue(sync_res["ok"])
        self.assertEqual(sync_res["syncedSalesCount"], 1)
        self.assertIn("medicines", sync_res)
        self.assertIn("batches", sync_res)
        self.assertIn("users", sync_res)


if __name__ == "__main__":
    unittest.main()
