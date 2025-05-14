// src/components/NodeStatus.jsx
import React, { useState, useEffect } from 'react';
import { 
  ServerStackIcon, 
  ArrowPathIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function NodeStatus() {
  const [nodes, setNodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch node status data
  const fetchNodeStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/admin/dashboard');
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setNodes(data.node_health || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching node status:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up periodic refresh
  useEffect(() => {
    fetchNodeStatus();
    
    const intervalId = setInterval(() => {
      fetchNodeStatus();
    }, refreshInterval * 1000);
    
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Calculate node statistics
  const calculateStats = () => {
    if (!nodes || nodes.length === 0) {
      return {
        online: 0,
        warning: 0,
        offline: 0,
        total: 0,
        diskUsage: 0,
        totalStorage: 0,
        totalFiles: 0
      };
    }
    
    const stats = {
      online: 0,
      warning: 0,
      offline: 0,
      total: nodes.length,
      diskUsage: 0,
      totalStorage: 0,
      totalFiles: 0
    };
    
    nodes.forEach(node => {
      if (!node.status) {
        stats.offline++;
      } else if (node.diskUsagePercent > 90) {
        stats.warning++;
      } else {
        stats.online++;
      }
      
      stats.diskUsage += node.diskUsage || 0;
      stats.totalStorage += node.totalStorage || 0;
      stats.totalFiles += node.totalFiles || 0;
    });
    
    return stats;
  };

  const stats = calculateStats();

  // Format bytes to human-readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format time elapsed since last update
  const getTimeElapsed = () => {
    if (!lastUpdated) return 'Never';
    
    const elapsed = Math.floor((new Date() - lastUpdated) / 1000);
    
    if (elapsed < 60) {
      return `${elapsed} seconds ago`;
    } else if (elapsed < 3600) {
      return `${Math.floor(elapsed / 60)} minutes ago`;
    } else {
      return `${Math.floor(elapsed / 3600)} hours ago`;
    }
  };

  // Chart data for system overview
  const statusChartData = {
    labels: ['Online', 'Warning', 'Offline'],
    datasets: [
      {
        data: [stats.online, stats.warning, stats.offline],
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',  // green
          'rgba(234, 179, 8, 0.7)',   // yellow
          'rgba(239, 68, 68, 0.7)',   // red
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(234, 179, 8)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Chart data for storage usage
  const storageChartData = {
    labels: nodes.map(node => node.id || 'Unknown'),
    datasets: [
      {
        label: 'Storage Usage (%)',
        data: nodes.map(node => node.diskUsagePercent || 0),
        backgroundColor: nodes.map(node => 
          (node.diskUsagePercent > 90) ? 'rgba(239, 68, 68, 0.7)' :
          (node.diskUsagePercent > 70) ? 'rgba(234, 179, 8, 0.7)' :
          'rgba(34, 197, 94, 0.7)'
        ),
        borderColor: 'rgba(75, 85, 99, 0.2)',
        borderWidth: 1,
      },
    ],
  };

  // Chart data for performance over time (mock data)
  const performanceChartData = {
    labels: ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'],
    datasets: [
      {
        label: 'Response Time (ms)',
        data: [45, 52, 38, 60, 56, 45, 40],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
      },
      {
        label: 'Active Connections',
        data: [10, 15, 25, 30, 22, 18, 20],
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.5)',
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
      {/* Header with refresh controls */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Node Status</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-1" />
              Last updated: {getTimeElapsed()}
            </span>
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <label htmlFor="refresh-interval" className="text-sm text-gray-600 dark:text-gray-400 mr-2">
              Auto-refresh:
            </label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1 pl-2 pr-8 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
          <button
            onClick={fetchNodeStatus}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh now"
          >
            <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-sm font-medium border-b-2 ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`ml-8 py-3 px-4 text-sm font-medium border-b-2 ${
              activeTab === 'nodes'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Node Details
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`ml-8 py-3 px-4 text-sm font-medium border-b-2 ${
              activeTab === 'performance'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Performance
          </button>
        </nav>
      </div>
      
      {/* Content area */}
      <div className="p-6">
        {isLoading && nodes.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="mt-2 text-sm font-medium text-red-800 dark:text-red-400">{error}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Unable to fetch node status information.
            </p>
            <div className="mt-6">
              <button
                onClick={fetchNodeStatus}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-4">
                        <ServerStackIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Nodes</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-4">
                        <ServerStackIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Storage Used</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {formatBytes(stats.diskUsage)} / {formatBytes(stats.totalStorage)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-4">
                        <ServerStackIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Files</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalFiles.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 mr-4">
                        <ClockIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Response Time</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">48ms</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Node Status</h3>
                    <div className="h-64 flex justify-center items-center">
                      <div className="w-48 h-48">
                        <Doughnut 
                          data={statusChartData} 
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                                }
                              }
                            }
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Storage Usage by Node</h3>
                    <div className="h-64">
                      <Bar 
                        data={storageChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 100,
                              ticks: {
                                color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                              },
                              grid: {
                                color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                              }
                            },
                            x: {
                              ticks: {
                                color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                              },
                              grid: {
                                color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                              }
                            }
                          }
                        }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Node Details Tab */}
            {activeTab === 'nodes' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Node ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Storage
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Files
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Seen
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-800">
                    {nodes.map((node, index) => (
                      <tr key={node.id || index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-800'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {node.id || `node${index + 1}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
						{node.status ? (
                            node.diskUsagePercent > 90 ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                Warning
                              </span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Online
                              </span>
                            )
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              <XCircleIcon className="h-4 w-4 mr-1" />
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  node.diskUsagePercent > 90 ? 'bg-red-500' : 
                                  node.diskUsagePercent > 70 ? 'bg-yellow-500' : 
                                  'bg-green-500'
                                }`}
                                style={{ width: `${node.diskUsagePercent || 0}%` }}
                              ></div>
                            </div>
                            <span>{node.diskUsagePercent || 0}%</span>
                          </div>
                          <div className="text-xs mt-1">{formatBytes(node.diskUsage || 0)} / {formatBytes(node.totalStorage || 0)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {node.totalFiles || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {node.lastSeen ? new Date(node.lastSeen).toLocaleString() : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {node.ipAddress || 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Performance Tab */}
            {activeTab === 'performance' && (
              <div>
                <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Performance</h3>
                  <div className="h-80">
                    <Line 
                      data={performanceChartData} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                            labels: {
                              color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                            }
                          }
                        },
                        scales: {
                          y: {
                            ticks: {
                              color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                            },
                            grid: {
                              color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                            }
                          },
                          x: {
                            ticks: {
                              color: document.documentElement.classList.contains('dark') ? 'white' : 'black'
                            },
                            grid: {
                              color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* System metrics cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase">CPU Usage</h4>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">32%</p>
                    <div className="mt-2 w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: '32%' }}></div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Average across all nodes
                    </p>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase">Memory Usage</h4>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">45%</p>
                    <div className="mt-2 w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                      <div className="h-2 bg-purple-500 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Average across all nodes
                    </p>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase">Network I/O</h4>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">2.4 MB/s</p>
                    <div className="flex items-center mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">↑ 0.8 MB/s</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">↓ 1.6 MB/s</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Current throughput
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}