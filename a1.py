# --- NODE SERVER (node.py) ---

from flask import Flask, request, jsonify, send_file
import os
import hashlib
import uuid
import io

app = Flask(__name__)

# Configuration
NODE_ID = os.environ.get('NODE_ID', 'node1')
STORAGE_PATH = os.environ.get('STORAGE_PATH', './storage')

# Ensure storage directory exists
os.makedirs(STORAGE_PATH, exist_ok=True)

@app.route('/chunk', methods=['POST'])
def store_chunk():
    # Get the binary data
    chunk_data = request.data
    chunk_id = request.headers.get('X-Chunk-ID')
    
    if not chunk_id:
        chunk_id = str(uuid.uuid4())
    
    # Calculate hash for integrity
    chunk_hash = hashlib.sha256(chunk_data).hexdigest()
    
    # Store the chunk
    chunk_path = os.path.join(STORAGE_PATH, chunk_id)
    with open(chunk_path, 'wb') as f:
        f.write(chunk_data)
    
    return jsonify({
        'chunk_id': chunk_id,
        'node_id': NODE_ID,
        'size': len(chunk_data),
        'hash': chunk_hash
    })

@app.route('/chunk/<chunk_id>', methods=['GET'])
def get_chunk(chunk_id):
    chunk_path = os.path.join(STORAGE_PATH, chunk_id)
    
    if not os.path.exists(chunk_path):
        return jsonify({'error': 'Chunk not found'}), 404
    
    return send_file(chunk_path)

@app.route('/chunk/<chunk_id>', methods=['DELETE'])
def delete_chunk(chunk_id):
    chunk_path = os.path.join(STORAGE_PATH, chunk_id)
    
    if not os.path.exists(chunk_path):
        return jsonify({'error': 'Chunk not found'}), 404
    
    # Delete the chunk
    os.remove(chunk_path)
    
    return jsonify({
        'deleted': chunk_id,
        'node_id': NODE_ID,
        'status': 'success'
    })

@app.route('/status', methods=['GET'])
def get_status():
    # Count chunks and calculate total storage used
    chunks = os.listdir(STORAGE_PATH)
    total_size = sum(os.path.getsize(os.path.join(STORAGE_PATH, f)) for f in chunks)
    
    return jsonify({
        'node_id': NODE_ID,
        'chunks_count': len(chunks),
        'storage_used': total_size,
        'status': 'online'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))