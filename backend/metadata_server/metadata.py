from flask import Flask, request, jsonify
import json
import os
from datetime import datetime

app = Flask(__name__)
METADATA_FILE = 'metadata.json'

def load_metadata():
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_metadata(data):
    with open(METADATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/metadata', methods=['GET'])
def get_metadata():
    path = request.args.get('path')
    metadata = load_metadata()
    if path not in metadata:
        return jsonify({"error": "File not found"}), 404
    return jsonify(metadata[path])

@app.route('/metadata', methods=['POST'])
def create_metadata():
    data = request.json
    metadata = load_metadata()
    metadata[data['path']] = {
        "size": data['size'],
        "created_at": datetime.now().isoformat(),
        "replicas": data['replicas']
    }
    save_metadata(metadata)
    return jsonify({"status": "created", "path": data['path']}), 201

@app.route('/metadata', methods=['DELETE'])
def delete_metadata():
    path = request.args.get('path')
    metadata = load_metadata()
    if path not in metadata:
        return jsonify({"error": "File not found"}), 404
    del metadata[path]
    save_metadata(metadata)
    return jsonify({"status": "deleted", "path": path})

if __name__ == '__main__':
    app.run(port=6000)
