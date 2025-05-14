// src/lib/fileUtils.js

/**
 * Utility functions for file operations and formatting
 */

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size with units
 */
export function formatFileSize(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  /**
   * Format date in a human-readable format
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date
   */
  export function formatDate(date) {
	if (!date) return 'Unknown';
	
	try {
	  const dateObj = typeof date === 'string' ? new Date(date) : date;
	  return dateObj.toLocaleString();
	} catch (error) {
	  console.error('Error formatting date:', error);
	  return 'Invalid date';
	}
  }
  
  /**
   * Format relative time (e.g., "2 hours ago")
   * @param {string|Date} date - Date to format
   * @returns {string} Relative time string
   */
  export function formatRelativeTime(date) {
	if (!date) return 'Unknown';
	
	try {
	  const dateObj = typeof date === 'string' ? new Date(date) : date;
	  const now = new Date();
	  const diffMs = now - dateObj;
	  const diffSec = Math.floor(diffMs / 1000);
	  const diffMin = Math.floor(diffSec / 60);
	  const diffHour = Math.floor(diffMin / 60);
	  const diffDay = Math.floor(diffHour / 24);
	  
	  if (diffSec < 60) {
		return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
	  } else if (diffMin < 60) {
		return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
	  } else if (diffHour < 24) {
		return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
	  } else if (diffDay < 30) {
		return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
	  } else {
		return dateObj.toLocaleDateString();
	  }
	} catch (error) {
	  console.error('Error formatting relative time:', error);
	  return 'Unknown';
	}
  }
  
  /**
   * Get file extension from filename
   * @param {string} filename - Filename to parse
   * @returns {string} File extension (lowercase, without dot)
   */
  export function getFileExtension(filename) {
	if (!filename) return '';
	return filename.split('.').pop().toLowerCase();
  }
  
  /**
   * Determine file type based on extension
   * @param {string} filename - Filename to check
   * @returns {string} File type category
   */
  export function getFileType(filename) {
	if (!filename) return 'unknown';
	
	const extension = getFileExtension(filename);
	
	const typeMap = {
	  // Images
	  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'ico'],
	  // Documents
	  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'],
	  // Audio
	  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'],
	  // Video
	  video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v'],
	  // Archives
	  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
	  // Code
	  code: ['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'yaml', 'yml', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift']
	};
	
	for (const [type, extensions] of Object.entries(typeMap)) {
	  if (extensions.includes(extension)) {
		return type;
	  }
	}
	
	return 'other';
  }
  
  /**
   * Get appropriate icon for a file based on its type
   * @param {string} filename - Filename to check
   * @returns {string} Icon name or path
   */
  export function getFileIcon(filename) {
	const type = getFileType(filename);
	
	// This would be expanded with actual icon names/paths
	const iconMap = {
	  image: 'photo',
	  document: 'document',
	  audio: 'music-note',
	  video: 'film',
	  archive: 'archive-box',
	  code: 'code-bracket',
	  other: 'document'
	};
	
	return iconMap[type] || 'document';
  }
  
  /**
   * Parse a directory path into segments
   * @param {string} path - Path to parse
   * @returns {Array} Array of path segments
   */
  export function parsePath(path) {
	if (!path) return [];
	
	// Remove leading and trailing slashes, then split
	const cleanPath = path.replace(/^\/|\/$/g, '');
	if (!cleanPath) return [];
	
	return cleanPath.split('/');
  }
  
  /**
   * Build a path from segments
   * @param {Array} segments - Path segments
   * @returns {string} Formatted path
   */
  export function buildPath(segments) {
	if (!segments || !segments.length) return '/';
	return '/' + segments.join('/') + '/';
  }
  
  /**
   * Get parent directory path
   * @param {string} path - Current path
   * @returns {string} Parent directory path
   */
  export function getParentPath(path) {
	const segments = parsePath(path);
	if (segments.length === 0) return '/';
	
	segments.pop();
	return buildPath(segments);
  }
  
  /**
   * Validate a filename
   * @param {string} filename - Filename to validate
   * @returns {boolean} True if valid
   */
  export function isValidFilename(filename) {
	if (!filename || filename.trim() === '') return false;
	
	// Check for invalid characters
	const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/;
	if (invalidChars.test(filename)) return false;
	
	// Check for reserved names (Windows)
	const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
	if (reservedNames.test(filename)) return false;
	
	return true;
  }
  
  /**
 * Check if a file should be previewable in browser
 * @param {string} filename - Filename to check
 * @returns {boolean} True if previewable
 */
export function isPreviewable(filename) {
	const type = getFileType(filename);
	const extension = getFileExtension(filename);
	
	// Image files
	if (type === 'image') {
	  return true;
	}
	
	// Text files
	const textExtensions = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'csv'];
	if (textExtensions.includes(extension)) {
	  return true;
	}
	
	// PDF files
	if (extension === 'pdf') {
	  return true;
	}
	
	// Video files that browsers typically support
	const browserVideoExtensions = ['mp4', 'webm', 'ogg'];
	if (type === 'video' && browserVideoExtensions.includes(extension)) {
	  return true;
	}
	
	// Audio files that browsers typically support
	const browserAudioExtensions = ['mp3', 'wav', 'ogg'];
	if (type === 'audio' && browserAudioExtensions.includes(extension)) {
	  return true;
	}
	
	return false;
  }
  
  /**
   * Generate a safe filename by removing invalid characters
   * @param {string} filename - Original filename
   * @returns {string} Safe filename
   */
  export function sanitizeFilename(filename) {
	if (!filename) return 'untitled';
	
	// Replace invalid characters with underscores
	return filename
	  .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')
	  .replace(/\s+/g, '_')
	  .replace(/__+/g, '_')
	  .trim();
  }
  
  /**
   * Sort files and directories
   * @param {Array} items - Array of file/directory objects
   * @param {string} sortBy - Property to sort by
   * @param {boolean} ascending - Sort direction
   * @returns {Array} Sorted array
   */
  export function sortItems(items, sortBy = 'name', ascending = true) {
	if (!items || !items.length) return [];
	
	// Clone the array to avoid modifying the original
	const sorted = [...items];
	
	// Function to determine if an item is a directory
	const isDirectory = item => item.type === 'directory';
	
	// Sort function based on the sortBy parameter
	const getSortValue = (item, property) => {
	  switch (property) {
		case 'name':
		  return item.name.toLowerCase();
		case 'size':
		  return item.size || 0;
		case 'modified':
		  return new Date(item.modified || 0).getTime();
		case 'type':
		  return getFileType(item.name);
		default:
		  return item.name.toLowerCase();
	  }
	};
	
	// Sort the array
	return sorted.sort((a, b) => {
	  // Directories always come first
	  if (isDirectory(a) && !isDirectory(b)) return -1;
	  if (!isDirectory(a) && isDirectory(b)) return 1;
	  
	  // Then sort by the specified property
	  const aValue = getSortValue(a, sortBy);
	  const bValue = getSortValue(b, sortBy);
	  
	  // Compare values
	  if (aValue < bValue) return ascending ? -1 : 1;
	  if (aValue > bValue) return ascending ? 1 : -1;
	  
	  // If values are equal, sort by name as a tiebreaker
	  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
	});
  }
  
  /**
   * Filter items by search term
   * @param {Array} items - Array of file/directory objects
   * @param {string} searchTerm - Term to search for
   * @returns {Array} Filtered array
   */
  export function filterItems(items, searchTerm) {
	if (!items || !items.length) return [];
	if (!searchTerm || searchTerm.trim() === '') return items;
	
	const term = searchTerm.toLowerCase().trim();
	
	return items.filter(item => {
	  // Search in name
	  if (item.name.toLowerCase().includes(term)) return true;
	  
	  // Search in file type
	  const fileType = getFileType(item.name);
	  if (fileType.includes(term)) return true;
	  
	  // Additional metadata search could be added here
	  
	  return false;
	});
  }
  
  /**
   * Get a color for a file type
   * @param {string} filename - Filename to check
   * @returns {string} Tailwind CSS color class
   */
  export function getFileColor(filename) {
	const type = getFileType(filename);
	
	const colorMap = {
	  image: 'text-blue-500',
	  document: 'text-gray-500',
	  audio: 'text-pink-500',
	  video: 'text-purple-500',
	  archive: 'text-amber-500',
	  code: 'text-green-500',
	  other: 'text-gray-500'
	};
	
	return colorMap[type] || 'text-gray-500';
  }
  
  /**
   * Check if a path is a subdirectory of another path
   * @param {string} parentPath - Parent directory path
   * @param {string} childPath - Path to check
   * @returns {boolean} True if childPath is a subdirectory of parentPath
   */
  export function isSubdirectory(parentPath, childPath) {
	// Normalize paths to have consistent format
	const normParent = parentPath.replace(/\/$/, '') + '/';
	const normChild = childPath.replace(/\/$/, '') + '/';
	
	return normChild.startsWith(normParent) && normChild !== normParent;
  }
  
  /**
   * Extract filename from a path
   * @param {string} path - Full path
   * @returns {string} Filename
   */
  export function getFilenameFromPath(path) {
	if (!path) return '';
	return path.split('/').filter(Boolean).pop() || '';
  }