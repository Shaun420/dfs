from flask import Flask, request, jsonify, send_file, make_response
import os
import io
import uuid
import argparse

app = Flask(__name__)

# Configuration
CHUNK_STORAGE_DIR = 'chunks'
CHUNK_SIZE = 4194304  # 4MB chunks

def is_node_healthy():
    # For now, let's just return True if the process is running
    return True

@app.route('/')
def index():
    return jsonify({"message": "Node server is running"}), 200

@app.route('/health')
def health_check():
    if is_node_healthy():
        return jsonify({"status": "Healthy"}), 200
    else:
        return jsonify({"status": "Unhealthy", "error": "Basic health check failed"}), 200

@app.route('/chunk', methods=['POST'])
def upload_chunk():
    chunk_id = request.headers.get('X-Chunk-ID')
    if not chunk_id:
        return jsonify({"error": "Missing X-Chunk-ID header"}), 400

    chunk_data = request.get_data()
    if not chunk_data:
        return jsonify({"error": "No chunk data provided"}), 400

    chunk_path = os.path.join(CHUNK_STORAGE_DIR, chunk_id)
    
    try:
        with open(chunk_path, 'wb') as chunk_file:
            chunk_file.write(chunk_data)
    except Exception as e:
        print(f"Error uploading chunk {chunk_id}: {e}")
        return jsonify({"error": str(e)}), 500

    print(f"Chunk {chunk_id} uploaded successfully")
    return jsonify({"message": "Chunk uploaded successfully", "chunk_id": chunk_id}), 201

@app.route('/chunk/<chunk_id>', methods=['GET'])
def download_chunk(chunk_id):
    chunk_path = os.path.join(CHUNK_STORAGE_DIR, chunk_id)
    
    if not os.path.exists(chunk_path):
        print(f"Chunk {chunk_id} not found")
        return jsonify({"error": "Chunk not found"}), 404

    try:
        with open(chunk_path, 'rb') as chunk_file:
            chunk_data = chunk_file.read()
    except Exception as e:
        print(f"Error downloading chunk {chunk_id}: {e}")
        return jsonify({"error": str(e)}), 500

    print(f"Chunk {chunk_id} downloaded successfully")
    return send_file(
        io.BytesIO(chunk_data),
        as_attachment=True,
        download_name=chunk_id,
        mimetype='application/octet-stream'
    )

@app.route('/chunk/<chunk_id>', methods=['DELETE'])
def delete_chunk(chunk_id):
    chunk_path = os.path.join(CHUNK_STORAGE_DIR, chunk_id)
    
    if not os.path.exists(chunk_path):
        print(f"Chunk {chunk_id} not found")
        return jsonify({"error": "Chunk not found"}), 404

    try:
        os.remove(chunk_path)
    except Exception as e:
        print(f"Error deleting chunk {chunk_id}: {e}")
        return jsonify({"error": str(e)}), 500

    print(f"Chunk {chunk_id} deleted successfully")
    return jsonify({"message": "Chunk deleted successfully", "chunk_id": chunk_id}), 200

@app.route('/chunk/<chunk_id>/exists', methods=['GET'])
def check_chunk_exists(chunk_id):
    chunk_path = os.path.join(CHUNK_STORAGE_DIR, chunk_id)
    
    if os.path.exists(chunk_path):
        print(f"Chunk {chunk_id} exists")
        return jsonify({"exists": True}), 200
    else:
        print(f"Chunk {chunk_id} does not exist")
        return jsonify({"exists": False}), 200

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="DFS Node Server")
    parser.add_argument("-p", "--port", type=int, default=5001, help="Port number (default: 5001)")
    args = parser.parse_args()
    #print(f"Node server port: {args.port}")
    CHUNK_STORAGE_DIR = os.path.join("chunks", str(args.port))

    # Ensure chunk storage directory exists
    if not os.path.exists(CHUNK_STORAGE_DIR):
        os.makedirs(CHUNK_STORAGE_DIR)

    try:
        app.run(host='127.0.0.1', port=args.port, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        print("Node server interrupted by user.")
    except Exception as e:
        print(f"Unexpected error: {e}")