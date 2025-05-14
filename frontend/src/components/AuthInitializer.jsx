// src/components/AuthInitializer.jsx
// A small component whose only job is to trigger the initial auth check
// using a useEffect hook when it mounts client-side.

import React, { useEffect } from 'react'; // Need React and useEffect

// Import the checkAuthStatus function from the store file
import { checkAuthStatus } from '../stores/auth'; // <-- Import the function

export default function AuthInitializer() {
  // Use useEffect to trigger checkAuthStatus once when the component mounts client-side.
  useEffect(() => {
    console.log("AuthInitializer component mounted. Triggering checkAuthStatus.");
    checkAuthStatus(); // Call the function to start the auth check

    // No cleanup needed as this is a one-time action on mount.
  }, []); // Empty dependency array ensures this runs only once after mount.

  // This component doesn't need to render anything visible.
  // Its purpose is purely for its side effect (the useEffect).
  return null; // Render nothing visible
}