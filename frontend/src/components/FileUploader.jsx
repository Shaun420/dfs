// src/components/FileUploader.jsx
// This component provides a modal UI for uploading files with drag-and-drop and progress tracking.

import React, { useState, useRef, useEffect } from 'react'; // Added useEffect
import {
  ArrowUpTrayIcon, // Icon for upload or drag/drop area
  XMarkIcon,       // Icon for closing or removing files
  DocumentIcon,    // Default file icon
  CheckCircleIcon, // Icon for successful upload
  ExclamationCircleIcon, // Icon for failed upload
  TrashIcon        // Icon for removing files from the list
} from '@heroicons/react/24/outline';
import { uploadFile } from '../libs/api'; 

// Define types for clarity (Optional, but recommended if using TypeScript)
// interface UploadFileItem {
//   file: File; // The actual File object
//   id: string; // Unique ID for state tracking (e.g., 'file-timestamp-random')
//   progress: number; // 0-100 percentage for this file
//   error: string | null; // Error message if upload failed
//   status: 'pending' | 'uploading' | 'complete' | 'failed'; // Current status of this file
// }

// Props interface for the component
// interface FileUploaderProps {
//    currentPath: string; // The target directory for uploads (e.g., '/dfs/uploads/')
//    onClose: () => void; // Function to call when the modal should be closed
//    onUploadComplete: () => void; // Function to call when all uploads are finished (success or fail)
// }


// Note: This component does NOT need a client: directive on its export.
// It is intended to be rendered conditionally by a parent component (like FileExplorer)
// which is itself part of a client:loaded island (AppRoot).
export default function FileUploader({ currentPath, onClose, onUploadComplete }) {
  // --- State variables ---
  // filesToUpload: Array of objects, each representing a file to upload and its status/progress.
  const [filesToUpload, setFilesToUpload] = useState([]);
  // uploading: True when the upload process has started for the batch of files.
  const [uploading, setUploading] = useState(false);
  // overallProgress: The calculated average progress (0-100%) across all files being uploaded.
  const [overallProgress, setOverallProgress] = useState(0);
  // uploadFinished: True when all pending/failed uploads in the current batch have reached a final state (complete or failed).
  const [uploadFinished, setUploadFinished] = useState(false);

  // --- Refs ---
  // fileInputRef: Ref to the hidden file input element, used to trigger clicks from the "Browse Files" button.
  const fileInputRef = useRef(null);
  // activeUploadsRef: Ref to store XMLHttpRequest instances for active uploads, allows aborting them.
  const activeUploadsRef = useRef({});


  // --- useEffect Hook for Handling ESC Key to Close Modal ---
  // This effect runs once on mount and cleans up on unmount.
  useEffect(() => {
    const handleEscape = (event) => {
      // Allow closing with ESC only if no uploads are in progress or if uploads are finished.
      if (event.key === 'Escape') {
         if (!uploading || uploadFinished) {
            onClose(); // Call the onClose prop
         } else {
            // Optional: Ask for confirmation if uploads are in progress and ESC is pressed.
             if (confirm('Uploads are in progress. Are you sure you want to cancel and close?')) {
                // Abort all active uploads before closing.
                 Object.values(activeUploadsRef.current).forEach(xhr => xhr.abort());
                 onClose(); // Call the onClose prop
             }
         }
      }
    };

    // Add the event listener when the component mounts.
    document.addEventListener('keydown', handleEscape);

    // --- Cleanup Function ---
    // Remove the event listener when the component unmounts.
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
    // Dependencies: onClose, uploading, uploadFinished - ensure the latest state/prop values are used in the handler.
  }, [onClose, uploading, uploadFinished]);


  // --- useEffect Hook for Cleaning Up Active Uploads on Unmount ---
  // This effect's cleanup function ensures any ongoing XHRs are aborted if the component is unmounted
  // (e.g., if the modal is closed programmatically or by the user before uploads finish).
   useEffect(() => {
        // --- Cleanup Function ---
        return () => {
            console.log("FileUploader unmounting. Aborting active uploads.");
            // Iterate through all stored XHR references and abort them.
            Object.values(activeUploadsRef.current).forEach(xhr => {
                if (xhr && typeof xhr.abort === 'function') {
                    xhr.abort();
                }
            });
             // Clear the ref itself
             activeUploadsRef.current = {};
        };
   }, []); // Empty dependency array: runs the setup on mount and cleanup on unmount.


  // --- Handle File Selection from Input ---
  // Called when the user selects files using the hidden input field.
  const handleFileSelect = (e) => {
    console.log("Files selected from input.");
    const selectedFiles = Array.from(e.target.files); // Get the array of File objects.

    // Map selected files into our internal state structure with initial 'pending' status.
    const newFiles = selectedFiles.map((file, index) => ({
      file: file, // Store the actual File object
      // Create a unique ID for each file item to reliably track it in state.
      // Using timestamp + original index + random number is a simple way to ensure uniqueness.
      id: `file-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`,
      status: 'pending', // Initial status
      progress: 0,      // Initial progress
      error: null       // No error initially
    }));

    // Add the new files to the existing list of files to upload.
    setFilesToUpload(prevFiles => [...prevFiles, ...newFiles]);

    // Clear the value of the file input element.
    // This is important so that if the user opens the file dialog again
    // and selects the exact same files, the 'onChange' event will still fire.
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset the input value
    }
  };


  // --- Handle Removing a File from the List ---
  // Called when the user clicks the remove button next to a file.
  const removeFile = (id) => {
    console.log(`Removing file with id: ${id}`);
    // Filter out the file with the matching ID from the state array.
    setFilesToUpload(prevFiles => prevFiles.filter(item => item.id !== id));

    // If the file was currently being uploaded, attempt to abort the associated XHR request.
     if (activeUploadsRef.current[id]) {
         console.log(`Aborting active upload for file id: ${id}`);
         activeUploadsRef.current[id].abort(); // Abort the XMLHttpRequest
         delete activeUploadsRef.current[id]; // Remove the reference from our active uploads ref
     }
  };


  // --- Helper Function to Format File Size ---
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; // Use 1024 for Kibibytes, Mebibytes etc.
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // Units
    // Calculate the index for the correct unit
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // Format the size to two decimal places and append the unit
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fileUploadProgress = useRef({});
  
   // --- Helper Function to Update Overall Progress ---
   // Called from individual file progress handlers to calculate and update the overall progress.
   const updateOverallProgress = (fileId, loaded, total) => {
	fileUploadProgress.current[fileId] = { loaded, total }; // Store progress for this file

	const allFilesProgress = Object.values(fileUploadProgress.current);

	// Sum loaded and total bytes across ALL files currently being tracked
	const totalLoaded = allFilesProgress.reduce((sum, { loaded }) => sum + loaded, 0);
	const totalTotal = allFilesProgress.reduce((sum, { total }) => sum + total, 0);

	const overallPercent = totalTotal === 0 ? 0 : Math.round((totalLoaded / totalTotal) * 100);

	setOverallProgress(overallPercent); // Update the overall progress state

	 // Also update the individual file's state with its percentage progress if needed for list display
	 setFilesToUpload(prevFiles => {
		  return prevFiles.map(item =>
			   item.id === fileId ? { ...item, progress: Math.round((loaded / total) * 100) } : item
		  );
	 });
};
   


  // --- Handle Upload Button Click ---
  // Initiates the upload process for all files in the 'pending' or 'failed' status.
  const handleUpload = async () => {
    // Filter for files that are pending or failed from the current state
    const filesToProcess = filesToUpload.filter(f => f.status === 'pending' || f.status === 'failed');
    if (filesToProcess.length === 0) {
        console.log("No pending/failed files to upload.");
        return; // Do nothing if no files need processing
    }

    console.log(`Starting upload process for ${filesToProcess.length} file(s)...`);
    setUploading(true);       // Set the overall uploading state to true
    setUploadFinished(false); // Reset the finished state
    setOverallProgress(0);    // Reset the overall progress display
    fileUploadProgress.current = {}; // Reset the progress tracking ref

    activeUploadsRef.current = {}; // Clear the reference to active XHRs (abort functions)

    let uploadsFinishedCount = 0; // Counter for uploads that have finished (complete, failed, or aborted)
    const totalFilesCount = filesToProcess.length; // Total number of files in this batch

    // Use Promise.all to initiate uploads concurrently
    // We'll map each file item to a promise returned by a wrapper function
    const uploadPromises = filesToProcess.map(fileItem => {

        // Return a promise that wraps the uploadFile utility call
        return new Promise((resolve) => { // Resolve when the file's process is done (success/fail/abort)
            console.log(`Initiating upload for file: ${fileItem.file.name} (ID: ${fileItem.id})`);

            // Call the uploadFile utility for this item
            const abortController = uploadFile(
                fileItem.file, // The File object
                currentPath, // The target directory
                // onProgress callback
                (percentComplete) => {
                    // This callback receives percentage from utility
                    // updateOverallProgress expects loaded/total bytes.
                    // If utility provides bytes, use them. Otherwise, estimate or adjust utility.
                    // Assuming utility provides percentage for now:
                    // We need loaded/total bytes from the XHR progress event, which the utility has.
                    // Modify the utility to pass loaded/total or recalculate here if possible.
                    // Let's update updateOverallProgress to take percentage and calculate overall average %.
                    // Reverting updateOverallProgress to average percentage for simplicity.
                    // Re-defining updateOverallProgress here or above to accept fileId and percentage.
                    setFilesToUpload(prevFiles => {
                        const updatedFiles = prevFiles.map(item =>
                             item.id === fileItem.id ? { ...item, progress: percentComplete, status: percentComplete === 100 ? 'uploading' : 'uploading' } : item // Status stays 'uploading' until onload/onerror
                        );
                        // Calculate overall average percentage
                        const totalProgressSum = updatedFiles.reduce((sum, item) => sum + item.progress, 0);
                        const overallPercent = Math.round(totalProgressSum / totalFilesCount); // Divide by totalFilesCount for average
                        setOverallProgress(overallPercent);
                        return updatedFiles;
                    });
                },
                // onComplete callback (when Flask API returns 2xx)
                (response) => {
                    console.log(`Upload success callback for file: ${fileItem.file.name}`, response);
                    // Update the status of this specific file item to 'complete'
                    setFilesToUpload(prevFiles => prevFiles.map(f => f.id === fileItem.id ? { ...f, status: 'complete', progress: 100, error: null } : f));
                     uploadsFinishedCount++; // Increment finished counter

                     // Resolve the promise for this file
                     resolve({ id: fileItem.id, status: 'complete' });

                     // Check if all files are finished
                     if (uploadsFinishedCount === totalFilesCount) {
                         console.log("All uploads in the batch finished.");
                         setUploading(false); // Overall uploading is done
                         setUploadFinished(true); // Set finished state
                         // onUploadComplete() is typically called on "Done" button click now.
                     }
                },
                // onError callback (network error, HTTP error, abort, parse error)
                (errorMessage) => {
                    console.error(`Upload error callback for file: ${fileItem.file.name}:`, errorMessage);
                    // Update the status of this specific file item to 'failed'
                    setFilesToUpload(prevFiles => prevFiles.map(f => f.id === fileItem.id ? { ...f, status: 'failed', progress: 0, error: errorMessage } : f));
                    uploadsFinishedCount++; // Increment finished counter

                    // Resolve the promise for this file (even if failed)
                    resolve({ id: fileItem.id, status: 'failed' });

                    // Check if all files are finished
                     if (uploadsFinishedCount === totalFilesCount) {
                         console.log("All uploads in the batch finished (with errors).");
                         setUploading(false);
                         setUploadFinished(true);
                     }
                }
            ); // End uploadFile call

            // Store the abort function returned by uploadFile
            activeUploadsRef.current[fileItem.id] = abortController;
        }); // End Promise wrapper
    }); // End map
  }; // End of handleUpload function

  // --- Drag and drop handlers ---
  // Prevent default browser behavior when files are dragged over the component.
  const handleDragOver = (e) => {
    e.preventDefault(); // Prevent default handling of the drag event
    e.stopPropagation(); // Stop event propagation
    // Optional: Add visual feedback (e.g., highlight the drag zone)
    // e.currentTarget.classList.add('border-primary-500', 'bg-blue-50');
  };

  // Handle the drop event when files are dropped onto the component.
  const handleDrop = (e) => {
    e.preventDefault(); // Prevent default handling of the drop event (like opening files)
    e.stopPropagation(); // Stop event propagation

    // Optional: Remove visual feedback added on drag over
    // e.currentTarget.classList.remove('border-primary-500', 'bg-blue-50');

    // Check if dataTransfer contains files and if there are any files dropped.
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files); // Get the array of dropped File objects.

      // Map dropped files into our internal state structure with 'pending' status.
      const newFiles = droppedFiles.map((file, index) => ({
        file: file,
        // Create unique IDs for dropped files.
        id: `file-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`,
        status: 'pending',
        progress: 0,
        error: null
      }));

      // Add the new files to the existing list of files to upload.
      setFilesToUpload(prevFiles => [...prevFiles, ...newFiles]);

      // No need to clear input value for drop.
    }
  };
  // --- End Drag and drop handlers ---


  // --- Calculate summary counts ---
  const successfulUploads = filesToUpload.filter(f => f.status === 'complete').length;
  const failedUploads = filesToUpload.filter(f => f.status === 'failed').length;
  const pendingCount = filesToUpload.filter(f => f.status === 'pending').length; // Count pending files


  // --- Render Method ---
  // Render the modal structure and its content based on component state.
  return (
    // --- Modal Backdrop ---
    // Fixed position div covering the screen with a semi-transparent background.
    // Handles centering the modal content.
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* --- Modal Content Container --- */}
      {/* White/dark background, rounded corners, shadow. Max width and full width on small screens. */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
        {/* --- Modal Header --- */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Upload Files</h3>
          {/* Close button - conditionally enabled/disabled */}
          {!uploading || uploadFinished ? ( // Enable if not uploading OR finished
               <button
                 onClick={onClose}
                 className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                 aria-label="Close upload dialog"
                 type="button" // Explicitly a button
               >
                 <XMarkIcon className="h-5 w-5" />
               </button>
          ) : ( // Disable if uploading and not yet finished
               <button
                // Optional: Ask for confirmation before cancelling and closing
                onClick={() => {
                     if (confirm('Uploads are in progress. Are you sure you want to cancel and close?')) {
                        // Abort all active uploads before closing the modal.
                         Object.values(activeUploadsRef.current).forEach(xhr => xhr.abort());
                         onClose(); // Call the onClose prop to close the modal.
                     }
                }}
                 className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  aria-label="Cancel uploads and close dialog"
                  type="button" // Explicitly a button
               >
                 <XMarkIcon className="h-5 w-5" />
               </button>
          )}
        </div>

        {/* --- Modal Body --- */}
        <div className="px-6 py-4">
          {/* Drag and drop area or status message if uploading/finished */}
          {/* Show drag/drop area ONLY if no uploads are currently running or finished */}
          {!uploading && !uploadFinished ? (
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center transition-colors"
              onDragOver={handleDragOver} // <-- Attach onDragOver handler
              onDrop={handleDrop}       // <-- Attach onDrop handler
              // Optional: Add onDragLeave if you added styling onDragOver
              // onDragLeave={handleDragLeave} // Implement handleDragLeave to remove styling
            >
              <ArrowUpTrayIcon className="h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Drag and drop files here, or
              </p>
              {/* Hidden file input - triggered by the "Browse Files" button */}
              <input
                type="file"
                multiple // Allows selecting multiple files
                className="hidden" // Hide the native input
                onChange={handleFileSelect} // Handle file selection
                ref={fileInputRef} // Attach the ref
                 disabled={uploading} // Disable input while uploading
              />
              {/* "Browse Files" button */}
              <button
                type="button" // Explicitly a button
                onClick={() => fileInputRef.current?.click()} // Trigger click on hidden input using ref
                className="mt-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={uploading} // Disable button while uploading
              >
                Browse Files
              </button>
              {/* Display count of selected files */}
              {filesToUpload.length > 0 && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{filesToUpload.length} file(s) selected</p>}
            </div>
          ) : (
             // Show a placeholder or message if not pending/failed state (i.e., uploading or finished)
             // Render a non-interactive area to maintain layout space
              <div className="border-2 border-dashed border-transparent rounded-lg p-6 flex flex-col items-center justify-center">
                 {/* Optional message */}
                 <p className="text-sm text-gray-500 dark:text-gray-400">
                   {uploading ? 'Uploads are in progress.' : 'Upload summary below.'}
                 </p>
                 {/* Optional spinner if the overall progress bar isn't enough */}
              </div>
          )}


          {/* Overall progress bar and/or Summary text */}
          {/* This section is shown when uploading or finished */}
          {(uploading || uploadFinished) && (
            <div className="mt-4">
              {/* Overall progress bar - show ONLY while uploading */}
              {uploading && (
                <div className="mb-4"> {/* Add margin-bottom if progress bar is above summary */}
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{overallProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

               {/* Upload Summary text - show ONLY when finished */}
               {uploadFinished && (
                   <div className="mt-4 text-center">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Upload Complete!</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {successfulUploads} successful, {failedUploads} failed.
                        </p>
                   </div>
               )}
            </div>
          )}


          {/* File list - shown if there are files selected/being processed */}
          {filesToUpload.length > 0 && (
            <div className="mt-4">
              {/* Heading for the file list/summary */}
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                 {/* Heading text changes based on status */}
                 {uploading ? 'Uploading Files' : uploadFinished ? 'Upload Summary' : 'Selected Files'}
              </h4>
              {/* Container for the list items - includes scroll if needed */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                {/* Map over the filesToUpload state array to render each file item */}
                {filesToUpload.map((item) => (
                  <div
                    key={item.id} // Use the unique item ID as the key
                    // Styling based on the file's upload status
                    className={`flex items-center justify-between p-3 rounded-lg ${
                        item.status === 'complete' ? 'bg-green-50 dark:bg-green-900/20' :
                        item.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' :
                        'bg-gray-50 dark:bg-gray-700/50' // Default background for pending/uploading
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {/* File icon */}
                      <DocumentIcon className="h-8 w-8 text-gray-400" />
                      {/* File name and size */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.file.name} {/* Display file name */}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(item.file.size)} {/* Display formatted file size */}
                        </p>
                      </div>
                    </div>

                    {/* Upload status/progress/action area */}
                    <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                      {/* Show remove button only if file is pending and uploads haven't started */}
                      {item.status === 'pending' && !uploading && (
                         <button
                           onClick={() => removeFile(item.id)} // Call remove function with item ID
                           className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                           aria-label={`Remove ${item.file.name}`}
                           type="button" // Explicitly a button
                         >
                           <TrashIcon className="h-5 w-5" /> {/* Trash icon */}
                         </button>
                      )}
                       {/* Show progress percentage only while file is uploading */}
                       {item.status === 'uploading' && (
                           <div className="w-10 text-xs text-gray-500 dark:text-gray-400 text-right">
                             {item.progress}% {/* Display progress % */}
                           </div>
                       )}
                      {/* Show complete icon only when file is complete */}
                      {item.status === 'complete' && (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" aria-label="Upload successful"/>
                      )}
                      {/* Show failed icon and optional retry button only when file has failed */}
                      {item.status === 'failed' && (
                         <> {/* Use Fragment to group icon and potential button */}
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-label={`Upload failed: ${item.error}`} /> {/* Failed icon */}
                            {/* Optional retry button (implementation needed for retry logic) */}
                             {/* {!uploading && (
                                  <button onClick={() => handleRetryUpload(item.id)} className="text-blue-500 hover:underline text-xs" type="button">Retry</button>
                             )} */}
                         </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Error messages summary - shown if there are failed uploads */}
              {failedUploads > 0 && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-400">Upload Errors ({failedUploads})</h4>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    {/* Map over failed files to display their errors */}
                    {filesToUpload.filter(f => f.status === 'failed').map((item) => (
                      <li key={item.id} className="text-sm text-red-700 dark:text-red-400">
                        <strong>{item.file.name}:</strong> {item.error} {/* Display filename and error message */}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- Modal Footer --- */}
        {/* Contains action buttons (Cancel, Upload, Done) */}
        {/* Show Done button if upload is finished, otherwise show Cancel/Upload */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          {uploadFinished ? ( // Show 'Done' button if finished
               <button
                 type="button"
                 onClick={() => {
                    onClose(); // Call the onClose prop to close the modal
                    onUploadComplete(); // Call the onUploadComplete prop to notify parent (e.g., refresh list)
                 }}
                 className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
               >
                 Done
               </button>
          ) : ( // Show 'Cancel' and 'Upload' buttons if not finished
               <> {/* Use Fragment for multiple buttons */}
                   {/* Cancel button - disabled while uploading */}
                   <button
                     type="button"
                     onClick={onClose} // Call the onClose prop
                     disabled={uploading} // Disable if the upload process is running
                     className={`mr-3 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                       uploading ? 'opacity-50 cursor-not-allowed' : '' // Apply disabled styles
                     }`}
                   >
                     Cancel
                   </button>
                   {/* Upload Files button - disabled if no files selected, or if already uploading */}
                   <button
                     type="button"
                     onClick={handleUpload} // Call the handleUpload function
                     // Disable if:
                     // 1. No files are in the list.
                     // 2. The overall upload process is running.
                     // 3. Any specific file is currently in the 'uploading' status.
                     disabled={filesToUpload.length === 0 || uploading || filesToUpload.some(f => f.status === 'uploading')}
                     className={`px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                       (filesToUpload.length === 0 || uploading || filesToUpload.some(f => f.status === 'uploading')) ? 'opacity-50 cursor-not-allowed' : '' // Apply disabled styles
                     }`}
                   >
                     {/* Button text changes based on status */}
                     {uploading ? 'Uploading...' : 'Upload Files'}
                   </button>
               </>
           )}
        </div>
      </div>
    </div>
  );
}