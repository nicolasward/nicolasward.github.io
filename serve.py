#!/usr/bin/env python3
"""Simple dev server with clean URLs and live rebuild."""

import http.server
import os
import socketserver
import subprocess
import sys
from pathlib import Path

PORT = 8000
SITE_DIR = Path(__file__).parent / "_site"


class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    """Serves files from _site/ with clean URL support and no caching (dev)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIR), **kwargs)

    def end_headers(self):
        # Force fresh fetches so updated HTML/CSS/JS are never stale in browser
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        # Clean URLs: /about -> /about/index.html
        path = self.path.split("?")[0].split("#")[0]
        if not os.path.splitext(path)[1] and not path.endswith("/"):
            file_path = SITE_DIR / path.lstrip("/") / "index.html"
            if file_path.exists():
                self.path = path + "/index.html"
        super().do_GET()


def main():
    # Rebuild first
    print("Building site...")
    subprocess.run([sys.executable, "build.py"], cwd=Path(__file__).parent)

    print(f"\nServing at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.\n")

    with socketserver.TCPServer(("", PORT), CleanURLHandler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
