from flask import Flask
import os, datetime

STATIC_DIR = "static"

"""
Metadata dictionary
To make:-
{
"/dfs/documents/file1.txt": {
	"size": 1048576,
	"created_at": "2024-12-24T12:00:00",
	"replicas": [
		{"node_id": "node1", "chunk_ids": ["chunk1", "chunk2"]},
		{"node_id": "node2", "chunk_ids": ["chunk1", "chunk2"]}
	]
    }
}
Currently:-
{
"/dfs/documents/file1.txt": {
	"size": 1048576,
	"created_at": "2024-12-24T12:00:00",
	"replicas": [
		"node1", "node2"
	]
    }
}

"""

files = {}

# List operation
def listFiles():
	#result = os.listdir(STATIC_DIR)
	return files

app = Flask(__name__)

# Write operation
def writeFile(filename: str):
	path = os.path.join(STATIC_DIR, filename)
	if not os.path.exists(path):
		print("File to upload not found.")
		return
	statinfo = os.stat(path)
	filesize = statinfo.st_size
	if filesize % 64000 == 0:
		chunks = int(filesize / 64000)
	else:
		chunks = int(filesize / 64000) + 1
	files[filename] = {
		"size": filesize,
		"created_at": datetime.datetime.now(datetime.UTC).isoformat(),
		"chunks": chunks,
		"replicas": ["node1", "node2", "node3"]
	}
	#print(statinfo)
	#print("{}, {}".format(filesize, chunks))
	return

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"
