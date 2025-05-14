from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, send_file
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import uuid
import json
import os
import hashlib
import requests
from datetime import datetime
import io
import subprocess
import threading
import time
import signal
import logging
import atexit

# Configuration
METADATA_FILE = 'metadata.json'
CHUNK_SIZE = 4194304  # 4MB chunks
NODE_MAP = {
    "node1": "http://localhost:5001",
    "node2": "http://localhost:5002",
    "node3": "http://localhost:5003"
}
USERS_FILE = 'users.json'

# Logging setup
logging.basicConfig(filename='api_gateway.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Flask App Initialization
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'development-key')

# Flask-Login Manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User Management
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

# Metadata Management Functions
def load_metadata():
    try:
        response = requests.get("http://localhost:5005/metadata")  # Metadata server port 5005
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"Error loading metadata: {e}")
        return {}

def save_metadata(metadata):
    try:
        response = requests.post("http://localhost:5005/metadata", json=metadata)  # Metadata server port 5005
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logging.error(f"Error saving metadata: {e}")

# Asynchronous Chunk Upload
def async_upload_chunk(node_url, chunk_data, chunk_id):
    try:
        response = requests.post(
            f"{node_url}/chunk",
            data=chunk_data,
            headers={"X-Chunk-ID": chunk_id}
        )
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        logging.info(f"Chunk {chunk_id} uploaded successfully to {node_url}")
    except requests.exceptions.RequestException as e:
        logging.error(f"Error uploading chunk {chunk_id} to {node_url}: {str(e)}")

# Web Interface Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/browse')
@login_required
def browse():
    directory = request.args.get('dir', '/')
    metadata = load_metadata()
    files = {path: info for path, info in metadata.items() if path.startswith(directory)}
    directories = set()
    for path in files.keys():
        parts = path.split('/')
        if len(parts) > 2:
            parent_dir = '/'.join(parts[:-1]) + '/'
            if parent_dir.startswith(directory) and parent_dir != directory:
                directories.add(parent_dir)
    return render_template('browse.html', files=files, directories=sorted(directories), current_dir=directory)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if username in users:
            flash("Username already exists")
            return redirect(url_for('register'))
        users[username] = {
            "password": hashlib.sha256(password.encode()).hexdigest()
        }
        save_users(users)
        flash("Registration successful. Please log in.")
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = hashlib.sha256(request.form['password'].encode()).hexdigest()
        if username in users and users[username]["password"] == password:
            user = User(username)
            login_user(user)
            flash("Logged in successfully.")
            return redirect(url_for('index'))
        else:
            flash("Invalid credentials")
            return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash("Logged out.")
    return redirect(url_for('login'))

@app.route('/upload', methods=['GET', 'POST'])
@login_required
def upload_file():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['file']
        directory = request.form.get('directory', '/dfs/')
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        if file:
            file_data = file.read()
            file_size = len(file_data)
            file_path = os.path.join(directory, file.filename)
            chunks = []
            for i in range(0, file_size, CHUNK_SIZE):
                chunk_data = file_data[i:i+CHUNK_SIZE]
                chunk_id = str(uuid.uuid4())
                chunks.append(chunk_id)
                # Asynchronous upload to nodes (2 replicas)
                for node_id in ["node1", "node2"]:
                    threading.Thread(target=async_upload_chunk, args=(NODE_MAP[node_id], chunk_data, chunk_id)).start()

            metadata = load_metadata()
            metadata[file_path] = {
                "size": file_size,
                "created_at": datetime.now().isoformat(),
                "replicas": [
                    {"node_id": "node1", "chunk_ids": chunks},
                    {"node_id": "node2", "chunk_ids": chunks}
                ]
            }
            save_metadata(metadata)
            flash(f"File {file.filename} uploaded successfully")
            return redirect(url_for('browse', dir=directory))
    return render_template('upload.html')

@app.route('/download/<path:file_path>')
@login_required
def download_file(file_path):
    if not file_path.startswith('/'):
        file_path = '/' + file_path
    metadata = load_metadata()
    if file_path not in metadata:
        flash("File not found")
        return redirect(url_for('browse'))

    file_info = metadata[file_path]
    replica = file_info["replicas"][0]
    node_id = replica["node_id"]
    chunk_ids = replica["chunk_ids"]

    file_data = bytearray()
    for chunk_id in chunk_ids:
        try:
            # Check chunk existence
            response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}/exists")
            response.raise_for_status()
            if response.status_code == 200 and bool(response.json().get("exists")):
                # Retrieve chunk
                response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}")
                response.raise_for_status()
                file_data.extend(response.content)
            else:
                # Chunk missing, try backup replica
                if len(file_info["replicas"]) > 1:
                    backup_replica = file_info["replicas"][1]
                    backup_node = backup_replica["node_id"]
                    backup_response = requests.get(f"{NODE_MAP[backup_node]}/chunk/{chunk_id}/exists")
                    backup_response.raise_for_status()
                    if backup_response.status_code == 200 and bool(backup_response.json().get("exists")):
                        backup_response = requests.get(f"{NODE_MAP[backup_node]}/chunk/{chunk_id}")
                        backup_response.raise_for_status()
                        file_data.extend(backup_response.content)
                    else:
                        flash(f"Failed to retrieve chunk {chunk_id} from backup")
                        return redirect(url_for('browse'))
                else:
                    flash(f"Failed to retrieve chunk {chunk_id}")
                    return redirect(url_for('browse'))
        except requests.exceptions.RequestException as e:
            flash(f"Error downloading chunk: {str(e)}")
            return redirect(url_for('browse'))

    filename = os.path.basename(file_path)
    return send_file(
        io.BytesIO(file_data),
        as_attachment=True,
        download_name=filename,
        mimetype='application/octet-stream'
    )

@app.route('/delete/<path:file_path>', methods=['POST'])
@login_required
def delete_file_web(file_path):
    if not file_path.startswith('/'):
        file_path = '/' + file_path
    metadata = load_metadata()
    if file_path not in metadata:
        flash("File not found")
        return redirect(url_for('browse'))

    chunks_to_delete = []
    for replica in metadata[file_path]["replicas"]:
        node_id = replica["node_id"]
        for chunk_id in replica["chunk_ids"]:
            chunks_to_delete.append({
                "node_id": node_id,
                "chunk_id": chunk_id
            })

    for chunk_info in chunks_to_delete:
        try:
            requests.delete(f"{NODE_MAP[chunk_info['node_id']]}/chunk/{chunk_info['chunk_id']}")
        except requests.exceptions.RequestException as e:
            flash(f"Error deleting chunk: {str(e)}")

    del metadata[file_path]
    save_metadata(metadata)
    flash(f"File {os.path.basename(file_path)} deleted successfully")
    return redirect(url_for('browse'))

# API endpoints for programmatic access
@app.route('/api/file', methods=['POST'])
@login_required
def create_file():
    file_data = request.json
    file_path = file_data['path']
    file_size = file_data['size']
    metadata = load_metadata()
    chunk_count = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE
    chunks = [str(uuid.uuid4()) for _ in range(chunk_count)]
    available_nodes = ["node1", "node2", "node3"]
    replicas = []
    for i in range(2):
        node_id = available_nodes[i % len(available_nodes)]
        replicas.append({
            "node_id": node_id,
            "chunk_ids": chunks
        })
    metadata[file_path] = {
        "size": file_size,
        "created_at": datetime.now().isoformat(),
        "replicas": replicas
    }
    save_metadata(metadata)
    return jsonify({
        "path": file_path,
        "chunks": chunks,
        "replicas": replicas
    })

@app.route('/api/file', methods=['GET'])
@login_required
def get_file_metadata():
    file_path = request.args.get('path')
    metadata = load_metadata()
    if file_path not in metadata:
        return jsonify({"error": "File not found"}), 404
    return jsonify({
        "path": file_path,
        "metadata": metadata[file_path]
    })

@app.route('/api/list', methods=['GET'])
@login_required
def list_files():
    directory = request.args.get('directory', '/')
    metadata = load_metadata()
    files = {path: info for path, info in metadata.items() if path.startswith(directory)}
    return jsonify(files)

@app.route('/api/file', methods=['DELETE'])
@login_required
def delete_file():
    file_path = request.args.get('path')
    metadata = load_metadata()
    if file_path not in metadata:
        return jsonify({"error": "File not found"}), 404

    chunks_to_delete = []
    for replica in metadata[file_path]["replicas"]:
        node_id = replica["node_id"]
        for chunk_id in replica["chunk_ids"]:
            chunks_to_delete.append({
                "node_id": node_id,
                "chunk_id": chunk_id
            })

    del metadata[file_path]
    save_metadata(metadata)
    return jsonify({
        "deleted": file_path,
        "chunks_to_delete": chunks_to_delete
    })

@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    if current_user.id != 'admin':  # Basic authorization
        flash("Admin privileges required.")
        return redirect(url_for('index'))

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
    print(node_health)

    return render_template('admin_dashboard.html', node_health=node_health, node_map=NODE_MAP)

@app.route('/admin/refresh_health')
@login_required
def refresh_health():
    if current_user.id != 'admin':
        flash("Admin privileges required.")
        return redirect(url_for('index'))
    return redirect(url_for('admin_dashboard'))

# Main Execution
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)