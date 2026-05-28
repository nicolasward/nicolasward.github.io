#!/bin/bash
cd /Users/nw/Desktop/company/blog/_site
exec python3 -c "
import http.server, socketserver, os
handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(('', 8000), handler) as httpd:
    print('Serving on http://localhost:8000')
    httpd.serve_forever()
"
