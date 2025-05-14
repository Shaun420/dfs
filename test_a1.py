from a1 import listFiles, writeChunk
def test_listfiles():
	#writeFile("avatar.jpg")
	try:
		#print("Test 123")
		print(listFiles())
	except FileNotFoundError as e:
		print("Folder not found.")
		print("Exception:", e)

def test_writechunk():
	try:
		writeChunk("avatar.jpg-1", b"abc")
	except FileNotFoundError as e:
		print("Folder not found.")
		print("Exception:", e)