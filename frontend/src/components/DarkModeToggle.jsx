// src/components/DarkModeToggle.jsx
import React, { useState, useEffect } from 'react';
// Assuming you have Heroicons or similar installed (npm install @heroicons/react)
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export default function DarkModeToggle() {
  // State to track the current theme ('light' or 'dark')
  // Initialize with 'light'; the useEffect will determine the actual initial theme.
  const [theme, setTheme] = useState('light');

  // --- Effect to read initial theme and set up listener ---
  useEffect(() => {
    // This effect runs once on component mount.
    // It ensures the component's internal state matches the actual theme applied by the inline script or localStorage.

    // Function to apply theme class to the html element
    // (This function is similar to the inline script's logic)
    const applyThemeClass = (mode) => {
      const htmlElement = document.documentElement; // This is the <html> tag
      if (mode === 'dark') {
        htmlElement.classList.add('dark');
      } else {
        htmlElement.classList.remove('dark'); // Ensure light mode is also applied consistently
      }
    };

    // Check localStorage first for a saved preference
    const storedTheme = localStorage.getItem('theme');

    // Determine the initial theme for the component's state and apply the class if not already set by inline script
    // Note: The inline script already handles initial class application to prevent FOUC.
    // This useEffect primarily synchronizes the React component's state with that initial state.
    if (storedTheme) {
      setTheme(storedTheme); // Set state from localStorage
      applyThemeClass(storedTheme); // Ensure class is applied (redundant if inline script worked, but safe)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // No localStorage preference, use system preference
      setTheme('dark'); // Set state to dark
       applyThemeClass('dark'); // Ensure class is applied
    } else {
       // No localStorage preference, system preference is light or unknown, default to light
       setTheme('light'); // Set state to light
       applyThemeClass('light'); // Ensure class is applied
    }


    // --- Optional: Listen for changes in system preference ---
    // This listener will update the theme *only if* the user hasn't manually
    // set a preference in localStorage yet.
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
       // Only react to system changes if there's NO theme explicitly set in localStorage
       if (!localStorage.getItem('theme')) {
          const newTheme = e.matches ? 'dark' : 'light';
          setTheme(newTheme); // Update component state
          applyThemeClass(newTheme); // Apply class immediately
       }
    };

    // Add the listener
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // --- Cleanup Listener ---
    // Remove the event listener when the component unmounts.
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []); // Empty dependency array: runs this effect only once after the initial render.


	// src/components/DarkModeToggle.jsx - toggleTheme function
	const toggleTheme = () => {
		const newTheme = theme === 'light' ? 'dark' : 'light'; // Determine the *new* theme
		setTheme(newTheme); // Update component state
		localStorage.setItem('theme', newTheme); // Save the *new* theme
	
		// Apply the *new* theme class to <html>
		const htmlElement = document.documentElement;
		if (newTheme === 'dark') {
		htmlElement.classList.add('dark'); // Add if new theme is dark
		} else {
		htmlElement.classList.remove('dark'); // <-- Crucial: REMOVE if new theme is light
		}
	};

  // --- Render the button ---
  return (
    <button
      onClick={toggleTheme} // Attach the toggle function to the button click
      className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      aria-label="Toggle Dark Mode" // Accessibility label
      type="button" // Good practice for buttons
    >
      {/* Show the appropriate icon based on the current theme state */}
      {theme === 'light' ? (
        // Show Moon icon in light mode
        <MoonIcon className="h-6 w-6" />
      ) : (
        // Show Sun icon in dark mode
        <SunIcon className="h-6 w-6" />
      )}
    </button>
  );
}