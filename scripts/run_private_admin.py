#!/usr/bin/env python3
"""Serve *only* the AMARYT Admin static assets inside a private Codespace port.

The forwarded-port access gate is implemented by GitHub Codespaces. This server
must not be deployed to a public network or used with a PUBLIC forwarded port.
"""
from __future__ import annotations
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ADMIN_ROOT = (Path(__file__).resolve().parents[1] / "admin").resolve()
ALLOWLIST = frozenset({"/", "/index.html", "/styles.css", "/app.js"})

class PrivateAdminHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ADMIN_ROOT), **kwargs)

    def _allowed(self):
        raw_path = urlsplit(self.path).path
        path = unquote(raw_path)
        return path in ALLOWLIST

    def do_GET(self):
        if not self._allowed():
            self.send_error(404, "Not found")
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._allowed():
            self.send_error(404, "Not found")
            return
        super().do_HEAD()

    def do_POST(self):
        self.send_error(405, "Only GitHub Issue requests may modify the catalog")

    def do_OPTIONS(self):
        self.send_error(405)

    def end_headers(self):
        self.send_header("Cache-Control", "private, no-store, max-age=0")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy",
                         "default-src 'none'; script-src 'self'; "
                         "style-src 'self' 'unsafe-inline'; "
                         "img-src 'self' data: https:; "
                         "connect-src 'self' https://raw.githubusercontent.com; "
                         "frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "Directory listing is disabled")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), PrivateAdminHandler) as server:
        print(f"AMARYT Admin running on http://{args.host}:{args.port}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
