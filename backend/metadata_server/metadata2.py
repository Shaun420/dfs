from flask import Flask, request, jsonify
import json
import os
import logging

METADATA_FILE = 'metadata.json'

# Logging setup
logging.basicConfig(filename='metadata_server.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

# Load metadata on startup
metadata = {}
if os.path.exists(METADATA_FILE):
    try:
        with open(METADATA_FILE, 'r') as f:
            metadata = json.load(f)
    except Exception as e:
        logging.error(f"Error loading metadata from file: {e}")
        metadata = {}  # Initialize as empty dict if loading fails

@app.route('/metadata', methods=['GET'])
def get_metadata():
    logging.debug(f"Returning metadata: {metadata}")
    return jsonify(metadata)

@app.route('/metadata', methods=['POST'])
def update_metadata():
    global metadata
    try:
        metadata = request.get_json()
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2)
        logging.info("Metadata updated successfully.")
        return jsonify({"message": "Metadata updated successfully."}), 200
    except Exception as e:
        logging.error(f"Error updating metadata: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005, debug=True)  # Running on port 5005