// src/components/GoogleLoginButton.jsx
// This component initiates the Google login process by fetching the authorization URL
// from the backend and opening it in a popup window. It then polls the backend
// to detect successful login and redirects the main window.

import React, { useState, useEffect, useRef } from 'react';

// Define the base URL of your backend API Gateway.
// This is the URL the fetch request will be sent to.
// This URL should be configured in your Astro proxy to forward requests starting with /google.

let BACKEND_BASE_URL = "https://server.shaun420.eu.org";
if (import.meta.env.DEV) {
	BACKEND_BASE_URL = "https://localhost";
}

// Interval time for polling the backend status (in milliseconds)
const POLL_INTERVAL = 3000; // Check login status every 3 seconds (adjust as needed)

// Define expected response shapes from backend for type safety (Optional, but good practice)
// interface BackendAuthUrlResponse {
//   success: boolean;
//   status: "auth_url_provided";
//   auth_url: string;
//   message?: string;
// }
// interface BackendAuthenticatedResponse {
//   success: boolean;
//   status: "authenticated";
//   user: string; // Or the user ID structure from your backend
//   message?: string;
// }
// interface BackendErrorResponse {
//   success: boolean;
//   status: "error";
//   message: string;
// }
// type BackendLoginResponse = BackendAuthUrlResponse | BackendAuthenticatedResponse | BackendErrorResponse;
// interface TestResponse {
//   success: boolean;
//   user?: string;
//   message?: string;
//   // Add other properties from your /test endpoint response
// }


export default function GoogleLoginButton() {
  // --- State variables ---
  // isLoading: True while the initial fetch or polling is active.
  const [isLoading, setIsLoading] = useState(false);
  // error: Stores any error messages to display.
  const [error, setError] = useState(null);
  // authWindow: Holds the reference to the opened popup window. Null if closed or not opened.
  const [authWindow, setAuthWindow] = useState(null);

  // --- Refs for managing intervals ---
  // useRef is used because interval IDs need to persist across renders,
  // and their values are accessed/modified within effects and handlers.
  const pollingTimerRef = useRef(null);   // Stores the ID returned by setInterval for polling.
  const closureCheckTimerRef = useRef(null); // Stores the ID returned by setInterval for checking window closure.


  // --- Helper Function: Stop Polling Intervals ---
  // Clears both interval timers. Called when login is confirmed, window closes, or component unmounts.
   const stopPolling = () => {
       if (pollingTimerRef.current) {
           clearInterval(pollingTimerRef.current);
           pollingTimerRef.current = null;
           console.log("Polling interval cleared.");
       }
        if (closureCheckTimerRef.current) {
            clearInterval(closureCheckTimerRef.current);
            closureCheckTimerRef.current = null;
             console.log("Window closure check interval cleared.");
        }
   };


  // --- Helper Function: Check Login Status and Redirect ---
  // Fetches the backend's /test endpoint to see if the user is logged in.
  // If logged in, it redirects the main window to the file browser page.
   const checkLoginStatusAndRedirect = async () => {
       try {
           // Make a fetch request to the /test endpoint.
           // This endpoint should return user login status based on the session cookie.
           // It goes through your Astro proxy to reach your Flask backend.
           const response = await fetch(`${BACKEND_BASE_URL}/test`, {
               credentials: 'include' // Essential to include the Flask session cookie set by the callback endpoint.
           });

           // Handle potential HTTP errors from the /test endpoint itself.
           if (!response.ok) {
               console.error("Error fetching /test status:", response.status, await response.text().catch(() => ''));
               // Decide how to handle non-OK responses from /test (e.g., treat 401 as not logged in).
               // For now, assume any non-OK means not logged in or an error checking status.
               return false; // Indicate status not confirmed / failed check
           }

           // Parse the JSON response from the /test endpoint.
           const data = await response.json(); // as TestResponse; // Use assertion if TypeScript

           // Check if the backend indicates the user is successfully logged in.
           if (data.success && data.user) {
               console.log(`Login confirmed for user: ${data.user} via /test.`);
               // User is logged in! Stop all polling and redirect the main window.
               stopPolling(); // Stops the interval timers
               // Close the auth window if it's still open.
               if (authWindow && !authWindow.closed) {
                   authWindow.close();
               }
               // Redirect the main window to the file browser page.
               window.location.href = '/files'; // <-- CONFIGURE THIS FINAL REDIRECT URL
               return true; // Indicate success path taken
           } else {
               // Backend /test endpoint did not indicate the user is logged in.
               console.log("Still not logged in according to /test.");
               return false; // Indicate status not confirmed yet
           }
       } catch (error) {
          // Handle errors during the fetch to /test (e.g., network issues).
          console.error("Error checking login status in main window:", error);
           // Decide how to handle persistent errors here (e.g., stop polling after X failures).
           return false; // Indicate an error occurred during the check.
       }
   };


  // --- useEffect Hook for managing the polling process ---
  // This effect runs when the component mounts or when the 'authWindow' state changes.
  useEffect(() => {
      // Logic to START polling:
      // Start polling only IF:
      // 1. An auth window reference exists ('authWindow' is not null).
      // 2. The auth window is not closed ('!authWindow.closed').
      // 3. A polling timer is not already running ('!pollingTimerRef.current').
      if (authWindow && !authWindow.closed && !pollingTimerRef.current) {
           console.log(`Auth window opened. Starting polling every ${POLL_INTERVAL}ms for login status...`);

           // Start the main polling interval. This timer repeatedly calls checkLoginStatusAndRedirect.
           // We store the returned interval ID in pollingTimerRef.current.
           pollingTimerRef.current = setInterval(async () => {
               // Call the function to check status. It handles stopping the interval and redirecting on success.
                await checkLoginStatusAndRedirect();
           }, POLL_INTERVAL);

           // Start a separate interval to specifically check if the popup window has been closed by the user.
           // This is a fallback to stop polling if the user closes the window manually, in case the callback process doesn't signal completion.
            closureCheckTimerRef.current = setInterval(() => {
                if (authWindow.closed) {
                     console.log('Auth window detected closed by user.');
                     // Stop all polling and update state when the window is detected as closed.
                     stopPolling(); // Clears both intervals
                     setIsLoading(false); // Stop the loading indicator in the button
                     setAuthWindow(null); // Clear the window reference state
                     // No error is set here, as the user initiated the closure.
                }
            }, 500); // Check for window closure relatively frequently (e.g., every 500ms).

      }
      // Logic to STOP polling:
      // Stop polling IF:
      // 1. The auth window state becomes null or closed ('!authWindow || authWindow.closed').
      // 2. And a polling timer is currently running ('pollingTimerRef.current').
      // This handles cases where the 'authWindow' state is updated from elsewhere (e.g., successful login detected by polling itself calls stopPolling and sets authWindow to null).
      else if ((!authWindow || authWindow.closed) && pollingTimerRef.current) {
          console.log("Auth window state changed (closed/null). Stopping polling.");
          stopPolling(); // Stop the interval timers
          setIsLoading(false); // Ensure loading is false
          setAuthWindow(null); // Ensure window ref is null
      }

      // --- Cleanup Function for the effect ---
      // This function runs when the component unmounts OR when the dependencies ([authWindow]) change
      // and the effect is about to re-run. It's CRUCIAL for clearing interval timers to prevent memory leaks.
      return () => {
          console.log("Running useEffect cleanup.");
          stopPolling(); // Ensure intervals are cleared when the effect cleans up.
      };
  }, [authWindow]); // <-- Effect dependencies: This effect should re-run when the 'authWindow' state changes (null -> window ref, or window ref -> null).


  // --- Function triggered when the login button is clicked ---
  const handleGoogleLogin = async () => {
    // Prevent initiating the login process if:
    // 1. We are already in the process of fetching/loading (isLoading is true).
    // 2. An auth window reference exists AND it's not closed (meaning a popup is currently open).
    if (isLoading || (authWindow && !authWindow.closed)) {
         // If a window exists and is open, focus it instead of trying to open another.
         authWindow?.focus(); // Use optional chaining just in case authWindow is null briefly.
         return; // Exit the function, do not proceed with fetch/open.
    }

    setIsLoading(true); // Start loading indicator on the button.
    setError(null);     // Clear any previous error messages displayed on the button.

    try {
      // Step 1: Make a fetch request to your backend's Google login initiation endpoint.
      // This endpoint should return the Google authorization URL in a JSON response.
      const response = await fetch(`${BACKEND_BASE_URL}/google/login`, {
        method: 'GET', // Match your Flask endpoint's HTTP method (your code uses GET).
        // Include credentials (cookies) if your Flask endpoint uses sessions here (e.g., to check if already logged in or save state).
         credentials: 'include', // Recommended if Flask saves the state in the session here.
      });

      // Step 2: Check the HTTP status code of the backend response.
      // If it's not a successful status (2xx), throw an error.
      if (!response.ok) {
         // Attempt to parse error message from response body for more detail.
         const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
         throw new Error(errorData.message || `Login initiation failed: HTTP ${response.status}`);
      }

      // Step 3: Parse the JSON response body.
      const data = await response.json(); // Assuming the backend returns JSON like { success: boolean, status: string, auth_url?: string, message?: string, user?: string }

      // Step 4: Check the structure and content of the JSON response from the backend.
      // We expect either status "auth_url_provided" with auth_url, or status "authenticated".

      // Scenario A: Backend provided the auth URL (user was not logged in, flow initiated).
      if (data.success && data.status === "auth_url_provided" && data.auth_url) {
        console.log('Backend successfully provided Google auth URL:', data.auth_url);

        // Define window features (size, position, appearance) for the popup window.
        const width = 600;
        const height = 700;
        // Calculate the position to center the popup on the screen.
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        // Construct the window features string.
        const features = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes,noopener,noreferrer`; // noopener/noreferrer for security

        // **Step 5: Use window.open() to open the authorization URL in a new popup window.**
        // The first argument is the URL to open (the Google auth URL).
        // The second argument is the window name (optional, reuses window if it exists).
        // The third argument is the features string.
        const newWindow = window.open(data.auth_url, 'GoogleAuthPopup', features); // Use a name and features

        // Step 6: Check if the popup was opened successfully (not blocked by a popup blocker).
        if (newWindow) {
             console.log('Auth window opened successfully.');
             // Store the reference to the new window in component state.
             // This state change triggers the useEffect hook to start polling.
             setAuthWindow(newWindow);
             // isLoading remains true while the popup is open and we are polling.

        } else {
            // window.open returned null, which usually means a popup blocker prevented it.
            setError('Popup blocked. Please allow popups for this site.');
            setIsLoading(false); // Stop loading as the process cannot continue.
        }

      }
      // Scenario B: Backend reported user is already logged in.
      else if (data.success && data.status === "authenticated") {
        console.log('Backend reported user already logged in:', data.user);
        // User is already logged in, no need to open a popup.
        // Redirect the main window directly to the file browser page.
        setIsLoading(false); // Stop loading state.
        setError(null); // Clear any old errors.

        // Optional: Show a brief alert before redirecting for immediate feedback.
        // alert(data.message || "You are already logged in. Redirecting...");

        // Perform the client-side navigation of the main window.
        window.location.href = '/files'; // <-- CONFIGURE THIS FINAL REDIRECT URL

      }
      // Scenario C: Backend returned success: false or an unexpected status/format.
      else {
         console.error('Backend login returned unexpected data or status:', data);
         // Construct a helpful error message for the user.
         const backendErrorMessage = data.message || 'Unexpected response format.';
         setError('Login initiation failed: ' + backendErrorMessage);
         setIsLoading(false); // Stop loading.
      }

    } catch (error) {
      // Handle errors during the initial fetch call itself (e.g., network error, backend not reachable, invalid JSON response).
      console.error('Error during login initiation fetch:', error);
      // Display the error message to the user.
      setError('Failed to start Google login process: ' + error.message);
       setIsLoading(false); // Stop loading on error.
    }
    // No `finally` block is strictly needed here, as state updates (isLoading, error) are handled in the try/catch blocks,
    // or by the useEffect's polling mechanism if the popup opens successfully.
  };


  // --- Render Method ---
  return (
    <div>
      {/* The interactive login button element */}
      <button
        onClick={handleGoogleLogin} // Attach the function to the click event.
        // Button is disabled under two conditions:
        // 1. isLoading is true (we are fetching the auth URL or polling).
        // 2. An auth window exists (authWindow is not null) AND it's not closed (!authWindow.closed).
        // This prevents opening multiple windows or clicking while a flow is in progress.
        disabled={isLoading || (authWindow && !authWindow.closed)}
         // Accessibility attribute to describe the button's state.
         aria-label={isLoading ? 'Connecting to login service' : (authWindow && !authWindow.closed ? 'Login window is open' : 'Login with Google')}
         // Tailwind CSS classes for styling the button.
         className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-primary-700 dark:hover:bg-primary-600 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Button text changes based on state to provide feedback. */}
        {isLoading ? 'Connecting...' : (authWindow && !authWindow.closed ? 'Login in progress...' : 'Login with Google')}
      </button>

      {/* Display an error message if the 'error' state is set. */}
      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Optional message to the user indicating that a popup window has opened. */}
      {/* Only show this if a window is open, there's no error, and we're not in the initial 'Connecting...' state. */}
      {(authWindow && !authWindow.closed && !error && !isLoading) && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Please complete the login in the new window that opened.
              {/* Add a button to allow the user to manually close the popup window. */}
               <button
                 onClick={() => authWindow?.close()} // Use optional chaining just in case authWindow becomes null.
                 className="text-blue-500 underline ml-2"
                 type="button" // Good practice for buttons inside other elements.
                 aria-label="Close login window"
                >
                  Close Window
                </button>
          </p>
      )}
       {/* You could also add a message specifically for the initial 'Connecting...' state if desired */}
       {/* {isLoading && !error && !authWindow && (
           <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
               Starting login process...
           </p>
       )} */}

    </div>
  );
}