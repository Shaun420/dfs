import subprocess
import os
import atexit
import signal

atexit.register(lambda: terminate_subprocesses(None, None))

processes = []

# Function to terminate subprocesses
def terminate_subprocesses(signum, frame):
    print("Terminating metadata server & api gateway")

    for process in processes:
        if process is None: continue
        try:
            process.terminate()
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        except Exception as e:
            print(f"Error terminating process {process.pid}: {e}")

    pid_names = ["metadata.pid", "api_gateway.pid"]
    # Remove the PID file on exit
    for pid in pid_names:
        if os.path.exists(pid):
            try:
                os.remove(pid)
                print(f"Removed PID file for {pid}")
            except Exception as e:
                print(f"Error removing PID file for {pid}: {e}")
    print("All subprocesses terminated.")
    os._exit(0)

"""
# Function to run metadata server
def run_metadata():
    pid_file = f"metadata.pid"
    if os.path.exists(pid_file):
        print("Metadata pid file exists")
        with open(pid_file, 'r') as f:
            pid = int(f.read().strip())
            try:
                os.kill(pid, 0)  # Check if the process with this PID is running
            except OSError:
                # Process does not exist, remove stale pid file
                try:
                    os.remove(pid_file)
                    logging.info(f"Removed stale PID file for metadata.py")
                except Exception as e:
                    logging.error(f"Error removing stale PID file for metadata.py: {e}")
                    return None
            except Exception as e:
                logging.error(f"Error checking process for metadata.py: {e}")
                return None
            else:
                # Process exists, do not start a new one
                logging.info(f"Metadata server already running with PID {pid}")
                return None
    try:
        logging.info("Metadata server starting")
        command = ["python", os.path.join(utils.get_home_dir(), "metadata_server", "metadata4.py")]
        #logging.info("Command:", command)
        process = subprocess.Popen(command)
        logging.info("Process id: " + str(process.pid))
        with open(pid_file, 'w') as f:
            f.write(str(process.pid))
        logging.info(f"Started metadata server with PID {process.pid}")
        return process
    except Exception as e:
        logging.error(f"Error starting metadata server: {e}")
        return None
"""

if __name__ == "__main__":
    try:
        process = subprocess.Popen(["python", "-m", "backend.metadata_server.metadata5"])
        if process:
            with open("metadata.pid", 'w') as f:
                f.write(str(process.pid))
            processes.append(process)
            print(f"Started metadata.py with PID {process.pid}")
    except Exception as e:
        print(f"Error starting metadata.py: {e}")

    try:
        process = subprocess.Popen(["python", "-m", "backend.api_gateway.api5"])
        if process:
            with open("api_gateway.pid", 'w') as f:
                f.write(str(process.pid))
            processes.append(process)
        print(f"Started api gateway with PID {process.pid}")
    except Exception as e:
        print(f"Error starting api gateway: {e}")
    
    # Register signal handlers
    signal.signal(signal.SIGINT, terminate_subprocesses)
    signal.signal(signal.SIGTERM, terminate_subprocesses)

    processes[0].wait()
