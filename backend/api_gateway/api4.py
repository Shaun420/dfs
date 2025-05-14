from flask import Flask, request, jsonify, redirect, url_for, send_file
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
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

# Set up logging
logging.basicConfig(filename='api_gateway.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, root_path=utils.get_home_dir())
app.secret_key = os.environ.get('SECRET_KEY', 'development-key')

# Configuration
CHUNK_SIZE = 4194304  # 4MB chunks
NODE_MAP = {
    "node1": "http://localhost:5001",
    "node2": "http://localhost:5002",
    "node3": "http://localhost:5003"
}

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

USERS_FILE = os.path.join(utils.get_home_dir(), "api_gateway", "users.json")

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

@login_manager.user_loader
def load_user(user_id):
    if user_id in users:
        return User(user_id)
    return None

# Web interface routes
@app.route('/')
def index():
    return jsonify(success=True, message="Distributed File System API Gateway"), 200

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
        #flash('No file part')
        #return redirect(request.url)
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    directory = request.form.get('directory', '/dfs/')
    if file.filename == '':
        #flash('No selected file')
        #return redirect(request.url)
        return jsonify({'success': False, 'message': 'No selected file'}), 400
    if file:
        try:
            file_data = file.read()
            file_size = len(file_data)
            file_path = os.path.join(directory, file.filename)
            file_info = requests.post("http://localhost:5000/api/file", json={
                "path": file_path,
                "size": file_size
            }).json()
            chunks = file_info["chunks"]
            threads = []
            for i in range(0, file_size, CHUNK_SIZE):
                chunk_data = file_data[i:i+CHUNK_SIZE]
                chunk_id = chunks[i // CHUNK_SIZE]
                # Asynchronous upload to nodes (2 replicas)
                for node_id in ["node1", "node2"]:
                    thread = threading.Thread(target=async_upload_chunk, args=(NODE_MAP[node_id], chunk_data, chunk_id))
                    threads.append(thread)
                    thread.start()

            # Wait for all threads to complete
            for thread in threads:
                thread.join()
            return jsonify({success: True, message: f"File {file.filename} uploaded successfully", "directory": directory}), 200
        except Exception as e:
                    response_data = {'success': False, 'message': f"Upload failed: {str(e)}"}
                    return jsonify(response_data), 500
    #return render_template('upload.html')

@app.route('/download/<path:file_path>')
def download_file(file_path):
    metadata = requests.get("http://localhost:5000/api/file?path=" + file_path).json()
    if "error" in metadata:
        return jsonify({
            'success': False,
            'message': "File not found"
        }), 404
    file_info = metadata["metadata"]
    replica = file_info["replicas"][0]
    node_id = replica["node_id"]
    chunk_ids = replica["chunk_ids"]
    file_data = bytearray()
    try:
        for chunk_id in chunk_ids:
            try:
                response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}/exists")
                if response.status_code == 200 and bool(response.json().get("exists")):
                    response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}")
                    file_data.extend(response.content)
                else:
                    if len(file_info["replicas"]) > 1:
                        backup_replica = file_info["replicas"][1]
                        backup_node = backup_replica["node_id"]
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
        filename = os.path.basename(file_path)
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
