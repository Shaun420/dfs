// src/components/FileExplorer.jsx
// This component displays file/folder lists and handles actions.
// It consumes authentication state from the Nanostores authStore.

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderIcon,
  ArrowUpTrayIcon,
  FolderPlusIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  HomeIcon
} from '@heroicons/react/24/outline';
import FileItem from './FileItem';
import FileUploader from './FileUploader'; // Assuming FileUploader is rendered as a modal here
import BreadcrumbNav from './BreadcrumbNav'; // Assuming BreadcrumbNav is rendered here

// Import Nanostores hook and the auth store
import { useStore } from '@nanostores/react'; // <-- Import useStore
import { authStore } from '../stores/auth'; // <-- Import the authStore
import { listFiles, getDownloadUrl } from "../libs/api";

export default function FileExplorer({ initialPath = '/' }) {
   // --- Consume authentication status from the Nanostore ---
   // We might need isAuthenticated and isAdmin to disable/hide certain actions.
   // We also need loading to potentially show a full page loading state if auth is required to view files.
   const { isAuthenticated, isAdmin, loading } = useStore(authStore); // <-- Use useStore

  // Ensure initialPath always ends with a slash if it's not the root
  const initialFormattedPath = initialPath === '/' ? '/' : initialPath.replace(/\/?$/, '/');

  const [currentPath, setCurrentPath] = useState(initialFormattedPath);
  const [files, setFiles] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Keep local loading for file list fetch
  const [error, setError] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [history, setHistory] = useState([initialFormattedPath]);
  const [historyIndex, setHistoryIndex] = useState(0);


  // Fetch files and directories for the current path
  // This fetch should potentially wait for authentication status to load if the API is protected.
  const fetchData = useCallback(async (dir) => {
    // --- Optional: Wait for auth state to load before fetching files ---
    // If the /browse API requires authentication, you might need to wait until 'loading' is false.
    // This is a design choice. You could also let the API return 401 and handle that.
    // For simplicity here, we'll assume /browse handles authentication internally or allows unauthenticated browse.
    // If you NEED to wait:
    // if (loading) return; // Or useEffect that only runs when !loading

    setIsLoading(true); // Start local loading for file list
    setError(null);
    try {
      // Use the internal currentPath state for fetching
      const data = await listFiles(currentPath);

		const filesList = Object.entries(data.files || {}).map(([path, metadata]) => ({
			name: path.split('/').pop(), path: path, size: metadata.size, modified: metadata.last_modified, type: 'file'
		}));
		const dirsList = (data.directories || []).map(dir => {
			const formattedDir = dir.endsWith('/') ? dir : dir + '/';
			return { name: formattedDir.split('/').slice(-2)[0] || 'Root', path: formattedDir, type: 'directory' };
		});

		setFiles(filesList);
		setDirectories(dirsList);
		// setCurrentDir(dir); // Update state only after successful fetch
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.message);
    } finally {
      setIsLoading(false); // Stop local loading for file list
    }
  }, [currentPath]); // fetchFiles depends on currentPath


  // Effect to trigger fetching when currentPath changes (Remains the same)
  useEffect(() => {
    fetchData(currentPath); // Use currentPath directly here
  }, [currentPath, fetchData]); // Dependencies on currentPath and fetchData (safe due to useCallback)


  // Effect to handle initial browser history state and popstate listener (Remains largely the same)
   useEffect(() => {
       const currentBrowserPath = window.location.pathname;
       const expectedBrowserPath = initialPath === '/' ? '/files' : `/files${initialPath.replace(/\/+$/, '')}`;

       if (!currentBrowserPath.startsWith(expectedBrowserPath)) {
             const pathSegments = initialFormattedPath.split('/').filter(segment => segment !== '');
             const browserUrl = '/files/' + pathSegments.join('/');
             window.history.pushState({ path: initialFormattedPath }, '', browserUrl);
       }

       const handlePopState = (event) => {
             const pathFromUrl = window.location.pathname.replace(/^\/files/, '');
             const pathSegments = pathFromUrl.split('/').filter(segment => segment !== '');
             const newCurrentPath = '/' + pathSegments.join('/') + (pathSegments.length > 0 ? '/' : '');
             const formattedNewCurrentPath = newCurrentPath === '/' ? '/' : newCurrentPath.replace(/\/?$/, '/');

             setHistory(prevHistory => {
                  const historyMatchIndex = prevHistory.findIndex(h => h === formattedNewCurrentPath);
                  if(historyMatchIndex !== -1) {
                      setHistoryIndex(historyMatchIndex);
                  } else {
                       const newHistory = prevHistory.slice(0, historyIndex + 1);
                       newHistory.push(formattedNewCurrentPath);
                       setHistoryIndex(newHistory.length - 1);
                       return newHistory;
                  }
                  return prevHistory;
             });

             setCurrentPath(formattedNewCurrentPath); // Update state to trigger fetch
         };

         window.addEventListener('popstate', handlePopState);
         return () => { window.removeEventListener('popstate', handlePopState); };
    // Only initialPath and historyIndex are direct dependencies influencing the setup/state calculation here.
    // currentPath changes *as a result* of this effect's logic or user interaction, not trigger it.
   }, [initialPath]); // Removed historyIndex from this dependency array to avoid infinite loops


  // Navigate to a directory (Remains the same)
  const navigateToDirectory = useCallback((path) => {
    const formattedPath = path === '/' ? '/' : path.replace(/\/?$/, '/');
    if (formattedPath !== currentPath) {
       const pathSegments = formattedPath.split('/').filter(segment => segment !== '');
       const browserUrl = '/files/' + pathSegments.join('/');
       window.history.pushState({ path: formattedPath }, '', browserUrl);

       setHistory(prevHistory => {
         const newHistory = [...prevHistory.slice(0, historyIndex + 1), formattedPath];
         setHistoryIndex(newHistory.length - 1);
         return newHistory;
       });

      setCurrentPath(formattedPath); // THIS TRIGGERS fetchData via its useEffect dependency
    }
  }, [currentPath, historyIndex]); // Dependencies for useCallback


  // Go back/forward/home (Remains the same, use browser history)
  const goBack = () => { if (historyIndex > 0) { window.history.back(); } };
  const goForward = () => { if (historyIndex < history.length - 1) { window.history.forward(); } };
  const goHome = useCallback(() => { navigateToDirectory('/'); }, [navigateToDirectory]); // Use useCallback


  // Download a file (Remains the same, ensure item.path is correct)
  const handleDownload = useCallback(async (item) => {
     // Assuming item.path is the full path like /dfs/... or /path/to/file
     // Ensure /download endpoint expects this path structure
	 console.log("Attempting to download file:", item.name, item.path);

	 const downloadUrl = getDownloadUrl(item.path); // Call the utility
	 
	 console.log("Generated download URL:", downloadUrl);

	 let a = document.createElement("a");
	 a.href = downloadUrl;
	 a.setAttribute("download", item.name);
	 a.setAttribute("target", "_blank");
	 a.click();
	 //window.location.href = downloadUrl; // Use the URL returned by the utility
  }, []);


  // Rename (Remains the same, ensure API call uses credentials)
  const handleRename = useCallback((item) => {
    setSelectedItem(item);
    setNewName(item.name);
    setIsRenaming(true);
  }, []);

  const submitRename = async () => {
    if (!newName || !selectedItem || newName === selectedItem.name + (selectedItem.type === 'directory' ? '/' : '')) {
      setIsRenaming(false); setSelectedItem(null); return;
    }
    try {
      const oldPath = selectedItem.path;
      const lastSlashIndex = oldPath.endsWith('/') && oldPath.length > 1 ? oldPath.slice(0, -1).lastIndexOf('/') : oldPath.lastIndexOf('/');
      const parentDir = lastSlashIndex <= 0 ? '/' : oldPath.substring(0, lastSlashIndex + 1);
      const newPath = `${parentDir}${newName}${selectedItem.type === 'directory' ? '/' : ''}`;
      console.log(`Renaming from ${oldPath} to ${newPath}`);
      const response = await fetch('/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', },
        body: new URLSearchParams({ old_path: oldPath, new_path: newPath }),
        credentials: 'include' // Ensure credentials for protected API
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Failed to rename item: ${errorData.message}`);
      }
      fetchData(currentPath); // Refresh list
    } catch (err) {
      console.error('Error renaming item:', err); alert('Failed to rename item: ' + err.message);
    } finally {
      setIsRenaming(false); setSelectedItem(null);
    }
  };

  // Delete (Remains the same, ensure API call uses credentials)
  const handleDelete = useCallback((item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) { return; }
    async function performDelete() {
       try {
           const response = await fetch(`/delete${encodeURIComponent(item.path)}`, {
               method: 'POST',
               credentials: 'include' // Ensure credentials for protected API
            });
           if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: response.statusText }));
              throw new Error(`Failed to delete item: ${errorData.message}`);
           }
           fetchData(currentPath); // Refresh list
       } catch (err) {
           console.error('Error deleting item:', err); alert('Failed to delete item: ' + err.message);
       }
    }
    performDelete();
  }, [currentPath, fetchData]);


  // Create new folder (Remains the same, ensure API call uses credentials)
  const handleCreateFolder = async () => {
    if (!newFolderName || /[\\/:"*?<>|]/.test(newFolderName)) { alert('Invalid folder name'); return; }
    try {
      const newFolderPath = `${currentPath}${newFolderName}/`;
      const response = await fetch('/create-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ path: newFolderPath }),
        credentials: 'include' // Ensure credentials for protected API
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Failed to create folder: ${errorData.message}`);
      }
      fetchData(currentPath); // Refresh list
      setNewFolderName(''); setShowNewFolderDialog(false);
    } catch (err) {
      console.error('Error creating folder:', err); alert('Failed to create folder: ' + err.message);
    }
  };

  // Handle file upload completion (Remains the same)
  const handleUploadComplete = () => {
    setShowUploader(false);
    fetchData(currentPath); // Refresh file list
  };

  const canGoUp = currentPath !== '/';
  const currentDirName = currentPath === '/' ? 'Root' : currentPath.split('/').filter(Boolean).pop() + '/';


  // --- Main Render Logic ---
  // Show loading state from the STORE while initial AUTH check is in progress.
  // Use the 'loading' property from the store state obtained via useStore.
   if (loading) {
        console.log("FileExplorer loading state from store is true (Auth Loading). Rendering loading overlay.");
       // Render a full-page overlay or loading state while auth is being checked
       // (if viewing files requires auth)
       return (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
                <span className="ml-4 text-gray-700 dark:text-gray-300">Loading authentication status...</span>
            </div>
       ); // Render auth loading overlay
   }


  // Show local loading state while FILE LIST is being fetched for the current path.
   if (isLoading) {
        console.log("FileExplorer local isLoading state is true (File List Loading).");
        // Render the explorer structure but with a spinner where the list goes
        return (
             <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
                 {/* Navigation toolbar */}
                 <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                    {/* Toolbar buttons based on auth status */}
                     <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-2">
                             <button onClick={goBack} disabled={historyIndex <= 0} className="..." aria-label="Go Back"><ChevronLeftIcon className="h-5 w-5" /></button>
                             <button onClick={goForward} disabled={historyIndex >= history.length - 1} className="..." aria-label="Go Forward"><ChevronRightIcon className="h-5 w-5" /></button>
                             <button onClick={goHome} disabled={currentPath === '/'} className="..." aria-label="Go to Home"><HomeIcon className="h-5 w-5" /></button>
                             <button onClick={() => navigateToDirectory(currentPath.substring(0, currentPath.lastIndexOf('/', currentPath.length - 2) + 1))} disabled={!canGoUp} className="..." aria-label="Go Up Directory"><ArrowUpTrayIcon className="h-5 w-5 rotate-180" /></button>
                             <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
                             <button onClick={() => fetchData(currentPath)} className="..." aria-label="Refresh"><ArrowPathIcon className="h-5 w-5" /></button>
                         </div>
                         {/* Upload/New Folder buttons only if authenticated */}
                         {isAuthenticated && (
                            <div className="flex items-center space-x-2">
                                <button onClick={() => setShowNewFolderDialog(true)} className="..."> <FolderPlusIcon className="h-4 w-4 mr-1.5" />New Folder </button>
                                <button onClick={() => setShowUploader(true)} className="..."> <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />Upload </button>
                            </div>
                         )}
                     </div>
                     <BreadcrumbNav path={currentPath} onNavigate={navigateToDirectory} className="mt-2" />
                 </div>
                 {/* Loading indicator in the main content area */}
                 <div className="px-4 py-3 flex justify-center items-center h-64">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                 </div>
                 {/* Modals */}
                 {showUploader && (
                    <FileUploader currentPath={currentPath} onClose={() => setShowUploader(false)} onUploadComplete={handleUploadComplete} />
                 )}
                  {showNewFolderDialog && ( /* ... New Folder Modal JSX ... */
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
                  )}
                  {isRenaming && selectedItem && ( /* ... Rename Modal JSX ... */
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
                  )}
             </div>
        ); // Render file list loading state
   }

   // Show error state if fetching file list failed (after loading is false)
   if (error) {
        console.log("FileExplorer error state:", error);
        return (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
                 {/* Navigation toolbar (can still be shown) */}
                 <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                     {/* Toolbar buttons based on auth status */}
                     <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-2">
                              <button onClick={goBack} disabled={historyIndex <= 0} className="..." aria-label="Go Back"><ChevronLeftIcon className="h-5 w-5" /></button>
                              <button onClick={goForward} disabled={historyIndex >= history.length - 1} className="..." aria-label="Go Forward"><ChevronRightIcon className="h-5 w-5" /></button>
                              <button onClick={goHome} disabled={currentPath === '/'} className="..." aria-label="Go to Home"><HomeIcon className="h-5 w-5" /></button>
                              <button onClick={() => navigateToDirectory(currentPath.substring(0, currentPath.lastIndexOf('/', currentPath.length - 2) + 1))} disabled={!canGoUp} className="..." aria-label="Go Up Directory"><ArrowUpTrayIcon className="h-5 w-5 rotate-180" /></button>
                              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
                              <button onClick={() => fetchData(currentPath)} className="..." aria-label="Refresh"><ArrowPathIcon className="h-5 w-5" /></button>
                          </div>
                          {isAuthenticated && (
                             <div className="flex items-center space-x-2">
                                 <button onClick={() => setShowNewFolderDialog(true)} className="..."> <FolderPlusIcon className="h-4 w-4 mr-1.5" />New Folder </button>
                                 <button onClick={() => setShowUploader(true)} className="..."> <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />Upload </button>
                             </div>
                          )}
                      </div>
                      <BreadcrumbNav path={currentPath} onNavigate={navigateToDirectory} className="mt-2" />
                 </div>
                 {/* Error message in the main content area */}
                 <div className="text-center py-10">
                   <p className="text-red-500 dark:text-red-400">{error}</p>
                   <button
                     onClick={() => fetchData(currentPath)} // Retry fetching files
                     className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                   >
                     Try Again
                   </button>
                 </div>
                  {/* Modals */}
                 {showUploader && (
                    <FileUploader currentPath={currentPath} onClose={() => setShowUploader(false)} onUploadComplete={handleUploadComplete} />
                 )}
                  {showNewFolderDialog && ( /* ... New Folder Modal JSX ... */
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
                  )}
                  {isRenaming && selectedItem && ( /* ... Rename Modal JSX ... */
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
                  )}
            </div>
        ); // Render error state
   }

   // Show empty state if no files/directories after loading and no error
   if (directories.length === 0 && files.length === 0) {
        console.log("FileExplorer empty state.");
       return (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
                 {/* Navigation toolbar */}
                 <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                     {/* Toolbar buttons based on auth status */}
                     <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-2">
                              <button onClick={goBack} disabled={historyIndex <= 0} className="..." aria-label="Go Back"><ChevronLeftIcon className="h-5 w-5" /></button>
                              <button onClick={goForward} disabled={historyIndex >= history.length - 1} className="..." aria-label="Go Forward"><ChevronRightIcon className="h-5 w-5" /></button>
                              <button onClick={goHome} disabled={currentPath === '/'} className="..." aria-label="Go to Home"><HomeIcon className="h-5 w-5" /></button>
                              <button onClick={() => navigateToDirectory(currentPath.substring(0, currentPath.lastIndexOf('/', currentPath.length - 2) + 1))} disabled={!canGoUp} className="..." aria-label="Go Up Directory"><ArrowUpTrayIcon className="h-5 w-5 rotate-180" /></button>
                              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
                              <button onClick={() => fetchData(currentPath)} className="..." aria-label="Refresh"><ArrowPathIcon className="h-5 w-5" /></button>
                          </div>
                          {isAuthenticated && (
                             <div className="flex items-center space-x-2">
                                 <button onClick={() => setShowNewFolderDialog(true)} className="..."> <FolderPlusIcon className="h-4 w-4 mr-1.5" />New Folder </button>
                                 <button onClick={() => setShowUploader(true)} className="..."> <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />Upload </button>
                             </div>
                          )}
                      </div>
                      <BreadcrumbNav path={currentPath} onNavigate={navigateToDirectory} className="mt-2" />
                 </div>
                 {/* Empty state message in the main content area */}
                 <div className="text-center py-10">
                    <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{currentPath === '/' ? 'Your DFS is empty' : 'This folder is empty'}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                       Upload files or create a new folder to get started.
                    </p>
                    {isAuthenticated && ( /* Show action buttons only if authenticated */
                        <div className="mt-6 flex justify-center space-x-3">
                           <button type="button" onClick={() => setShowNewFolderDialog(true)} className="..."> <FolderPlusIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />New Folder </button>
                           <button type="button" onClick={() => setShowUploader(true)} className="..."> <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" />Upload Files </button>
                       </div>
                    )}
                 </div>
                  {/* Modals */}
                 {showUploader && (
                    <FileUploader currentPath={currentPath} onClose={() => setShowUploader(false)} onUploadComplete={handleUploadComplete} />
                 )}
                  {showNewFolderDialog && ( /* ... New Folder Modal JSX ... */
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
                  )}
                  {isRenaming && selectedItem && ( /* ... Rename Modal JSX ... */
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
                  )}
            </div>
       ); // Render empty state
   }


  // --- Render the file and directory list ---
   console.log("FileExplorer rendering list.");
   return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg"> {/* Removed overflow-hidden */}
          {/* Navigation toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
             <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-2">
                     <button onClick={goBack} disabled={historyIndex <= 0} className="..." aria-label="Go Back"><ChevronLeftIcon className="h-5 w-5" /></button>
                     <button onClick={goForward} disabled={historyIndex >= history.length - 1} className="..." aria-label="Go Forward"><ChevronRightIcon className="h-5 w-5" /></button>
                     <button onClick={goHome} disabled={currentPath === '/'} className="..." aria-label="Go to Home"><HomeIcon className="h-5 w-5" /></button>
                     <button onClick={() => navigateToDirectory(currentPath.substring(0, currentPath.lastIndexOf('/', currentPath.length - 2) + 1))} disabled={!canGoUp} className="..." aria-label="Go Up Directory"><ArrowUpTrayIcon className="h-5 w-5 rotate-180" /></button>
                     <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
                     <button onClick={() => fetchData(currentPath)} className="..." aria-label="Refresh"><ArrowPathIcon className="h-5 w-5" /></button>
                 </div>
                 {/* Upload/New Folder buttons only if authenticated */}
                 {isAuthenticated && ( // <-- Use isAuthenticated from store state
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setShowNewFolderDialog(true)} className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"> <FolderPlusIcon className="h-4 w-4 mr-1.5" />New Folder </button>
                        <button onClick={() => setShowUploader(true)} className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"> <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />Upload </button>
                    </div>
                 )}
             </div>
             <BreadcrumbNav path={currentPath} onNavigate={navigateToDirectory} className="mt-2" />
         </div>

          {/* The file list container */}
          <div className="px-4 py-3 space-y-1">
            {/* Directories */}
            {directories.sort((a, b) => a.name.localeCompare(b.name)).map((directory) => (
              <FileItem
                key={directory.path}
                item={directory}
                onNavigate={() => navigateToDirectory(directory.path)}
                onRename={() => handleRename(directory)}
                onDelete={() => handleDelete(directory)}
                 // Pass isAuthenticated and isAdmin to FileItem if actions need disabling
                 isAuthenticated={isAuthenticated}
                 isAdmin={isAdmin}
              />
            ))}

            {/* Files */}
            {files.sort((a, b) => a.name.localeCompare(b.name)).map((file) => (
              <FileItem
                key={file.path}
                item={file}
                 onNavigate={() => handleDownload(file)} // Example click action
                onDownload={() => handleDownload(file)} // For explicit download button in menu
                onRename={() => handleRename(file)}
                onDelete={() => handleDelete(file)}
                // Pass isAuthenticated and isAdmin to FileItem if actions need disabling
                isAuthenticated={isAuthenticated}
                isAdmin={isAdmin}
              />
            ))}
          </div>

          {/* Modals */}
          {/* Uploader modal */}
          {showUploader && (
             <FileUploader currentPath={currentPath} onClose={() => setShowUploader(false)} onUploadComplete={handleUploadComplete} />
          )}
           {/* New folder dialog */}
           {showNewFolderDialog && ( /* ... New Folder Modal JSX ... */
             <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
           )}
           {/* Rename dialog */}
           {isRenaming && selectedItem && ( /* ... Rename Modal JSX ... */
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> ... </div>
           )}

      </div>
   );
}