from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, send_file
#from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import uuid
import json
import os
import hashlib
import requests
from datetime import datetime, timedelta
import io
import threading
import time
import signal
import logging
import atexit
import subprocess
import random
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
LEASE_DURATION = 60 #seconds

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
                data = json.load(f)
                # Ensure the dictionaries are initialized if the file is new
                if 'file_to_chunks' not in data:
                    data['file_to_chunks'] = {}
                if 'chunk_metadata' not in data:
                    data['chunk_metadata'] = {}
                return data
        except Exception as e:
            logging.error(f"Error loading metadata: {e}")
    return {'file_to_chunks': {}, 'chunk_metadata': {}}


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
        file_to_chunks = metadata.get('file_to_chunks', {})
        chunk_metadata = metadata.get('chunk_metadata', {})

        for file_path, chunk_ids in file_to_chunks.items():
            for chunk_id in chunk_ids:
                if chunk_id in chunk_metadata:
                    chunk_info = chunk_metadata[chunk_id]
                    chunk_servers = chunk_info["chunk_servers"]
                    if not chunk_servers:
                        logging.warning(f"No chunk servers for {chunk_id}")
                        continue

                    for node_id in chunk_servers:
                        try:
                            # Verify chunk exists
                            response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}/exists")
                            if response.status_code != 200 or not bool(response.json().get("exists")):
                                logging.info(f"Chunk {chunk_id} missing on {node_id}, initiating repair")
                                # Repair logic (simplified example)
                                #find another chunk server that contains the file, pick the first one.
                                for potential_node_id in chunk_servers:
                                    if potential_node_id != node_id:
                                        backup_node_id = potential_node_id
                                        break
                                else: # this will occur if there are no other chunk_servers.
                                    logging.error(f"Chunk {chunk_id} missing on {node_id}, and no other replicas exist.")
                                    continue

                                backup_response = requests.get(f"{NODE_MAP[backup_node_id]}/chunk/{chunk_id}")
                                if backup_response.status_code == 200:
                                    async_upload_chunk(NODE_MAP[node_id], backup_response.content, chunk_id)
                                else:
                                    logging.error(f"Could not retrieve file from backup node {backup_node_id} for chunk: {chunk_id}")

                        except Exception as e:
                            logging.error(f"Error during reconciliation: {str(e)}")
                else:
                    logging.warning(f"Chunk {chunk_id} missing from chunk metadata.")
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
    file_to_chunks = metadata['file_to_chunks']
    chunk_metadata = metadata['chunk_metadata']

    chunk_count = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE
    chunks = [str(uuid.uuid4()) for _ in range(chunk_count)]
    file_to_chunks[file_path] = chunks

    available_nodes = list(NODE_MAP.keys()) # get the node IDs

    for chunk_id in chunks:
        # Choose 2 random nodes for each chunk
        chunk_servers = []
        # Ensure a copy exists on two nodes, you can change for more redundancy.
        for i in range(2):
            node_id = available_nodes[i % len(available_nodes)] # simple round robin assignment.  Change if needed.
            chunk_servers.append(node_id)

        chunk_metadata[chunk_id] = {
            "chunk_servers": chunk_servers,
            "version": 0,
            "primary": chunk_servers[0],
            "lease_expiration": (datetime.now() + timedelta(seconds=LEASE_DURATION)).isoformat()
        }

    metadata['file_to_chunks'] = file_to_chunks
    metadata['chunk_metadata'] = chunk_metadata
    save_metadata(metadata)

    return jsonify({
        "path": file_path,
        "chunks": chunks
    })

@app.route('/api/file', methods=['GET'])
def get_file_metadata():
    file_path = request.args.get('path')
    metadata = load_metadata()
    file_to_chunks = metadata.get('file_to_chunks', {})
    chunk_metadata = metadata.get('chunk_metadata', {})

    if file_path not in file_to_chunks:
        return jsonify({"error": "File not found"}), 404

    chunk_ids = file_to_chunks[file_path]
    file_metadata = {
        "size": 0, # placeholder. could calculate if needed.
        "chunks": []
    }

    for chunk_id in chunk_ids:
        if chunk_id in chunk_metadata:
            file_metadata["chunks"].append({
                "chunk_id": chunk_id,
                "chunk_servers": chunk_metadata[chunk_id]["chunk_servers"]
            })
    return jsonify({
        "path": file_path,
        "metadata": file_metadata
    })

@app.route('/api/list', methods=['GET'])
def list_files():
    directory = request.args.get('directory', '/')
    metadata = load_metadata()
    file_to_chunks = metadata.get('file_to_chunks', {})

    files = {}
    for path, chunk_ids in file_to_chunks.items():
        if path.startswith(directory):
            files[path] = {"chunk_count": len(chunk_ids)} # simplified for now.  Can add more metadata if needed.

    return jsonify(files)

@app.route('/api/file/rename', methods=['PUT'])
def rename_file():
    old_path = request.json.get("old_path")
    new_path = request.json.get("new_path")
    metadata = load_metadata()
    file_to_chunks = metadata.get('file_to_chunks', {})

    if old_path not in file_to_chunks:
        return jsonify({"error": "File not found"}), 404

    file_to_chunks[new_path] = file_to_chunks[old_path]
    del file_to_chunks[old_path]

    metadata["file_to_chunks"] = file_to_chunks
    save_metadata(metadata)
    return jsonify({"success": True, "message": "File renamed successfully."}), 200

@app.route('/api/file', methods=['DELETE'])
def delete_file():
    file_path = request.args.get('path')
    metadata = load_metadata()
    file_to_chunks = metadata['file_to_chunks']
    chunk_metadata = metadata['chunk_metadata']

    if file_path not in file_to_chunks:
        return jsonify({"error": "File not found"}), 404

    chunks_to_delete = file_to_chunks[file_path]

    for chunk_id in chunks_to_delete:
        if chunk_id in chunk_metadata:
            del chunk_metadata[chunk_id]  # Remove chunk metadata

    del file_to_chunks[file_path]  # Remove file entry

    metadata['file_to_chunks'] = file_to_chunks
    metadata['chunk_metadata'] = chunk_metadata
    save_metadata(metadata)

    return jsonify({
        "deleted": file_path,
        "chunks_deleted": chunks_to_delete
    })

def run_metadata():
    #print("root path:", app.root_path)
    #print("templates:", app.template_folder)

    # Start node servers
    for port in ports:
        process = run_node(port)
        if process:
            processes.append(process)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, terminate_subprocesses)
    signal.signal(signal.SIGTERM, terminate_subprocesses)
    
    # Start the background reconciliation thread
    threading.Thread(target=reconcile_chunks, daemon=True).start()
    
    try:
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except KeyboardInterrupt:
        logging.info("Server interrupted by user.")
    except Exception as e:
        logging.error(f"Unexpected error: {e}")

if __name__ == "__main__":
    run_metadata()