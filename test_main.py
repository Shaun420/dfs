from main import listFiles, writeFile
def test_listfiles():
	writeFile("avatar.jpg")
	try:
		#print("Test 123")
		print(listFiles())
	except FileNotFoundError as e:
		print("Folder not found.")
		print("Exception:", e)

def test_writefile():
	try:
		writeFile("avatar.jpg")
	except FileNotFoundError as e:
		print("Folder not found.")
		print("Exception:", e)