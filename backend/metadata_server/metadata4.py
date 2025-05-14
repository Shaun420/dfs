from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, send_file
#from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
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
import atexit
import subprocess
from ..utils import utils

atexit.register(lambda: terminate_subprocesses(None, None))

# Set up logging
logging.basicConfig(filename='metadata_server.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'development-key')

# Configuration
METADATA_FILE = 'metadata.json'
CHUNK_SIZE = 4194304  # 4MB chunks
NODE_MAP = {
    "node1": "http://localhost:5001",
    "node2": "http://localhost:5002",
    "node3": "http://localhost:5003"
}

ports = [5001, 5002, 5003]
processes = []

# Function to run node.py with a specific port.
def run_node(port):
    pid_file = f"node_{port}.pid"
    if os.path.exists(pid_file):
        with open(pid_file, 'r') as f:
            pid = int(f.read().strip())
            try:
                os.kill(pid, 0)  # Check if the process with this PID is running
            except OSError:
                # Process does not exist, remove stale pid file
                try:
                    os.remove(pid_file)
                    logging.info(f"Removed stale PID file for port {port}")
                except Exception as e:
                    logging.error(f"Error removing stale PID file for port {port}: {e}")
                    return None
            except Exception as e:
                logging.error(f"Error checking process for port {port}: {e}")
                return None
            else:
                # Process exists, do not start a new one
                logging.info(f"Node already running on port {port} with PID {pid}")
                return None
    try:
        command = ["python", os.path.join(utils.get_home_dir(), "node.py"), "-p", str(port)]  # Use 'python' instead of 'python3' on Windows
        process = subprocess.Popen(command)
        with open(pid_file, 'w') as f:
            f.write(str(process.pid))
        logging.info(f"Started node.py on port {port} with PID {process.pid}")
        return process
    except Exception as e:
        logging.error(f"Error starting node.py on port {port}: {e}")
        return None

# Function to terminate subprocesses
def terminate_subprocesses(signum, frame):
    logging.info("Terminating subprocesses...")
    for process in processes:
        if process is None: continue
        try:
            process.terminate()
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        except Exception as e:
            logging.error(f"Error terminating process {process.pid}: {e}")
    # Remove the PID file on exit
    for port in ports:
        pid_file = f"node_{port}.pid"
        if os.path.exists(pid_file):
            try:
                os.remove(pid_file)
                logging.info(f"Removed PID file for port {port}")
            except Exception as e:
                logging.error(f"Error removing PID file for port {port}: {e}")
    logging.info("All subprocesses terminated.")
    os._exit(0)

# Initialize or load metadata
def load_metadata():
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Error loading metadata: {e}")
    return {}

def save_metadata(metadata):
    try:
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2)
    except Exception as e:
        logging.error(f"Error saving metadata: {e}")

# Asynchronous function for uploading chunks
def async_upload_chunk(node_url, chunk_data, chunk_id):
    try:
        response = requests.post(
            f"{node_url}/chunk",
            data=chunk_data,
            headers={"X-Chunk-ID": chunk_id}
        )
    except Exception as e:
        logging.error(f"Error uploading chunk {chunk_id} to {node_url}: {str(e)}")

# Background reconciliation function
def reconcile_chunks():
    while True:
        metadata = load_metadata()
        for file_path, file_info in metadata.items():
            for replica in file_info["replicas"]:
                node_id = replica["node_id"]
                chunk_ids = replica["chunk_ids"]
                for chunk_id in chunk_ids:
                    try:
                        # Verify chunk exists
                        response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}/exists")
                        if response.status_code != 200 and bool(response.json().get("exists")):
                            logging.info(f"Chunk {chunk_id} missing on {node_id}, initiating repair")
                            # Repair logic (simplified example)
                            backup_node_id = file_info["replicas"][1]["node_id"]
                            backup_response = requests.get(f"{NODE_MAP[backup_node_id]}/chunk/{chunk_id}")
                            if backup_response.status_code == 200:
                                async_upload_chunk(NODE_MAP[node_id], backup_response.content, chunk_id)
                    except Exception as e:
                        logging.error(f"Error during reconciliation: {str(e)}")
        time.sleep(60)  # Run reconciliation every 60 seconds

@app.route('/')
def index():
    return jsonify({"message": "Metadata server is running"}), 200

# API endpoints for programmatic access
@app.route('/api/file', methods=['POST'])
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
def list_files():
    directory = request.args.get('directory', '/')
    metadata = load_metadata()
    files = {path: info for path, info in metadata.items() if path.startswith(directory)}
    return jsonify(files)

@app.route('/api/file', methods=['DELETE'])
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

def run_metadata():
    print("root path:", app.root_path)
    print("templates:", app.template_folder)

    # Start node servers
    for port in ports:
        process = run_node(port)
        if process:
            processes.append(process)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, terminate_subprocesses)
    signal.signal(signal.SIGTERM, terminate_subprocesses)
    
    # Start the background reconciliation thread
    # threading.Thread(target=reconcile_chunks, daemon=True).start()
    
    try:
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except KeyboardInterrupt:
        logging.info("Server interrupted by user.")
    except Exception as e:
        logging.error(f"Unexpected error: {e}")

if __name__ == "__main__":
    run_metadata()
