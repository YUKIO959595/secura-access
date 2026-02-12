#!/usr/bin/env python3
"""
Simple HTTP Server for Keycard System
Run this file to start a local server
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path
import urllib.request
import urllib.error

PORT = 8000
CAMERA_IP = "10.174.64.114"  # ESP32 Camera IP

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Custom logging
        print(f"[{self.log_date_time_string()}] {format % args}")
    
    def do_GET(self):
        # Camera proxy endpoint
        if self.path.startswith('/api/camera/stream'):
            try:
                # Try different endpoints that might work on ESP32
                endpoints = [
                    f"http://{CAMERA_IP}/capture",
                    f"http://{CAMERA_IP}/stream",
                    f"http://{CAMERA_IP}/jpg",
                    f"http://{CAMERA_IP}/mjpeg",
                    f"http://{CAMERA_IP}:80/stream",
                ]
                
                frame_data = None
                for endpoint in endpoints:
                    try:
                        print(f"Trying camera endpoint: {endpoint}")
                        response = urllib.request.urlopen(endpoint, timeout=3)
                        frame_data = response.read()
                        print(f"Success with endpoint: {endpoint}")
                        break
                    except Exception as e:
                        print(f"Failed {endpoint}: {e}")
                        continue
                
                if frame_data:
                    # Send response
                    self.send_response(200)
                    self.send_header('Content-type', 'image/jpeg')
                    self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    self.send_header('Pragma', 'no-cache')
                    self.send_header('Expires', '0')
                    self.end_headers()
                    self.wfile.write(frame_data)
                else:
                    raise Exception("All endpoints failed")
                return
            except Exception as e:
                print(f"Camera error: {e}")
                self.send_response(503)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b"Camera unavailable")
                return
        
        # Default behavior for other paths
        super().do_GET()

def start_server():
    # Change to the script's directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print("\n" + "="*60)
        print("[SERVER] Keycard System Server Started!")
        print("="*60)
        print(f"\nOpen your browser and go to:")
        print(f"   {url}")
        print(f"\n(Or click the link above)")
        print(f"\nPress CTRL+C to stop the server\n")
        print("="*60 + "\n")
        
        try:
            # Open browser automatically (optional)
            webbrowser.open(url)
        except:
            pass
        
        httpd.serve_forever()

if __name__ == "__main__":
    try:
        start_server()
    except KeyboardInterrupt:
        print("\n\n[SERVER] Server stopped.")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        print(f"\nMake sure port {PORT} is not in use.")
