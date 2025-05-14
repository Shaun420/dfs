// src/components/BreadcrumbNav.jsx
import React from 'react';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

export default function BreadcrumbNav({ path, onNavigate, className = '' }) {
  // Parse the path into segments
  const segments = path.split('/').filter(segment => segment !== '');
  
  // Build the breadcrumb items with cumulative paths
  const breadcrumbs = segments.map((segment, index) => {
    const cumulativePath = '/' + segments.slice(0, index + 1).join('/') + '/';
    return {
      name: segment,
      path: cumulativePath
    };
  });
  
  return (
    <nav className={`flex items-center text-sm font-medium ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1 md:space-x-2 flex-wrap">
        {/* Home link */}
        <li>
          <div className="flex items-center">
            <button 
              onClick={() => onNavigate('/')}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center"
              aria-label="Home"
            >
              <HomeIcon className="flex-shrink-0 h-4 w-4" />
            </button>
          </div>
        </li>
        
        {/* Path segments */}
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={index}>
            <div className="flex items-center">
              <ChevronRightIcon className="flex-shrink-0 h-4 w-4 text-gray-400" aria-hidden="true" />
              <button
                onClick={() => onNavigate(breadcrumb.path)}
                className="ml-1 md:ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 truncate max-w-[100px] sm:max-w-none"
              >
                {breadcrumb.name}
              </button>
            </div>
          </li>
        ))}
        
        {/* If we're at root and there are no segments, show "Root" */}
        {segments.length === 0 && (
          <li>
            <div className="flex items-center">
              <ChevronRightIcon className="flex-shrink-0 h-4 w-4 text-gray-400" aria-hidden="true" />
              <span className="ml-1 md:ml-2 text-gray-500 dark:text-gray-400">Root</span>
            </div>
          </li>
        )}
      </ol>
    </nav>
  );
}