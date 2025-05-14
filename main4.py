from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, send_file
import uuid
import json
import os
import hashlib
import requests
from datetime import datetime
import io
from templates import templates

import subprocess
import threading
import time

# Function to run node.py with a specific port.
def run_node(port):
    try:
        command = ["python3", "node.py", "-p", str(port)]
        process = subprocess.Popen(command)
        print(f"Started node.py on port {port} with PID {process.pid}")
        return process
    except Exception as e:
        print(f"Error starting node.py on port {port}: {e}")
        return None

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

# Initialize or load metadata
def load_metadata():
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_metadata(metadata):
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

# Asynchronous function for uploading chunks
def async_upload_chunk(node_url, chunk_data, chunk_id):
    try:
        response = requests.post(
            f"{node_url}/chunk",
            data=chunk_data,
            headers={"X-Chunk-ID": chunk_id}
        )
    except Exception as e:
        print(f"Error uploading chunk {chunk_id} to {node_url}: {str(e)}")

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
                        response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}")
                        if response.status_code != 200:
                            print(f"Chunk {chunk_id} missing on {node_id}, initiating repair")
                            # Repair logic (simplified example)
                            backup_node_id = file_info["replicas"][1]["node_id"]
                            backup_response = requests.get(f"{NODE_MAP[backup_node_id]}/chunk/{chunk_id}")
                            if backup_response.status_code == 200:
                                async_upload_chunk(NODE_MAP[node_id], backup_response.content, chunk_id)
                    except Exception as e:
                        print(f"Error during reconciliation: {str(e)}")
        time.sleep(60)  # Run reconciliation every 60 seconds

# Web interface routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/browse')
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

@app.route('/upload', methods=['GET', 'POST'])
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
def download_file(file_path):
    metadata = load_metadata()
    
    if not file_path.startswith('/'):
        file_path = '/' + file_path
    
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
            response = requests.get(f"{NODE_MAP[node_id]}/chunk/{chunk_id}")
            if response.status_code == 200:
                file_data.extend(response.content)
            else:
                if len(file_info["replicas"]) > 1:
                    backup_replica = file_info["replicas"][1]
                    backup_node = backup_replica["node_id"]
                    backup_response = requests.get(f"{NODE_MAP[backup_node]}/chunk/{chunk_id}")
                    if backup_response.status_code == 200:
                        file_data.extend(backup_response.content)
                    else:
                        flash(f"Failed to retrieve chunk {chunk_id}")
                        return redirect(url_for('browse'))
                else:
                    flash(f"Failed to retrieve chunk {chunk_id}")
                    return redirect(url_for('browse'))
        except Exception as e:
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
        except Exception as e:
            flash(f"Error deleting chunk: {str(e)}")
    
    del metadata[file_path]
    save_metadata(metadata)
    
    flash(f"File {os.path.basename(file_path)} deleted successfully")
    return redirect(url_for('browse'))

# API endpoints for programmatic access
@app.route('/api/file', methods=['POST'])
def create_file():
    file_data = request.json
    file_path = file_data['path']
    file_size = file_data['size']
    
    metadata = load_metadata()
    chunk_count = (file_size + CHUNK_SIZE - 1)
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

# Templates for the web interface
@app.route('/templates')
def get_templates():    
    template_name = request.args.get('name')
    if template_name in templates:
        return templates[template_name]
    return jsonify({"available_templates": list(templates.keys())})

if __name__ == '__main__':
    ports = [5001, 5002, 5003]
    processes = []

    for port in ports:
        process = run_node(port)
        if process:
            processes.append(process)

    # Start the background reconciliation thread
    threading.Thread(target=reconcile_chunks, daemon=True).start()

    if not os.path.exists('templates'):
        os.makedirs('templates')
        
    for template_name, template_content in templates.items():
        if template_name.endswith('.html'):
            with open(os.path.join('templates', template_name), 'w') as f:
                f.write(template_content)
    
    app.run(host='0.0.0.0', port=5000, debug=True)