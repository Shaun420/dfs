// src/components/DashboardContent.jsx
// This component displays the dashboard content that depends on user authentication status.
// It subscribes to the authStore for client-side authentication state.

import React from 'react'; // Need React import

// Import the useStore hook and the auth store
import { useStore } from '@nanostores/react'; // <-- Import useStore
import { authStore } from '../stores/auth'; // <-- Import the authStore

// Import Heroicons needed for this component
import {
  FolderIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  ShieldCheckIcon, // Keep ShieldCheckIcon if used elsewhere
  CloudArrowUpIcon,
  ServerStackIcon,
  // NEW icons for overview features:
  ArrowsPointingOutIcon, // Scalability
  CircleStackIcon, // Fault Tolerance (Layers/Replication)
  ArrowPathIcon, // High Availability (Continuous/Loop)
  CubeTransparentIcon, // Metadata Management (Abstraction/Indexing)
} from '@heroicons/react/24/outline';


// Note: This component does NOT need a client: directive on its export.
// It gets hydrated because it's rendered inside AppRoot, which has client:load.
export default function DashboardContent() {
  // --- Consume authentication status from the Nanostore ---
  // useStore hook subscribes the component to the store and gets its current value.
  // Get isAdmin as well to conditionally show the admin quick action link.
  const { user, isAuthenticated, isAdmin, loading } = useStore(authStore); // <-- Use useStore, get isAdmin

  console.log("DashboardContent rendering. Loading:", loading, "Authenticated:", isAuthenticated, "Admin:", isAdmin, "User:", user);

  // Stats (these remain static for now, but could also come from a store or API)
  const stats = {
    totalFiles: 128,
    totalStorage: '2.4 GB', // Consider making this dynamic
    nodes: 3, // Consider making this dynamic
    availability: '99.9%' // Consider making this dynamic
  };

  // --- Main Render Logic ---
  // Removed the top-level `if (loading)` block.
  // The component will now always render the main structure.
  // Loading state is handled *within* the Welcome section's heading and with a spinner.

  console.log("DashboardContent rendering main structure. Loading state from store:", loading);

  return (
    <> {/* Use a React Fragment to wrap multiple top-level elements */}

      {/* Welcome section - content changes based on loading/isAuthenticated */}
      {/* Keep this card always visible */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-8">
        <div class="px-6 py-8 sm:p-10">
          <div class="flex items-center">
            {/* Icon */}
            <CloudArrowUpIcon className="h-10 w-10 text-primary-600 dark:text-primary-500 mr-4" /> {/* Add dark mode icon color */}
            {/* Text content */}
            <div>
              {/* Heading changes based on loading/isAuthenticated */}
              {/* Show loading message OR welcome message */}
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? (
                  'Loading Authentication Status...' // Show message while loading auth
                ) : isAuthenticated ? (
                  // Use isAuthenticated and user from the store once loaded
                  `Welcome back, ${user?.split('@')[0]}!`
                ) : (
                  'Welcome to Distributed File System' // Show generic message if not authenticated
                )}
              </h1>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                A scalable and fault-tolerant storage solution for your files.
              </p>

              {/* Authentication loading spinner - show ONLY when loading is true */}
              {loading && (
                <div className="mt-4 flex items-center text-gray-500 dark:text-gray-400">
                    <span className="mr-2">Checking status...</span>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 dark:border-primary-400"></div>
                </div>
              )}

            </div>
          </div>

          {/* Show login link only if NOT authenticated (and loading is complete) */}
          {!loading && !isAuthenticated && (
            <div class="mt-6">
              <a
                href="/login"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Log in to get started
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Stats cards (these are static/not auth dependent) - Render immediately */}
      {/* Apply dark mode classes to the card containers and text */}
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
           <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
             <div class="p-5">
               <div class="flex items-center">
                 {/* Icon with color */}
                 <div class="flex-shrink-0 p-3 rounded-md bg-fuchsia-500 rounded-md p-3"> <DocumentTextIcon className="h-6 w-6 text-white" /> </div> {/* White icon is fine in both modes */}
                 <div class="ml-5 w-0 flex-1">
                   <dl>
                     {/* Text colors with dark mode */}
                     <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Total Files </dt>
                     <dd> <div class="text-lg font-medium text-gray-900 dark:text-white"> {stats.totalFiles} </div> </dd>
                   </dl>
                 </div>
               </div>
             </div>
           </div>
            <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
             <div class="p-5">
               <div class="flex items-center">
                 {/* Icon with color */}
                 <div class="flex-shrink-0 p-3 rounded-md bg-indigo-500 rounded-md p-3"> <FolderIcon className="h-6 w-6 text-white" /> </div>
                 <div class="ml-5 w-0 flex-1">
                   <dl>
                     {/* Text colors with dark mode */}
                     <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Storage Used </dt>
                     <dd> <div class="text-lg font-medium text-gray-900 dark:text-white"> {stats.totalStorage} </div> </dd>
                   </dl>
                 </div>
               </div>
             </div>
           </div>
            <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  {/* Icon with color */}
                  <div class="flex-shrink-0 p-3 rounded-md bg-green-500 rounded-md p-3"> <ServerStackIcon className="h-6 w-6 text-white" /> </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                       {/* Text colors with dark mode */}
                      <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Active Nodes </dt>
                      <dd> <div class="text-lg font-medium text-gray-900 dark:text-white"> {stats.nodes} </div> </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
             <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                   {/* Icon with color */}
                  <div class="flex-shrink-0 p-3 rounded-md bg-purple-500 rounded-md p-3"> <ShieldCheckIcon className="h-6 w-6 text-white" /> </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      {/* Text colors with dark mode */}
                      <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Availability </dt>
                      <dd> <div class="text-lg font-medium text-gray-900 dark:text-white"> {stats.availability} </div> </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
      </div>

      {/* Quick actions - Render immediately, conditionally show Admin link */}
      {/* Apply dark mode classes */}
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
        <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white"> Quick Actions </h3>
        </div>
        <div class="px-6 py-5">
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
             {/* Browse Files (always visible) */}
              <a href="/files" class="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" >
                 <FolderIcon className="h-8 w-8 text-primary-500 dark:text-primary-400 mr-4" /> {/* Dark mode icon color */}
                 <div> <h4 class="text-base font-medium text-gray-900 dark:text-white"> Browse Files </h4> <p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> View and manage your stored files </p> </div>
               </a>
              {/* Upload Files (always visible, but actions might be limited if not authenticated) */}
              <button onclick="window.location.href='/files?upload=true'" class="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" >
                 <ArrowUpTrayIcon className="h-8 w-8 text-green-500 dark:text-green-400 mr-4" /> {/* Dark mode icon color */}
                  <div> <h4 class="text-base font-medium text-gray-900 dark:text-white"> Upload Files </h4> <p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> Add new files to your storage </p> </div>
              </button>
              {/* System Status (Admin Quick Action) - Show ONLY if isAdmin */}
              {!loading && isAdmin && ( // <-- Conditionally render based on isAdmin and loading state
                <a href="/admin/nodes" class="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" >
                    <ServerStackIcon className="h-8 w-8 text-purple-500 dark:text-purple-400 mr-4" /> {/* Dark mode icon color */}
                    <div> <h4 class="text-base font-medium text-gray-900 dark:text-white"> System Status </h4> <p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> Monitor node health and performance </p> </div>
                </a>
              )}
          </div>
        </div>
      </div>

      {/* --- System overview (Enhanced) --- */}
      {/* Keep the outer card structure */}
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        {/* Card Header */}
        <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">
            System Overview
          </h3>
        </div>
        {/* Card Content Body */}
        <div class="px-6 py-5">
          {/* Optional introductory paragraph - use prose styling */}
          <div class="prose dark:prose-invert max-w-none mb-8"> {/* Apply dark mode for prose, add bottom margin */}
             <p>
               The Distributed File System (DFS) provides a scalable and fault-tolerant solution for storing and retrieving files.
               Key features include:
             </p>
             {/* Removed the original ul here */}
          </div>

          {/* --- Enhanced Feature Blocks Grid --- */}
          {/* Arrange feature blocks in a grid with gaps */}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6"> {/* Responsive 1 or 2 column grid */}

            {/* Feature 1: Scalability */}
            {/* Apply background, shadow, rounded corners, animation classes, and delay */}
            <div class="flex items-start p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm animate-fade-in-up delay-100">
              {/* Icon container - colored circle background with dark mode */}
              <div class="flex-shrink-0 p-3 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 mr-4">
                <ArrowsPointingOutIcon className="h-6 w-6" /> {/* Scalability Icon */}
              </div>
              {/* Text content with dark mode */}
              <div>
                <h4 class="text-base font-medium text-gray-900 dark:text-white">Scalability</h4>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  The system can grow as your storage needs increase by adding more nodes.
                </p>
              </div>
            </div>

            {/* Feature 2: Fault Tolerance */}
            {/* Apply dark mode, animation, and delay */}
            <div class="flex items-start p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm animate-fade-in-up delay-200">
              <div class="flex-shrink-0 p-3 rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400 mr-4">
                <CircleStackIcon className="h-6 w-6" /> {/* Fault Tolerance Icon */}
              </div>
              <div>
                <h4 class="text-base font-medium text-gray-900 dark:text-white">Fault Tolerance</h4>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Files are replicated across multiple nodes to ensure data availability even if some nodes fail.
                </p>
              </div>
            </div>

            {/* Feature 3: High Availability */}
            {/* Apply dark mode, animation, and delay */}
            <div class="flex items-start p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm animate-fade-in-up delay-300">
              <div class="flex-shrink-0 p-3 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mr-4">
                <ArrowPathIcon className="h-6 w-6" /> {/* High Availability Icon */}
              </div>
              <div>
                <h4 class="text-base font-medium text-gray-900 dark:text-white">High Availability</h4>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  The system is designed to remain operational and accessible at all times.
                </p>
              </div>
            </div>

            {/* Feature 4: Metadata Management */}
            {/* Apply dark mode, animation, and delay */}
            <div class="flex items-start p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm animate-fade-in-up delay-400">
              <div class="flex-shrink-0 p-3 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 mr-4">
                <CubeTransparentIcon className="h-6 w-6" /> {/* Metadata Management Icon */}
              </div>
              <div>
                <h4 class="text-base font-medium text-gray-900 dark:text-white">Metadata Management</h4>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Efficient tracking of file locations and attributes.
                </p>
              </div>
            </div>

          </div> {/* End Enhanced Feature Blocks Grid */}

          {/* Optional: Keep the architecture paragraph if needed */}
          {/* Apply dark mode */}
          <div class="prose dark:prose-invert max-w-none mt-8"> {/* Apply dark mode for prose, add top margin */}
             <p>
               The architecture consists of a metadata server that keeps track of file locations and data nodes that store the actual file chunks.
               This separation allows for efficient scaling and management of the system.
             </p>
          </div>

        </div> {/* End Card Content Body */}
      </div> {/* End System Overview Card */}

    </> // End Fragment
  );
}