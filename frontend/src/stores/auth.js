// src/stores/auth.js
import { map } from 'nanostores';

// Define the initial state of the auth store
const initialAuthState = {
    user: null,
    isAuthenticated: false,
    isAdmin: false, // Assume not admin initially in bypass mode too unless specified
    loading: true, // Start in loading state
};

// Create the auth store using `map`
export const authStore = map(initialAuthState);

// --- Function to fetch authentication status from the backend ---
// Modified to conditionally bypass authentication in debug/development mode.
export const checkAuthStatus = async () => {
    // Check if we are in a debug environment where auth can be bypassed.
    // import.meta.env.DEV is true in development mode (`astro dev`).
    // You could also use a custom env var like import.meta.env.PUBLIC_BYPASS_AUTH === 'true'.
    const isDebugBypassEnabled = import.meta.env.DEV;

    // Set loading state to true before any check
    authStore.setKey('loading', true);
    console.log(`Auth check initiated. Debug bypass enabled: ${isDebugBypassEnabled}`);

    if (isDebugBypassEnabled) {
        // --- DEBUG BYPASS MODE ---
        // In debug mode, bypass the actual backend API call.
        // Simulate a successful authenticated user immediately.
        // You can customize the mock user and admin status here for local testing.
        console.log("Debug bypass enabled. Simulating authenticated user.");
        authStore.set({
            user: 'debug_user@localhost', // Mock username
            isAuthenticated: true,
            isAdmin: true, // Mock admin status for testing admin features
            loading: false, // Loading is complete
        });
        // No backend fetch in this branch
        return; // Exit the function
    }

    // --- PRODUCTION / NORMAL DEVELOPMENT MODE ---
    // If not in debug bypass mode, proceed with the actual backend API call.
    try {
        console.log("Debug bypass disabled. Attempting fetch to /test.");
        // Fetch the /test endpoint. This request goes through your Astro proxy to Flask.
        const response = await fetch('/test', {
            credentials: 'include' // Essential for production to send the session cookie
        });

        if (!response.ok) {
            console.error("Auth check failed with HTTP status:", response.status);
            // If 401, assume not authenticated. For other errors, log and assume not auth.
             authStore.set({ user: null, isAuthenticated: false, isAdmin: false, loading: false });
             console.log("Auth check failed via /test fetch. Store state set to unauthenticated.");
        } else {
            const data = await response.json();
            console.log("Auth check fetch response OK. Data:", data);

            if (data.success && data.user) {
                // User is authenticated via backend check
                const isAdminUser = data.message === "Admin access"; // Derive isAdmin from backend message
                authStore.set({
                    user: data.user,
                    isAuthenticated: true,
                    isAdmin: isAdminUser,
                    loading: false,
                });
                console.log(`User authenticated via /test: ${data.user}, Is Admin: ${isAdminUser}. Store state updated.`);
            } else {
                // Not authenticated via backend check
                authStore.set({ user: null, isAuthenticated: false, isAdmin: false, loading: false });
                console.log("User is not authenticated via /test fetch response. Store state set to unauthenticated.");
            }
        }
    } catch (error) {
        console.error('Error during actual auth check fetch:', error);
        // Handle network errors etc. Assume not authenticated if check fails.
        authStore.set({ user: null, isAuthenticated: false, isAdmin: false, loading: false });
        console.log("Auth check fetch failed (network/other error). Store state set to unauthenticated.");
    }
    // Loading state is set to false in all relevant branches (debug bypass or fetch completion/error).
};
