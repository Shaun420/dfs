from flask import Flask, request, jsonify, send_file
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import uuid
import json
import os
import io
import requests
import threading
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(filename='metadata_server.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'metadata-secret-key')

# Configuration
METADATA_FILE = 'metadata.json'
CHUNK_SIZE = 4194304  # 4MB chunks
NODE_MAP = {
    "node1": "http://localhost:5001",
    "node2": "http://localhost:5002",
    "node3": "http://localhost:5003"
}

# Flask-Login setup (simplified for API use)
login_manager = LoginManager()
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, username):
        self.id = username

@login_manager.request_loader
def load_user_from_request(request):
    # Simple token-based auth for API calls
    # In production, you would use a more secure method like JWT
    api_key = request.headers.get('Authorization')
    if api_key:
        # You would validate the token here
        return User("api_user")
    return None

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
        import time
        time.sleep(60)  # Run reconciliation every 60 seconds

# API endpoints
@app.route('/api/chunk/upload', methods=['POST'])
def upload_chunk():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    chunk_id = request.form.get('chunk_id', str(uuid.uuid4()))
    node_ids = request.form.getlist('node_ids')
    
    if not node_ids:
        node_ids = ["node1", "node2"]  # Default replication
    
    file_data = file.read()
    
    for node_id in node_ids:
        if node_id in NODE_MAP:
            threading.Thread(
                target=async_upload_chunk, 
                args=(NODE_MAP[node_id], file_data, chunk_id)
            ).start()
    
    return jsonify({
        "chunk_id": chunk_id,
        "size": len(file_data),
        "replicated_to": node_ids
    })

@app.route('/api/file', methods=['POST'])
def create_file():
    file_data = request.json
    file_path = file_data['path']
    file_content = file_data.get('content')
    file_size = file_data.get('size', 0)
    
    metadata = load_metadata()
    
    if file_content:  # If content is provided directly
        file_size = len(file_content.encode('utf-8'))
        chunk_id = str(uuid.uuid4())
        
        # Store the content in nodes
        for node_id in ["node1", "node2"]:
            threading.Thread(
                target=async_upload_chunk,
                args=(NODE_MAP[node_id], file_content.encode('utf-8'), chunk_id)
            ).start()
            
        chunks = [chunk_id]
    else:  # Just register the file structure
        chunk_count = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE
        chunks = [str(uuid.uuid4()) for _ in range(chunk_count)]
    
    # Create metadata entry
    available_nodes = ["node1", "node2", "node3"]
    replicas = []
    for i in range(2):  # Create 2 replicas
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

@app.route('/api/file/download', methods=['GET'])
def download_file():
    file_path = request.args.get('path')
    metadata = load_metadata()
    
    if file_path not in metadata:
        return jsonify({"error": "File not found"}), 404
        
    file_info = metadata[file_path]
    replica = file_info["replicas"][0]
    node_id = replica["node_id"]
    chunk_ids = replica["chunk_ids"]
    
    file_data = bytearray()
    
    for chunk_id in chunk_ids:
        try:
            response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}")
            if response.status_code == 200:
                file_data.extend(response.content)
            else:
                # Try backup replica
                if len(file_info["replicas"]) > 1:
                    backup_replica = file_info["replicas"][1]
                    backup_node = backup_replica["node_id"]
                    backup_response = requests.get(f"{NODE_MAP[backup_node]}/chunk/{chunk_id}")
                    if backup_response.status_code == 200:
                        file_data.extend(backup_response.content)
                    else:
                        return jsonify({"error": f"Failed to retrieve chunk {chunk_id}"}), 404
                else:
                    return jsonify({"error": f"Failed to retrieve chunk {chunk_id}"}), 404
        except Exception as e:
            return jsonify({"error": f"Error downloading chunk: {str(e)}"}), 500
    
    # Return raw file data if requested by API
    if request.args.get('raw') == 'true':
        filename = os.path.basename(file_path)
        return send_file(
            io.BytesIO(file_data),
            as_attachment=True,
            download_name=filename,
            mimetype='application/octet-stream'
        )
    
    # Otherwise return base64 encoded data
    import base64
    return jsonify({
        "path": file_path,
        "size": len(file_data),
        "data": base64.b64encode(file_data).decode('utf-8')
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
    
    # Collect all chunks to delete from all replicas
    for replica in metadata[file_path]["replicas"]:
        node_id = replica["node_id"]
        for chunk_id in replica["chunk_ids"]:
            chunks_to_delete.append({
                "node_id": node_id,
                "chunk_id": chunk_id
            })
    
    # Delete chunks from storage nodes
    for chunk_info in chunks_to_delete:
        try:
            requests.delete(f"{NODE_MAP[chunk_info['node_id']]}/chunk/{chunk_info['chunk_id']}")
        except Exception as e:
            logging.error(f"Error deleting chunk: {str(e)}")
    
    # Delete metadata entry
    del metadata[file_path]
    save_metadata(metadata)
    
    return jsonify({
        "deleted": file_path,
        "chunks_deleted": len(chunks_to_delete)
    })

@app.route('/api/health', methods=['GET'])
def health_check():
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
    
    return jsonify({
        "service": "metadata_server",
        "status": "healthy",
        "nodes": node_health,
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    # Start the background reconciliation thread
    threading.Thread(target=reconcile_chunks, daemon=True).start()
    
    # Start the server
    app.run(host='0.0.0.0', port=5000, debug=False)