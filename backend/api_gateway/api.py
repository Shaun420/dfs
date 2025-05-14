from flask import Flask, render_template, request, redirect, url_for, session, send_file, jsonify
import os
import json
import requests
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'secret'
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Metadata server base URL
METADATA_URL = "http://localhost:6000/metadata"

# ========== User Auth ==========
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        users = load_users()
        if username in users:
            return 'Username already exists'
        
        users[username] = password
        save_users(users)
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        users = load_users()
        if users.get(username) == password:
            session['username'] = username
            return redirect(url_for('dashboard'))
        else:
            return 'Invalid credentials'

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('index'))

# ========== Dashboard ==========
@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('login'))

    files = list_metadata()
    return render_template('dashboard.html', files=files)

# ========== File Operations ==========

@app.route('/upload', methods=['POST'])
def upload():
    if 'username' not in session:
        return redirect(url_for('login'))

    file = request.files['file']
    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)

        metadata = {
            'path': filename,
            'size': os.path.getsize(file_path),
            'replicas': [UPLOAD_FOLDER]
        }
        save_metadata_to_server(metadata)
        return redirect(url_for('dashboard'))
    return 'No file selected'

@app.route('/download/<filename>')
def download(filename):
    if 'username' not in session:
        return redirect(url_for('login'))

    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return 'File not found'

@app.route('/delete/<filename>')
def delete(filename):
    if 'username' not in session:
        return redirect(url_for('login'))

    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    delete_metadata_from_server(filename)
    return redirect(url_for('dashboard'))

# ========== Helpers ==========

def load_users():
    if os.path.exists('users.json'):
        with open('users.json', 'r') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open('users.json', 'w') as f:
        json.dump(users, f)

def list_metadata():
    try:
        # Since metadata server stores metadata by file path keys
        response = requests.get(METADATA_URL)
        return response.json()
    except Exception as e:
        print(f"Metadata fetch error: {e}")
        return {}

def save_metadata_to_server(metadata):
    try:
        response = requests.post(METADATA_URL, json=metadata)
        return response.json()
    except Exception as e:
        print(f"Metadata save error: {e}")
        return {}

def delete_metadata_from_server(filename):
    try:
        response = requests.delete(METADATA_URL, params={'path': filename})
        return response.json()
    except Exception as e:
        print(f"Metadata delete error: {e}")
        return {}

if __name__ == '__main__':
    app.run(port=5000, debug=True)
