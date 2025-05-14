// src/components/AppRoot.jsx
import React from 'react'; // Still need React import

// No need to import AuthProvider here anymore.
// Sidebar and Header components are still imported and rendered here.
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';

// Import the component that triggers the initial auth check
import AuthInitializer from './AuthInitializer.jsx';

// This component accepts 'children' which will be the page content from the slot
export default function AppRoot({ children }) {
  console.log("AppRoot Render (Client-Side)"); // Log to confirm client execution

  return (
	<>
		<AuthInitializer />

      <div className="flex h-screen"> {/* Use className in React */}
        {/* Sidebar component */}
        {/* No client: directive here */}
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header component */}
          {/* No client: directive here */}
          <Header>
             {/* If Header renders DarkModeToggle internally, it's implicitly here */}
          </Header>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900"> {/* Use className */}
            {/* Render the page content passed as children */}
            {children} {/* <-- Render the slot content here */}
          </main>
        </div>
      </div>
	</>
  );
}