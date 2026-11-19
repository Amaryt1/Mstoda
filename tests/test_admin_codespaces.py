"""Regression checks for private Codespaces admin asset isolation."""
from __future__ import annotations

import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from run_private_admin import PrivateAdminHandler


class PrivateAdminServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), PrivateAdminHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def fetch(self, path, method="GET"):
        request = Request(f"http://127.0.0.1:{self.port}{path}", method=method)
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, response.read(), response.headers
        except HTTPError as error:
            return error.code, error.read(), error.headers

    def test_only_dashboard_assets_are_served(self):
        for path in ("/", "/index.html", "/app.js", "/styles.css", "/?refresh=1"):
            with self.subTest(path=path):
                status, _, headers = self.fetch(path)
                self.assertEqual(status, 200)
                self.assertIn("no-store", headers["Cache-Control"])
                self.assertEqual(headers["X-Frame-Options"], "DENY")
                self.assertEqual(headers["X-Robots-Tag"], "noindex, nofollow")

    def test_no_source_code_catalog_or_git_metadata(self):
        for path in (
            "/apps.json", "/.git/config", "/.github/workflows/admin-confirm.yml",
            "/scripts/admin_request.py", "/.devcontainer/devcontainer.json",
            "/%2e%2e/apps.json", "/admin/../apps.json", "/admin/",
            "/private", "/index.html/../../apps.json",
        ):
            with self.subTest(path=path):
                status, _, _ = self.fetch(path)
                self.assertEqual(status, 404)

    def test_http_mutations_are_disabled(self):
        self.assertEqual(self.fetch("/", "POST")[0], 405)
        self.assertEqual(self.fetch("/", "OPTIONS")[0], 405)

    def test_codespaces_config_uses_forwarded_port(self):
        config = json.loads((ROOT / ".devcontainer/devcontainer.json").read_text())
        self.assertIn(8765, config["forwardPorts"])
        self.assertIn("Private", config["portsAttributes"]["8765"]["label"])
        self.assertIn("scripts/run_private_admin.py",
                      (ROOT / ".devcontainer/start-admin.sh").read_text())

    def test_public_pages_no_longer_publishes_admin(self):
        pages = (ROOT / ".github/workflows/admin-pages.yml").read_text()
        self.assertNotIn("cp admin/index.html", pages)
        self.assertNotIn("cp admin/styles.css", pages)
        self.assertNotIn("cp admin/app.js", pages)
        self.assertNotIn("url=admin/", pages)
        self.assertIn("AMARYT STORE", pages)


if __name__ == "__main__":
    unittest.main()
