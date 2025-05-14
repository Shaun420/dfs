// src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import {
  HomeIcon,
  FolderIcon,
  CloudArrowUpIcon,
  ServerStackIcon,
  Cog6ToothIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

// Import Nanostores hook and the auth store
import { useStore } from '@nanostores/react';
import { authStore } from '../stores/auth';

export default function Sidebar() {
   // --- Consume authentication status from the Nanostore ---
   const { isAdmin, loading, isAuthenticated } = useStore(authStore); // Get isAuthenticated too for potential link visibility

   // System status logic remains here (local state)
   const [systemStatus, setSystemStatus] = useState({ online: true, text: 'System Online' });

   // Effect for the periodic system status check (Remains the same)
   useEffect(() => {
       async function checkSystemStatus() { /* ... */ }
       function updateSystemStatus(isOnline) { /* ... */ }
       checkSystemStatus();
       const statusInterval = setInterval(checkSystemStatus, 30000);
       return () => clearInterval(statusInterval);
   }, []);


    // --- Main Render Logic (Render the same structure always) ---
    console.log("Sidebar rendering main structure. Loading:", loading, "Authenticated:", isAuthenticated, "Admin:", isAdmin);

    return (
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-md z-20 flex flex-col h-full">
        {/* Logo and branding (remains the same) */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <CloudArrowUpIcon className="h-8 w-8 text-primary-600" />
            <span className="ml-3 text-xl font-bold text-gray-800 dark:text-white">DFS</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Distributed File System</p>
        </div>

        {/* Navigation links container - This div structure is always rendered */}
        {/* The *content* inside changes based on loading/auth state */}
        <div className="flex-grow px-3 py-4 overflow-y-auto">
          {/* Show loading spinner ONLY if auth status is still loading */}
          {loading ? (
             <div className="flex justify-center items-center h-full"> {/* Center spinner vertically in the flex-grow container */}
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400"></div>
             </div>
          ) : (
              // Once loading is FALSE, render the actual navigation list
              <ul className="space-y-1.5 font-medium">
                {/* Always visible links */}
                <li>
                  <a href="/" className="flex items-center p-2 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors">
                    <HomeIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-500" />
                    <span className="ml-3">Dashboard</span>
                  </a>
                </li>
                {/* Only show My Files if Authenticated (optional, based on app logic) */}
                {isAuthenticated && (
                 <li>
                   <a href="/files" className="flex items-center p-2 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors">
                     <FolderIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-500" />
                     <span className="ml-3">My Files</span>
                   </a>
                 </li>
                )}


                {/* Admin section (conditionally rendered based on isAdmin from store) */}
                {isAdmin && (
                  <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Admin</p>
                    <li>
                      <a href="/admin" className="flex items-center p-2 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors">
                        <ChartBarIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-500" />
                        <span className="ml-3">Statistics</span>
                      </a>
                    </li>
                    <li>
                      <a href="/admin/nodes" className="flex items-center p-2 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group transition-colors">
                        <ServerStackIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-500" />
                        <span className="ml-3">Node Status</span>
                      </a>
                    </li>
                    <li>
                      <a href="/admin/settings" className="flex items-center p-2 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600" group transition-colors>
                        <Cog6ToothIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-500" />
                        <span className="ml-3">System Settings</span>
                      </a>
                    </li>
                  </div>
                )}
              </ul>
          )}
        </div>

        {/* System status indicator (Remains the same) */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full ${systemStatus.online ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`ml-2 text-sm ${systemStatus.online ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
              {systemStatus.text}
            </span>
          </div>
        </div>
      </aside>
    );
}