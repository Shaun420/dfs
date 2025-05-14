// src/components/Header.jsx
// This component displays application header, search, notifications, and user status (login/logout/profile)
// It consumes authentication state from the Nanostores authStore.

import React, { useState, useEffect, useRef } from 'react';
import {
  UserIcon,
  BellIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

// Import Nanostores hook and the auth store
import { useStore } from '@nanostores/react'; // <-- Import useStore
import { authStore, checkAuthStatus } from '../stores/auth'; // <-- Import the authStore and checkAuthStatus

// Import DarkModeToggle component (assuming it's rendered directly within Header)
import DarkModeToggle from './DarkModeToggle.jsx';

export default function Header() {
  // --- Consume authentication status from the Nanostore ---
  // useStore hook subscribes the component to the store and gets its current value.
  const { user, isAuthenticated, loading } = useStore(authStore); // <-- Use useStore

  // No need for the 'if (!context)' check anymore, useStore doesn't return null/undefined in this way.

  // --- Local component state ---
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // --- Refs for click outside logic ---
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);


  // --- useEffect Hook for click outside listeners --- (Remains the same)
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  // --- useEffect Hook for fetching notifications ---
  // This effect runs whenever isAuthenticated changes (tracked by useStore causing re-render).
  useEffect(() => {
       if (isAuthenticated) {
           console.log("User authenticated, fetching notifications...");
           fetchNotifications();
       } else {
           setNotifications([]); // Clear notifications if user logs out or is not authenticated
           console.log("User not authenticated, clearing notifications.");
       }
       // Effect depends on isAuthenticated from the store value.
  }, [isAuthenticated]); // <-- Dependency array: Rerun when isAuthenticated changes


  // --- Function to fetch notifications --- (Remains the same mock)
  const fetchNotifications = () => {
    console.log("Fetching notifications (mock)...");
    setNotifications([
      { id: 1, message: "Node 2 is offline", time: "5 min ago", read: false },
      { id: 2, message: "File upload completed", time: "1 hour ago", read: false },
      { id: 3, message: "System update available", time: "Yesterday", read: true }
    ]);
  };

  // --- Handle Login Button Click --- (Remains the same)
  const handleLogin = () => {
    console.log("Login button clicked. Redirecting to /login.");
    window.location.href = '/login'; // Redirect to your Astro login page route
  };

  // --- Handle Logout Button Click ---
  // Calls backend logout API, then triggers a refresh of the auth status using the store function.
  const handleLogout = async () => {
    console.log("Logout button clicked.");
    try {
      const response = await fetch('/logout', { credentials: 'include' });
       if (!response.ok) {
          console.error('Logout failed on backend:', response.status, await response.text().catch(() => ''));
          alert('Logout failed on backend.');
       } else {
          console.log("Backend logout successful.");
       }

      // Trigger a refresh of the authentication status using the imported store function.
      // This re-runs the fetch('/test') and updates the authStore.
      await checkAuthStatus(); // <-- Use the imported function

      setIsDropdownOpen(false); // Close the user dropdown menu

      // Redirect the browser to a public page after logout completes and status is refreshed.
       window.location.href = '/'; // <-- CONFIGURE THIS REDIRECT URL after logout

    } catch (error) {
      console.error('Error during logout API call:', error);
       alert('An error occurred during logout: ' + error.message);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;


  // --- Main Render Logic ---
  // Show loading state from the store while initial auth check is in progress.
  // Use the 'loading' property from the store state obtained via useStore.
  if (loading) {
       console.log("Header loading state from store is true. Rendering loading header.");
       return (
            <header className="bg-white dark:bg-gray-800 shadow-sm z-10 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
                 {/* Left side: Placeholder or disabled search */}
                 <div className="flex-1 flex items-center max-w-lg">
                     <div className="w-full">
                         <div className="relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                               <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                             </div>
                             {/* Disable search input while loading */}
                             <input
                               type="text"
                               className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                               placeholder="Search files..."
                               disabled
                             />
                         </div>
                     </div>
                 </div>
                 {/* Right side: Loading indicator */}
                 <div className="flex items-center space-x-4">
                      {/* Render DarkModeToggle even when initial auth check is pending */}
                      <DarkModeToggle /> {/* No client:load needed here */}
                      {/* Loading spinner or text indicating auth check */}
                       <div className="flex items-center text-gray-500 dark:text-gray-400">
                           <span className="mr-2">Loading user...</span>
                           <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 dark:border-primary-400"></div>
                       </div>
                  </div>
          </header>
       ); // Return the loading state header JSX
  }

  // Render the full header once loading is false.
  console.log("Header loading state from store is false. Rendering full header.");
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side: Search Input (enabled when loading is false) */}
          <div className="flex-1 flex items-center max-w-lg">
            <div className="w-full">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                  placeholder="Search files..."
                  // Input is enabled by default when loading is false
                />
              </div>
            </div>
          </div>

          {/* Right side: User menu and actions */}
          <div className="flex items-center space-x-4">

            {/* Dark Mode Toggle component */}
            <DarkModeToggle /> {/* Render the toggle component */}


            {/* Notifications Icon and Dropdown */}
            {/* Only show notifications if the user is authenticated */}
            {isAuthenticated && (
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                  aria-label="View notifications"
                >
                  <BellIcon className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 block h-4 w-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h3>
                    </div>
                    {notifications.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto">
                        {notifications.map(notification => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                          >
                            <p className="text-sm text-gray-800 dark:text-gray-200">{notification.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notification.time}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
						<div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        No new notifications
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600">
                      <a href="#" className="block px-4 py-2 text-xs text-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300">
                        Mark all as read
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User menu or Login button - conditional based on isAuthenticated */}
            {isAuthenticated ? (
              // User is logged in - show the user menu dropdown
              <div className="ml-3 relative" ref={dropdownRef}>
                <div>
                  <button
                    type="button"
                    className="flex items-center max-w-xs rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    id="user-menu-button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    aria-expanded={isDropdownOpen}
                    aria-haspopup="true"
                  >
                    <span className="sr-only">Open user menu</span>
                    <UserCircleIcon className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {isDropdownOpen && (
                  <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                  >
                    <div className="border-b border-gray-200 dark:border-gray-600 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user}</p>
                    </div>
                    <a href="/profile" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600" role="menuitem">
                      Your Profile
                    </a>
                    <a href="/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600" role="menuitem">
                      Settings
                    </a>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                      role="menuitem"
                      type="button"
                    >
                      <div className="flex items-center">
                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                        Sign out
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // User is NOT logged in - show the Login button
              <button
                onClick={handleLogin}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                type="button"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}