import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';

interface Platform {
  id: string;
  name: string;
  apiUrl: string;
  accessToken?: string;
  isActive: boolean;
  createdAt: string;
  userId: string;
}

export default function Settings() {
  const { addToast } = useToast();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [newPlatform, setNewPlatform] = useState({
    name: '',
    type: 'gitlab' as 'gitlab' | 'github',
    baseUrl: 'https://gitlab.com',
    token: ''
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    try {
      const response = await axios.get('/api/protected/platforms');
      console.log('Loaded platforms:', response.data);
      setPlatforms(response.data);
    } catch (error) {
      console.error('Failed to load platforms:', error);
      addToast('Failed to load platforms', 'error');
    }
  };

  const addPlatform = async () => {
    setLoading(true);
    try {
      // Frontend validation
      if (!newPlatform.name.trim()) {
        addToast('Platform name is required', 'error');
        setLoading(false);
        return;
      }
      
      if (!newPlatform.token.trim()) {
        addToast('Access token is required', 'error');
        setLoading(false);
        return;
      }
      
      if (newPlatform.type === 'gitlab' && !newPlatform.baseUrl.trim()) {
        addToast('GitLab URL is required', 'error');
        setLoading(false);
        return;
      }
      
      // For GitHub, always use the standard API URL
      const platformData = {
        ...newPlatform,
        baseUrl: newPlatform.type === 'github' ? 'https://api.github.com' : newPlatform.baseUrl
      };
      
      console.log('Sending platform data:', platformData);
      await axios.post('/api/protected/platforms', platformData);
      setNewPlatform({ name: '', type: 'gitlab', baseUrl: 'https://gitlab.com', token: '' });
      setShowAddPlatform(false);
      await loadPlatforms();
      addToast('Platform added successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to add platform:', error);
      console.error('Backend response:', error.response?.data);
      
      let errorMessage = 'Failed to add platform';
      if (error.response?.data?.error) {
        if (typeof error.response.data.error === 'string') {
          errorMessage = error.response.data.error;
        } else if (typeof error.response.data.error === 'object') {
          // Handle object errors (like GitLab validation errors)
          errorMessage = error.response.data.error.message || 
                        error.response.data.error.error || 
                        JSON.stringify(error.response.data.error);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addToast(errorMessage, 'error');
    }
    setLoading(false);
  };

  const testConnection = async (platformId: string) => {
    setTesting(true);
    try {
      await axios.post(`/api/protected/platforms/${platformId}/test`);
      addToast('Connection successful!', 'success');
      await loadPlatforms();
    } catch (error: any) {
      let errorMessage = 'Connection failed';
      if (error.response?.data?.error) {
        if (typeof error.response.data.error === 'string') {
          errorMessage = error.response.data.error;
        } else if (typeof error.response.data.error === 'object') {
          errorMessage = error.response.data.error.message || 
                        error.response.data.error.error || 
                        JSON.stringify(error.response.data.error);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      addToast(errorMessage, 'error');
    }
    setTesting(false);
  };

  const deletePlatform = async (platformId: string) => {
    if (!confirm('Are you sure you want to delete this platform?')) return;
    
    try {
      await axios.delete(`/api/protected/platforms/${platformId}`);
      await loadPlatforms();
      addToast('Platform deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete platform:', error);
      addToast('Failed to delete platform', 'error');
    }
  };

  return (
    <div className="h-full bg-white dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8 py-8 px-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure platform integrations to automatically create tickets from user stories.
          </p>
        </div>

        {/* Platform Integrations */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Platform Integrations
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Connect GitLab or GitHub to automatically create issues from generated user stories.
              </p>
            </div>
            <button
              onClick={() => setShowAddPlatform(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Add Platform
            </button>
          </div>

          {/* Existing Platforms */}
          <div className="space-y-4">
            {platforms.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No platforms configured yet. Add GitLab or GitHub to get started.
              </div>
            ) : (
              platforms.map((platform) => {
                // Safety check to ensure platform has required properties
                if (!platform || typeof platform !== 'object' || !platform.id || !platform.name) {
                  console.warn('Invalid platform object:', platform);
                  return null;
                }
                
                return (
                  <div
                    key={platform.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${
                        platform.isActive ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {platform.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {platform.name.startsWith('GITLAB:') ? 'GITLAB' : 'GITHUB'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => testConnection(platform.id)}
                        disabled={testing}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => deletePlatform(platform.id)}
                        className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Platform Modal - Improved Design */}
          {showAddPlatform && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Add Platform Integration
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Platform Name
                    </label>
                    <input
                      type="text"
                      value={newPlatform.name}
                      onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
                      placeholder="My GitLab Instance"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Platform Type
                    </label>
                    <select
                      value={newPlatform.type}
                      onChange={(e) => {
                        const type = e.target.value as 'gitlab' | 'github';
                        setNewPlatform({ 
                          ...newPlatform, 
                          type,
                          baseUrl: type === 'github' ? 'https://api.github.com' : 'https://gitlab.com'
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="gitlab">GitLab</option>
                      <option value="github">GitHub</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {newPlatform.type === 'gitlab' ? 'GitLab URL' : 'GitHub API URL'}
                    </label>
                    <input
                      type="url"
                      value={newPlatform.baseUrl}
                      onChange={(e) => setNewPlatform({ ...newPlatform, baseUrl: e.target.value })}
                      placeholder={newPlatform.type === 'gitlab' ? 'https://gitlab.com' : 'https://api.github.com'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={newPlatform.type === 'github'}
                    />
                    {newPlatform.type === 'github' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        GitHub uses the standard API URL automatically
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={newPlatform.token}
                      onChange={(e) => setNewPlatform({ ...newPlatform, token: e.target.value })}
                      placeholder="Your personal access token"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAddPlatform(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addPlatform}
                    disabled={loading || !newPlatform.name || !newPlatform.token}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
                  >
                    {loading ? 'Adding...' : 'Add Platform'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
              How to Set Up Platform Integration
            </h3>
            <div className="space-y-4 text-blue-800 dark:text-blue-200">
              <div>
                <h4 className="font-medium">For GitLab:</h4>
                <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
                  <li>Go to GitLab → User Settings → Access Tokens</li>
                  <li>Create a token with 'api' scope</li>
                  <li>Get your project ID from the project's General Settings</li>
                  <li>Use your GitLab instance URL (e.g., https://gitlab.com)</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium">For GitHub:</h4>
                <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
                  <li>Go to GitHub → Settings → Developer settings → Personal access tokens</li>
                  <li>Create a token with 'repo' scope</li>
                  <li>Use the repository format: owner/repository-name</li>
                  <li>Use https://api.github.com as the base URL</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}