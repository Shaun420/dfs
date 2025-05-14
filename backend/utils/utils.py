import os
import sys

HOME_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def get_home_dir() -> str:
	return HOME_DIR

if __name__ == "__main__":
	print("Home dir:", HOME_DIR)
