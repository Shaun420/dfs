// src/components/FileItem.jsx
import React from 'react';
import { 
  DocumentIcon, 
  PhotoIcon, 
  FilmIcon, 
  MusicalNoteIcon, 
  CodeBracketIcon, 
  FolderIcon, 
  ArrowDownTrayIcon, 
  PencilIcon, 
  TrashIcon, 
  EllipsisHorizontalIcon 
} from '@heroicons/react/24/outline';
import { Menu, MenuItems, Transition } from '@headlessui/react';
import { formatDistanceToNow } from 'date-fns';

export default function FileItem({ item, onNavigate, onDownload, onRename, onDelete }) {
  // Determine file type and icon
  const getFileIcon = () => {
    if (item.type === 'directory') {
      return <FolderIcon className="h-6 w-6 text-yellow-500" />;
    }
    
    const extension = item.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
        return <PhotoIcon className="h-6 w-6 text-blue-500" />;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'webm':
        return <FilmIcon className="h-6 w-6 text-purple-500" />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <MusicalNoteIcon className="h-6 w-6 text-pink-500" />;
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'html':
      case 'css':
      case 'py':
      case 'java':
      case 'c':
      case 'cpp':
        return <CodeBracketIcon className="h-6 w-6 text-green-500" />;
      default:
        return <DocumentIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown date';
    }
  };

  // Handle click based on item type
  const handleItemClick = () => {
    if (item.type === 'directory') {
      onNavigate(item.path);
    } else {
      onDownload(item);
    }
  };

  return (
    <div className="group relative flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
      {/* File icon */}
      <div className="flex-shrink-0 mr-3">
        {getFileIcon()}
      </div>
      
      {/* File info */}
      <div className="flex-1 min-w-0" onClick={handleItemClick}>
        <div className="flex items-center">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400">
            {item.name}
          </h3>
          {item.isShared && (
            <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Shared
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
          {item.type !== 'directory' && (
            <span className="mr-3">{formatFileSize(item.size || 0)}</span>
          )}
          <span>{formatDate(item.modified || new Date())}</span>
        </div>
      </div>
      
      {/* Actions menu */}
      <div className="flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none">
            <EllipsisHorizontalIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </Menu.Button>
          <Transition
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <MenuItems className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1">
                {item.type !== 'directory' && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => onDownload(item)}
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-700' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <ArrowDownTrayIcon className="mr-3 h-5 w-5" />
                        Download
                      </button>
                    )}
                  </Menu.Item>
                )}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => onRename(item)}
                      className={`${
                        active ? 'bg-gray-100 dark:bg-gray-700' : ''
                      } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                    >
                      <PencilIcon className="mr-3 h-5 w-5" />
                      Rename
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => onDelete(item)}
                      className={`${
                        active ? 'bg-gray-100 dark:bg-gray-700' : ''
                      } flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400`}
                    >
                      <TrashIcon className="mr-3 h-5 w-5" />
                      Delete
                    </button>
                  )}
                </Menu.Item>
              </div>
            </MenuItems>
          </Transition>
        </Menu>
      </div>
    </div>
  );
}