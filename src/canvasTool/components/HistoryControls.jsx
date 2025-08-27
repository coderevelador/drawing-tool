import React, { useState } from 'react';

const HistoryControls = ({ 
  history = [], 
  onSelectItem, 
  onClearHistory, 
  onDeleteItem,
  onExportHistory,
  currentSelection 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredHistory = history.filter(item => 
    item.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.text?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {/* <span className="text-gray-600 text-lg">🕒</span>
          <h3 className="text-lg font-semibold text-gray-800">
            Processing History ({history.length})
          </h3> */}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button> */}
          
          {history.length > 0 && (
            <>
              <button
                onClick={onExportHistory}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title="Export History"
              >
                <span className="text-sm">📥</span>
              </button>
              
              <button
                onClick={onClearHistory}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Clear All History"
              >
                <span className="text-sm">🗑️</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {isExpanded && (
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <span>✕</span>
            </button>
          )}
        </div>
      )}

      {/* History List */}
      {isExpanded && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {history.length === 0 ? (
                <div>
                  <span className="text-gray-300 text-4xl block mb-3">📄</span>
                  <p>No processing history yet</p>
                  <p className="text-sm">Upload and process a PDF to get started</p>
                </div>
              ) : (
                <p>No results found for "{searchTerm}"</p>
              )}
            </div>
          ) : (
            filteredHistory.map((item, index) => (
              <div
                key={item.id || index}
                className={`p-3 border rounded-md cursor-pointer transition-colors ${
                  currentSelection?.id === item.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => onSelectItem(item)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-gray-500">📄</span>
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {item.fileName || 'Unnamed File'}
                      </h4>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                      <span>{formatDate(item.timestamp)}</span>
                      <span>{item.numPages} pages</span>
                      <span>{formatFileSize(item.fileSize)}</span>
                    </div>
                    
                    {item.text && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {item.text.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id || index);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded ml-2"
                    title="Delete this item"
                  >
                    <span>✕</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quick Stats */}
      {!isExpanded && history.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Last processed: {formatDate(history[0]?.timestamp)}</span>
          <span>{history.reduce((acc, item) => acc + (item.numPages || 0), 0)} total pages</span>
        </div>
      )}
    </div>
  );
};

export default HistoryControls