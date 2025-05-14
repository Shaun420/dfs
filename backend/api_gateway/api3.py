from flask import Flask, request, jsonify
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import requests
import hashlib
import os
import json
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'gateway-secret-key')

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

USERS_FILE = 'gateway_users.json'

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

users = load_users()

class User(UserMixin):
    def __init__(self, username):
        self.id = username

@login_manager.user_loader
def load_user(user_id):
    if user_id in users:
        return User(user_id)
    return None

# Metadata server URL
METADATA_SERVER_URL = os.environ.get('METADATA_SERVER_URL', 'http://localhost:5000')

@app.route('/')
def index():
    return jsonify({"message": "Welcome to the API Gateway!"})

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if username in users:
        return jsonify({"error": "Username already exists"}), 400

    users[username] = {
        "password": hashlib.sha256(password.encode()).hexdigest()
    }
    save_users(users)
    return jsonify({"message": "Registration successful"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = hashlib.sha256(data.get('password').encode()).hexdigest()

    if username in users and users[username]["password"] == password:
        user = User(username)
        login_user(user)
        return jsonify({"message": "Logged in successfully"})
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"})

@app.route('/files', methods=['GET', 'POST', 'DELETE'])
@login_required
def files():
    # Forward file-related requests to the metadata server
    if request.method == 'GET':
        file_path = request.args.get('path', '/')
        response = requests.get(f"{METADATA_SERVER_URL}/api/list", params={"directory": file_path})
        return jsonify(response.json())

    elif request.method == 'POST':
        data = request.json
        response = requests.post(f"{METADATA_SERVER_URL}/api/file", json=data)
        return jsonify(response.json())

    elif request.method == 'DELETE':
        file_path = request.args.get('path')
        response = requests.delete(f"{METADATA_SERVER_URL}/api/file", params={"path": file_path})
        return jsonify(response.json())

@app.route('/file_metadata', methods=['GET'])
@login_required
def file_metadata():
    # Forward metadata requests to the metadata server
    file_path = request.args.get('path')
    response = requests.get(f"{METADATA_SERVER_URL}/api/file", params={"path": file_path})
    return jsonify(response.json())

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=False)