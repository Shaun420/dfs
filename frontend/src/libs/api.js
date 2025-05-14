// src/lib/api.js

/**
 * API client for interacting with the Distributed File System backend
 */

// Base URL for API requests
let API_BASE_URL = "https://server.shaun420.eu.org";
if (import.meta.env.DEV) {
	API_BASE_URL = "https://localhost";
}

/**
 * Generic request handler with error management
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
async function request(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    // Parse the JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * @typedef {object} AuthData
 * @property {boolean} success
 * @property {string} message
 * @property {string} [user] - Optional user identifier
 */
/**
 * Get authentication status
 * @returns {Promise<AuthData>} User information if authenticated
 */
export async function checkAuth() {
  return request('/test');
}

/**
 * Logout the current user
 * @returns {Promise<Object>} Logout result
 */
export async function logout() {
  return request('/logout');
}

/**
 * Current user google login
 * @returns {Promise<Object>} OAuth result
 */
export async function login() {
	return request('/google/login');
  }
  
/**
 * Get files and directories at the specified path
 * @param {string} directory - Directory path
 * @returns {Promise<Object>} Files and directories data
 */
export async function listFiles(directory = '/') {
  return request(`/browse?dir=${encodeURIComponent(directory)}`);
}

/**
 * Download a file
 * @param {string} filePath - Path to the file
 * @returns {string} Download URL
 */
export function getDownloadUrl(filePath) {
    // Assuming filePath starts with a slash, encode it, then append to the download prefix
    const cleanedPath = filePath.startsWith('/') ? encodeURIComponent(filePath.substring(1)) : encodeURIComponent(newPath);
    const encodedPath = encodeURIComponent(cleanedPath); // URL encode the entire path part, including slashes if present

    // The URL in the browser needs to be relative to the frontend origin,
    // and the Astro proxy handles forwarding /download to the backend.
    // So the URL should be `/download/${encodedPath}`
    // The API_BASE_URL might better represent the backend base if you were fetching data,
    // but for window.location.href, it should be the frontend's origin + proxied path.

    // Let's update API_BASE_URL assumption or build the URL explicitly based on origin
    // Or, more simply, build the proxied path and let window.location.href use the current origin implicitly
    // If your proxy is configured to forward `/download/*` to the backend:
    return `${API_BASE_URL}/download/${encodedPath}`; // Returns just the path relative to the current origin (e.g., /download/%2Fdfs%2F...)
}
/**
 * Rename a file or directory
 * @param {string} oldPath - Current path
 * @param {string} newPath - New path
 * @returns {Promise<Object>} Rename result
 */
export async function renameItem(oldPath, newPath) {
  const formData = new URLSearchParams();
  formData.append('old_path', oldPath);
  formData.append('new_path', newPath);
  
  return request('/rename', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });
}

/**
 * Delete a file or directory
 * @param {string} path - Path to delete
 * @returns {Promise<Object>} Delete result
 */
export async function deleteItem(path) {
  return request(`/delete${path}`, {
    method: 'POST',
  });
}

/**
 * Create a new directory
 * @param {string} path - Directory path to create
 * @returns {Promise<Object>} Create directory result
 */
export async function createDirectory(path) {
  return request('/create-directory', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

/**
 * Upload a file with progress tracking
 * @param {File} file - File to upload
 * @param {string} directory - Target directory
 * @param {Function} onProgress - Progress callback
 * @param {Function} onComplete - Completion callback
 * @param {Function} onError - Error callback
 */
// src/lib/api.js
// ... other imports and functions ...

// Assuming API_BASE_URL might be defined for *other* backend calls,
// but for /upload which is proxied, the endpoint should be relative.
// If your utility uses API_BASE_URL for other functions, keep its definition.
// But for upload, use a relative path.
export function uploadFile(file, directory, onProgress, onComplete, onError) {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('directory', directory);
  
	const xhr = new XMLHttpRequest();
  
	// Set up progress tracking
	xhr.upload.addEventListener('progress', (event) => {
	  if (event.lengthComputable) {
		const percentComplete = Math.round((event.loaded / event.total) * 100);
		onProgress(percentComplete); // Call the provided onProgress callback
	  }
	});
  
	// Set up completion handler
	xhr.onload = () => {
	  if (xhr.status >= 200 && xhr.status < 300) {
		try {
		  const response = JSON.parse(xhr.responseText);
		  onComplete(response); // Call the provided onComplete callback
		} catch (error) {
		  // Error parsing response is also an error case for this file
		  console.error("Failed to parse upload response:", error);
		  onError('Failed to parse backend response'); // Call the provided onError callback
		}
	  } else {
		// Non-2xx status from the backend API Gateway
		 let errorMessage = `Upload failed: HTTP ${xhr.status}`;
		 // Attempt to parse a JSON error message if backend sends one
		 try {
			 const errorData = JSON.parse(xhr.responseText);
			 if (errorData.message) {
				 errorMessage = `Upload failed: ${errorData.message}`;
			 } else if (errorData.error) {
				  errorMessage = `Upload failed: ${errorData.error}`;
			 }
		 } catch (e) { /* Ignore JSON parse error */ }
		onError(errorMessage); // Call the provided onError callback
	  }
	};
  
	// Set up error handler (network errors)
	xhr.onerror = () => {
	  console.error("Network error during upload.");
	  onError('Network error occurred'); // Call the provided onError callback
	};
  
	 // Set up abort handler
	 xhr.onabort = () => {
		  console.log("Upload aborted.");
		  onError('Upload cancelled'); // Call the provided onError callback with cancelled status
	 };
  
  
	// Start upload
	// Use a relative path if you're using the Astro proxy
	// If API_BASE_URL exists in lib/api and points to the backend directly, use that.
	// If using proxy, '/upload' is correct. Let's use relative path assuming proxy.
	xhr.open('POST', `${API_BASE_URL}/upload`, true); // <-- Use relative path if proxied
  
	// Add authentication credentials (cookies) for the request to the API Gateway.
	// This is required if your /upload endpoint is protected or needs the session.
	xhr.withCredentials = true; // <-- Add this line to send cookies
  
	xhr.send(formData);
  
	// Return an abort function linked to this specific XHR
	return {
	  abort: () => xhr.abort()
	};
  }

/**
 * Get node status information (admin only)
 * @returns {Promise<Object>} Node status data
 */
export async function getNodeStatus() {
  return request('/admin/dashboard');
}

/**
 * Get file metadata
 * @param {string} path - File path
 * @returns {Promise<Object>} File metadata
 */
export async function getFileMetadata(path) {
  return request(`/api/file?path=${encodeURIComponent(path)}`);
}

/**
 * Check if a path exists
 * @param {string} path - Path to check
 * @returns {Promise<boolean>} True if path exists
 */
export async function checkPathExists(path) {
  try {
    await request(`/api/file?path=${encodeURIComponent(path)}`);
    return true;
  } catch (error) {
    if (error.message.includes('404')) {
      return false;
    }
    throw error;
  }
}