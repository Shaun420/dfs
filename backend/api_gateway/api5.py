from flask import Flask, request, jsonify, redirect, url_for, session, send_file
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_cors import CORS
import uuid
import json
import os
import hashlib
import requests
from datetime import datetime
import io
import threading
import time
import signal
import logging
from ..utils import utils
import subprocess
import traceback
import google.oauth2.credentials
import google_auth_oauthlib.flow
from urllib.parse import unquote

# Set up logging
logging.basicConfig(filename='api_gateway.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, root_path=utils.get_home_dir())
app.secret_key = os.environ.get('SECRET_KEY', 'development-key')
CORS(app, supports_credentials=True)

# Configuration
CHUNK_SIZE = 4194304  # 4MB chunks
NODE_MAP = {
    "node1": "http://localhost:5001",
    "node2": "http://localhost:5002",
    "node3": "http://localhost:5003"
}

# OAuth 2.0 configuration
CLIENT_SECRETS_FILE = os.path.join(utils.get_home_dir(), "api_gateway", "client_secret.json")
SCOPES = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'openid']

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

USERS_FILE = os.path.join(utils.get_home_dir(), "api_gateway", "users.json")
ADMIN_IDS = ["hawaldarshaunak@gmail.com"]

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

users = load_users()

class User(UserMixin):
    def __init__(self, username):
        self.id = username

"""
@app.before_request
def before_request():
    # Redirect non-HTTPS traffic to HTTPS.
    if request.url.startswith('http://'):
        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301) #Permanent redirect
"""

@login_manager.user_loader
def load_user(user_id):
    if user_id in users:
        return User(user_id)
    return None

def get_flow():
    return google_auth_oauthlib.flow.Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE, scopes=SCOPES)

# OAuth 2.0 routes
@app.route('/google/login')
def google_login():
    # Option 1: User is already logged in
    if current_user.is_authenticated:
        # Return a clear JSON indicating user is already logged in
        # The frontend can check for this specific response.
        return jsonify({
            "success": True, # Still true for success in operation (checking status)
            "status": "authenticated", # Custom status
            "user": current_user.id,
            "message": "User is already logged in. No login flow initiated."
        }), 200

    # Option 2: User is NOT logged in - proceed to initiate OAuth flow
    try:
        #print("Debug 1")
        flow = get_flow()
        # Use request.host_url if running behind proxy to get correct frontend origin
        # Or hardcode your frontend's base URL if request.host_url is unreliable
        frontend_base_url = "https://localhost:4321"
        logging.info(f"Redirect url: {frontend_base_url}/google/callback")
        logging.info(f"Redirect url 2: {request.host_url}/google/callback")
        #print("Redirect url:", f"{frontend_base_url}/google/callback")
        flow.redirect_uri = f"{frontend_base_url}/google/callback" # This must match Google Cloud & callback page URL

        # Generate the Google auth URL and state
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='select_account' # Recommended to allow users to switch accounts
        )

        # Save the state in the Flask session for validation later in /google/callback
        session['state'] = state
        logging.info(f"Saved state in session for /google/login: {state}")

        # **CHANGE:** Return the auth_url in a JSON response (200 OK)
        # Do NOT redirect the browser from here.
        return jsonify({
            "success": True, # Operation successful (got auth URL)
            "status": "auth_url_provided", # Custom status
            "auth_url": authorization_url, # The URL for the frontend to open
            "message": "Authorization URL generated."
        }), 200

    except Exception as e:
        logging.error(f"Error initiating Google login flow: {e}")
        logging.error(traceback.format_exc())
        # Return an error JSON if something goes wrong before generating the URL
        return jsonify({
            "success": False, # Operation failed
            "status": "error",
            "message": f"Failed to initiate login flow: {str(e)}"
        }), 500 # Return a 500 status code for server errors


@app.route('/google/callback')
def google_callback():
    logging.info(f"Received callback request. URL: {request.url}")
    logging.info(f"Request args: {request.args}")

    # --- Access state from URL ---
    # You can get the state parameter sent by Google from the URL args
    state_from_url = request.args.get('state')
    logging.info(f"State from URL: {state_from_url}")
    # ---------------------------

    logging.info(f"Flask session keys: {list(session.keys())}") # Log keys BEFORE accessing 'state'

    # --- Check for state in session (for CSRF validation) ---
    # This check is necessary for security. The state must match the one saved in the session.
    if 'state' not in session:
         logging.error("Session state missing!")
         # Return an error or redirect to login if the session state is missing
         return jsonify(success=False, message="Session state missing. Possible CSRF, session issue, or attacker."), 400 # Recommended: fail gracefully

    # --- Retrieve expected state from session ---
    # This is the state you saved in /google/login, used for comparison by the library
    expected_state_from_session = session['state']
    logging.info(f"Expected state from session: {expected_state_from_session}")

    # --- Optional: Manually compare states (flow.fetch_token does this internally) ---
    # You could add an explicit check here if you want, but flow.fetch_token handles it
    # if state_from_url != expected_state_from_session:
    #     logging.error(f"State mismatch! URL: {state_from_url}, Session: {expected_state_from_session}")
    #     return jsonify(success=False, message="State mismatch. Possible CSRF attempt."), 400


    flow = get_flow()
    flow.state = state_from_url

    # --- Configure the redirect_uri ---
    # This should match the URI registered with Google and the URL the browser was sent back to.
    # Using request.base_url is often more robust than hardcoding 'https://localhost',
    # especially when running behind a proxy that correctly sets the Host header.
    # request.base_url gives you the scheme + host + path up to the endpoint (e.g., https://localhost:4321/google/callback if proxied)
    flow.redirect_uri = request.base_url # Use the base URL of the current request


    # --- Pass the full callback URL to fetch_token ---
    # The library needs the full URL with code and state parameters to fetch the token.
    # request.url contains the full URL including query parameters.
    authorization_response = request.url

    try:
        # This fetches the token. The library will automatically extract the code and state
        # from `authorization_response` (request.url) and compare the extracted state
        # against the `flow.state` (which you set from the session).
        # If the states don't match, flow.fetch_token should raise an error.
        flow.fetch_token(authorization_response=authorization_response)
        logging.info("Token fetched successfully.")

    except Exception as e:
        # Catch exceptions during token fetching (e.g., invalid code, state mismatch caught by library)
        logging.error(f"Failed to fetch token or state validation failed: {e}")
        # Consider checking if the error is a specific state validation error from the library
        # and providing a more specific error message if needed.
        return jsonify(success=False, message=f"Login failed during token exchange: {str(e)}"), 500


    credentials = flow.credentials
    logging.info("Credentials obtained.")

    # Get user info using the obtained access token
    # It's generally safer to use the flow object's methods if available,
    # or google-auth-oauthlib's identity toolkit functions, rather than manual requests.get.
    # However, sticking to your current structure:
    request_uri = ('https://www.googleapis.com/oauth2/v1/userinfo'
                   f'?access_token={credentials.token}')
    try:
        # Ensure requests is configured to verify SSL certificates in production
        user_info_response = requests.get(request_uri)
        user_info_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        user_info = user_info_response.json()
        logging.info(f"User info obtained: {user_info.get('email')}")

    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to get user info: {e}")
        return jsonify(success=False, message=f"Failed to get user info: {str(e)}"), 500
    except Exception as e:
        logging.error(f"Failed to get user info (unexpected): {e}")
        return jsonify(success=False, message=f"Failed to get user info: {str(e)}"), 500


    username = user_info['email']
    # Check if user exists, if not create one
    if username not in users:
        users[username] = {"google_id": user_info['id']} # Store Google ID
        save_users(users)
        logging.info(f"New user registered: {username}")
    else:
         # Optional: Update existing user info if needed
         logging.info(f"Existing user logged in: {username}")


    # Log the user in using Flask-Login
    user = User(username) # Assuming User class correctly uses username as ID
    login_user(user, remember=True) # Log the user in

    logging.info(f"User {username} logged in successfully via Flask-Login.")

    # --- FINAL STEP: Redirect the BROWSER back to the frontend application ---
    # This is the standard OAuth flow completion. The backend performs the exchange
    # and then tells the user's browser where to go next within your application.
    # Redirect to your frontend file browser page.
    # Use the URL where your Astro frontend is running, NOT the backend's internal URL.
    # Use request.host_url to get the frontend's base URL if proxied correctly
    # (e.g., https://localhost:4321). If not, hardcode or use a config value.
    # Assuming your Astro frontend is accessible at request.host_url and the file browser is at /files
    frontend_browse_url = f"{request.host_url.rstrip('/')}/files"
    logging.info(f"Redirecting browser to frontend: {frontend_browse_url}")
    return redirect(frontend_browse_url)

    # --- Alternative: If you prefer the frontend to parse a JSON success message ---
    # (Less standard for callback handlers but required for fetch+new-window flow)
    # return jsonify(success=True, message="Google login successful.", user=username), 200
    # If you do this, the frontend script in callback.astro must explicitly parse this JSON
    # and then manually redirect the browser.

@app.route('/')
def index():
    return jsonify(success=True, message="Distributed File System API Gateway"), 200

@app.route('/test')
def testroute():
    if current_user.is_authenticated:
        if (current_user.id in ADMIN_IDS):
            return jsonify({"success": True, "message": "Admin access", "user": current_user.id}), 200
        else:
            return jsonify({"success": True, "message": "User access", "user": current_user.id}), 200
    return jsonify(success=True, message="Not logged in"), 200

@app.route('/browse')
def browse():
    directory = request.args.get('dir', '/')
    metadata = requests.get(f"http://localhost:5000/api/list?directory={directory}").json()
    files = metadata
    directories = set()
    for path in files.keys():
        parts = path.split('/')
        if len(parts) > 2:
            parent_dir = '/'.join(parts[:-1]) + '/'
            if parent_dir.startswith(directory) and parent_dir != directory:
                directories.add(parent_dir)
    return jsonify({
        "files": files,
        "directories": sorted(list(directories)),
        "current_dir": directory
    })

"""
@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    if username in users:
        #flash("Username already exists")
        #return redirect(url_for('register'))
        return jsonify(success=False, message="Username already exists"), 400
    users[username] = {
        "password": hashlib.sha256(password.encode()).hexdigest()
    }
    save_users(users)
    #flash("Registration successful. Please log in.")
    #return redirect(url_for('login'))
    return jsonify(success=True, message="Registration successful. Please log in."), 200
    #return render_template('register.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = hashlib.sha256(request.form['password'].encode()).hexdigest()
    if username in users and users[username]["password"] == password:
        user = User(username)
        login_user(user)
        #flash("Logged in successfully.")
        #return redirect(url_for('index'))
        return jsonify(success=True, message="Logged in successfully."), 200
    else:
        #flash("Invalid credentials")
        #return redirect(url_for('login'))
        return jsonify(success=False, message="Invalid credentials"), 401
    #return render_template('login.html')
"""

@app.route('/logout')
def logout():
    if current_user.is_authenticated:
        logout_user()
        #flash("Logged out.")
        #return redirect(url_for('login'))
        return jsonify(success=True, message="Logged out."), 200
    else:
        return jsonify(success=False, message="You are not logged in."), 400

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    directory = request.form.get('directory', '/dfs/')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    if file:
        try:
            # Get file size without reading entire file
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)
            
            file_path = os.path.join(directory, file.filename)
            
            # Register file with metadata server
            file_info = requests.post("http://localhost:5000/api/file", json={
                "path": file_path,
                "size": file_size
            }).json()
            
            chunks = file_info["chunks"]
            chunk_index = 0
            threads = []
            
            # Process file in chunks
            while True:
                chunk_data = file.read(CHUNK_SIZE)
                if not chunk_data:
                    break
                    
                if chunk_index >= len(chunks):
                    return jsonify({"error": "Chunk index exceeds registered chunks"}), 500
                    
                chunk_id = chunks[chunk_index]
                
                # Upload to multiple nodes for replication
                for node_id in ["node1", "node2"]:
                    thread = threading.Thread(
                        target=async_upload_chunk, 
                        args=(NODE_MAP[node_id], chunk_data, chunk_id)
                    )
                    threads.append(thread)
                    thread.start()
                    
                chunk_index += 1
                
            # Wait for all threads to complete
            for thread in threads:
                thread.join()
                
            return jsonify({
                "success": True, 
                "message": f"File {file.filename} uploaded successfully", 
                "directory": directory
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False, 
                'message': f"Upload failed: {str(e)}"
            }), 500

@app.route('/download/<path:file_path>')
def download_file(file_path):
    decoded_path = unquote(file_path)
    if (not decoded_path.startswith("/")):
        decoded_path = "/" + decoded_path
    logging.info(str.format("Decoded path: {}", decoded_path))
    metadata = requests.get("http://localhost:5000/api/file?path=" + decoded_path).json()
    if "error" in metadata:
        return jsonify({
            'success': False,
            'message': "File not found"
        }), 404
    file_info = metadata["metadata"]
    logging.info(str.format("metadata: {}", metadata))
    chunks = file_info["chunks"]
    try:
        for chunk in chunks:
            try:
                node_id = chunk["chunk_servers"][0]
                chunk_id = chunk["chunk_id"]
                file_data = bytearray()
                response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}/exists")
                if response.status_code == 200 and bool(response.json().get("exists")):
                    response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}")
                    file_data.extend(response.content)
                else:
                    if len(chunk["chunk_servers"]) > 1:
                        backup_node = chunk["chunk_servers"][1]
                        backup_response = requests.get(f"{NODE_MAP[backup_node]}/chunk/{chunk_id}/exists")
                        if backup_response.status_code == 200 and bool(backup_response.json().get("exists")):
                            backup_response = requests.get(f"{NODE_MAP[backup_node]}/chunk/{chunk_id}")
                            file_data.extend(backup_response.content)
                        else:
                            return jsonify({"success": False, "message": f"Failed to retrieve chunk {chunk_id}"}), 500
                    else:
                        return jsonify({"success": False, "message": f"Failed to retrieve chunk {chunk_id}"}), 500
            except Exception as e:
                return jsonify({"success": False, "message": f"Error downloading chunk: {str(e)}"}), 500
        filename = os.path.basename(decoded_path)
        return send_file(
            io.BytesIO(file_data),
            as_attachment=True,
            download_name=filename,
            mimetype='application/octet-stream'
        )
    except Exception as e:  # Catch any errors during the entire process
        response_data = {
            'success': False,
            'message': f"General error during download: {str(e)}"
        }
        return jsonify(response_data), 500

@app.route('/rename', methods=['POST'])
def rename_file():
    old_path = request.form.get('old_path')
    new_path = request.form.get('new_path')

    if not old_path or not new_path:
        return jsonify({"success": False, "message": "old_path and new_path are required"}), 400

    try:
        response = requests.put("http://localhost:5000/api/file/rename", json={
            "old_path": old_path,
            "new_path": new_path
        })
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        return jsonify({"success": True, "message": f"Renamed {old_path} to {new_path}"}), 200
    except requests.exceptions.RequestException as e:
        logging.error(f"Rename request failed: {e}")
        return jsonify({"success": False, "message": f"Rename request failed: {str(e)}"}), 500

@app.route('/delete/<path:file_path>', methods=['POST'])
def delete_file_web(file_path):
    response = requests.delete(f"http://localhost:5000/api/file?path={file_path}")
    if response.status_code == 200:
        return jsonify({"message": f"File {os.path.basename(file_path)} deleted successfully"}), 200
    else:
        return jsonify({"error": "Failed to delete file"}), 400
    #return redirect(url_for('browse'))

@app.route('/admin/dashboard')
def admin_dashboard():
    #if current_user.id != 'admin':  # Basic authorization
    #   flash("Admin privileges required.")
    #   return redirect(url_for('index'))
    node_health = {}
    for node_id, node_url in NODE_MAP.items():
        try:
            response = requests.get(f"{node_url}/health", timeout=2)
            if response.status_code == 200:
                node_health.update({node_id: response.json()})
            else:
                node_health.update({node_id: {"status": "Unhealthy", "error": f"HTTP {response.status_code}"}})
        except requests.exceptions.ConnectionError:
            node_health.update({node_id: {"status": "Unreachable", "error": "Connection refused"}})
        except requests.exceptions.Timeout:
            node_health.update({node_id: {"status": "Unresponsive", "error": "Request timed out"}})
        except Exception as e:
            node_health.update({node_id: {"status": "Error", "error": str(e)}})
    #return render_template('admin_dashboard.html', node_health=node_health, node_map=NODE_MAP)
    return jsonify(node_health), 200

"""
@app.route('/admin/refresh_health')
def refresh_health():
    #if current_user.id != 'admin':
        #flash("Admin privileges required.")
        #return redirect(url_for('index'))
        return jsonify(success=False, message="Admin privileges required."), 401
    #return redirect(url_for('admin_dashboard'))
"""

def async_upload_chunk(node_url, chunk_data, chunk_id):
    try:
        response = requests.post(
            f"{node_url}/chunk",
            data=chunk_data,
            headers={"X-Chunk-ID": chunk_id}
        )
    except Exception as e:
        logging.error(f"Error uploading chunk {chunk_id} to {node_url}: {str(e)}")

def run_api_server():
    #print("root path:", app.root_path)
    #print("templates:", app.template_folder)

    try:
        #run_metadata()
        app.run(host='0.0.0.0', port=5100, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        logging.info("Server interrupted by user.")
    except Exception as e:
        logging.error(f"Unexpected error: {e}")

if __name__ == "__main__":
    run_api_server()