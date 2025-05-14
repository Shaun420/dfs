# --- MAIN SERVER (metadata.py) ---

from flask import Flask, request, jsonify
import uuid
import sqlite3
import hashlib
from datetime import datetime

app = Flask(__name__)

# Database setup
def init_db():
    conn = sqlite3.connect('metadata.db')
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT,
        size INTEGER,
        created_at TEXT,
        hash TEXT
    )''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file_id TEXT,
        chunk_number INTEGER,
        node_id TEXT,
        FOREIGN KEY (file_id) REFERENCES files (id)
    )''')
    conn.commit()
    conn.close()

@app.before_first_request
def setup():
    init_db()

# API endpoints
@app.route('/file', methods=['POST'])
def create_file():
    file_data = request.json
    file_id = str(uuid.uuid4())
    
    conn = sqlite3.connect('metadata.db')
    c = conn.cursor()
    c.execute(
        "INSERT INTO files VALUES (?, ?, ?, ?, ?)",
        (file_id, file_data['filename'], file_data['size'], 
         datetime.now().isoformat(), file_data['hash'])
    )
    conn.commit()
    
    # Create chunk entries
    chunk_count = (file_data['size'] + 4194304 - 1) // 4194304  # 4MB chunks
    chunks = []
    
    for i in range(chunk_count):
        chunk_id = str(uuid.uuid4())
        # Select a node (simple round-robin for this example)
        node_id = f"node_{i % 3 + 1}"
        
        c.execute(
            "INSERT INTO chunks VALUES (?, ?, ?, ?)",
            (chunk_id, file_id, i, node_id)
        )
        chunks.append({
            'id': chunk_id,
            'node_id': node_id,
            'chunk_number': i
        })
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'file_id': file_id,
        'chunks': chunks
    })

@app.route('/file/<file_id>', methods=['GET'])
def get_file_metadata(file_id):
    conn = sqlite3.connect('metadata.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    file = dict(c.fetchone())
    
    c.execute("SELECT * FROM chunks WHERE file_id = ? ORDER BY chunk_number", (file_id,))
    chunks = [dict(row) for row in c.fetchall()]
    
    conn.close()
    
    return jsonify({
        'file': file,
        'chunks': chunks
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)