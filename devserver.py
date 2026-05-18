"""Tiny dev HTTP server with no-cache headers.

Browsers aggressively cache ES module URLs (the module map cache survives
even soft reloads), which means edits to .js files won't take effect until
the user manually hard-reloads. This server sends Cache-Control: no-store
on every response so reloads always pick up the latest code.

Usage: `python devserver.py 5500`
"""
import sys
import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Multiple concurrent clients (Claude Preview iframe + your own Chrome
    # tab + curl, etc.) need to be served in parallel. The default
    # single-threaded TCPServer would queue them up and hang.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    # ThreadingHTTPServer (stdlib since 3.7) serves each request on its own
    # thread, so keep-alive connections from the preview iframe don't block
    # browsers connecting to localhost in parallel.
    httpd = http.server.ThreadingHTTPServer(("", port), NoCacheHandler)
    print(f"Serving http://localhost:{port}/ (no-cache, threaded)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == "__main__":
    main()
