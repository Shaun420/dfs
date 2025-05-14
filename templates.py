templates = {
    "index.html": """
<!DOCTYPE html>
<html>
<head>
    <title>Distributed File System</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .menu { display: flex; gap: 20px; margin-bottom: 20px; }
        .menu a { text-decoration: none; padding: 10px; background: #f0f0f0; color: #333; border-radius: 4px; }
        .menu a:hover { background: #e0e0e0; }
    </style>
</head>
<body>
    <h1>Distributed File System</h1>
    <div class="menu">
        <a href="/browse">Browse Files</a>
        <a href="/upload">Upload File</a>
    </div>
    <p>Welcome to the Distributed File System. Use the menu above to browse or upload files.</p>
</body>
</html>
        """,
        "browse.html": """
<!DOCTYPE html>
<html>
<head>
    <title>Browse Files</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2 { color: #333; }
        .menu { display: flex; gap: 20px; margin-bottom: 20px; }
        .menu a { text-decoration: none; padding: 10px; background: #f0f0f0; color: #333; border-radius: 4px; }
        .menu a:hover { background: #e0e0e0; }
        .file-list { border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-top: 20px; }
        .file-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; }
        .file-item:last-child { border-bottom: none; }
        .file-actions { display: flex; gap: 10px; }
        .file-actions a, .file-actions form button { 
            text-decoration: none; 
            padding: 5px 10px; 
            border-radius: 4px; 
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .download { background: #4CAF50; color: white; }
        .delete { background: #f44336; color: white; }
        .breadcrumb { margin-bottom: 15px; }
        .breadcrumb a { text-decoration: none; color: #0066cc; }
        .dir-item { padding: 8px; border-bottom: 1px solid #eee; }
        .flash-message { 
            padding: 10px; 
            background-color: #f8d7da; 
            color: #721c24; 
            border-radius: 4px; 
            margin-bottom: 15px; 
        }
    </style>
</head>
<body>
    <h1>Browse Files</h1>
    <div class="menu">
        <a href="/">Home</a>
        <a href="/upload">Upload File</a>
    </div>
    
    {% if get_flashed_messages() %}
    <div class="flash-message">
        {% for message in get_flashed_messages() %}
            {{ message }}
        {% endfor %}
    </div>
    {% endif %}
    
    <div class="breadcrumb">
        <a href="/browse?dir=/">Root</a>
        {% set path_parts = current_dir.split('/') %}
        {% set current_path = '' %}
        {% for part in path_parts %}
            {% if part %}
                {% set current_path = current_path + '/' + part %}
                / <a href="/browse?dir={{ current_path }}">{{ part }}</a>
            {% endif %}
        {% endfor %}
    </div>
    
    <div class="file-list">
        <h2>Directories</h2>
        {% if directories %}
            {% for dir in directories %}
                <div class="dir-item">
                    <a href="/browse?dir={{ dir }}">{{ dir }}</a>
                </div>
            {% endfor %}
        {% else %}
            <p>No directories found.</p>
        {% endif %}
        
        <h2>Files</h2>
        {% if files %}
            {% for path, info in files.items() %}
                {% if path.startswith(current_dir) and path != current_dir and path.count('/') == current_dir.count('/') + 1 %}
                <div class="file-item">
                    <div>
                        <strong>{{ path.split('/')[-1] }}</strong>
                        <br>
                        <small>Size: {{ info.size // 1024 }} KB | Created: {{ info.created_at.split('T')[0] }}</small>
                    </div>
                    <div class="file-actions">
                        <a href="/download{{ path }}" class="download">Download</a>
                        <form action="/delete{{ path }}" method="post" onsubmit="return confirm('Are you sure you want to delete this file?');">
                            <button type="submit" class="delete">Delete</button>
                        </form>
                    </div>
                </div>
                {% endif %}
            {% endfor %}
        {% else %}
            <p>No files found in this directory.</p>
        {% endif %}
    </div>
</body>
</html>
        """,
        "upload.html": """
<!DOCTYPE html>
<html>
<head>
    <title>Upload File</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .menu { display: flex; gap: 20px; margin-bottom: 20px; }
        .menu a { text-decoration: none; padding: 10px; background: #f0f0f0; color: #333; border-radius: 4px; }
        .menu a:hover { background: #e0e0e0; }
        .upload-form { border: 1px solid #ddd; border-radius: 4px; padding: 20px; margin-top: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"], input[type="file"] { width: 100%; padding: 8px; box-sizing: border-box; }
        button { padding: 10px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #45a049; }
        .flash-message { 
            padding: 10px; 
            background-color: #f8d7da; 
            color: #721c24; 
            border-radius: 4px; 
            margin-bottom: 15px; 
        }
    </style>
</head>
<body>
    <h1>Upload File</h1>
    <div class="menu">
        <a href="/">Home</a>
        <a href="/browse">Browse Files</a>
    </div>
    
    {% if get_flashed_messages() %}
    <div class="flash-message">
        {% for message in get_flashed_messages() %}
            {{ message }}
        {% endfor %}
    </div>
    {% endif %}
    
    <div class="upload-form">
        <form method="post" enctype="multipart/form-data">
            <div class="form-group">
                <label for="directory">Directory (e.g., /dfs/documents/)</label>
                <input type="text" id="directory" name="directory" value="/dfs/" required>
            </div>
            <div class="form-group">
                <label for="file">Select File</label>
                <input type="file" id="file" name="file" required>
            </div>
            <button type="submit">Upload</button>
        </form>
    </div>
</body>
</html>
	"""
}