import React, { useState, useEffect } from 'react';
import { Plus, Minus, TrendingUp, Calendar, Settings, X, ChevronDown } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const HabitTracker = () => {
  const [axes, setAxes] = useState([
    { id: 1, name: 'Religion', color: '#8B5CF6' },
    { id: 2, name: 'Sport & Health', color: '#10B981' },
    { id: 3, name: 'Teaching', color: '#F59E0B' },
    { id: 4, name: 'Research', color: '#3B82F6' },
    { id: 5, name: 'Incubator & Administration', color: '#EF4444' },
    { id: 6, name: 'Learning', color: '#EC4899' }
  ]);
  
  const [todayProgress, setTodayProgress] = useState({});
  const [history, setHistory] = useState([]);
  const [showAddAxis, setShowAddAxis] = useState(false);
  const [newAxisName, setNewAxisName] = useState('');
  const [view, setView] = useState('today');
  const [dateRange, setDateRange] = useState('week');
  const [selectedAxes, setSelectedAxes] = useState([]);
  const [db, setDb] = useState(null);

  useEffect(() => {
    initDB();
  }, []);

  useEffect(() => {
    if (db) {
      loadTodayProgress();
      loadHistory();
    }
  }, [db]);

  useEffect(() => {
    setSelectedAxes(axes.map(a => a.id));
  }, [axes]);

  const initDB = () => {
    const request = indexedDB.open('HabitTrackerDB', 1);
    
    request.onerror = () => console.error('Database failed to open');
    
    request.onsuccess = () => {
      setDb(request.result);
    };
    
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      
      if (!database.objectStoreNames.contains('progress')) {
        const progressStore = database.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
        progressStore.createIndex('date', 'date', { unique: false });
        progressStore.createIndex('axisId', 'axisId', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('axes')) {
        database.createObjectStore('axes', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!database.objectStoreNames.contains('dailyProgress')) {
        const dailyStore = database.createObjectStore('dailyProgress', { keyPath: 'key' });
      }
    };
  };

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  const loadTodayProgress = () => {
    if (!db) return;
    
    const transaction = db.transaction(['dailyProgress'], 'readonly');
    const store = transaction.objectStore('dailyProgress');
    const request = store.get(getTodayKey());
    
    request.onsuccess = () => {
      if (request.result) {
        setTodayProgress(request.result.data);
      } else {
        const initial = {};
        axes.forEach(axis => initial[axis.id] = 0);
        setTodayProgress(initial);
      }
    };
  };

  const saveTodayProgress = (newProgress) => {
    if (!db) return;
    
    const transaction = db.transaction(['dailyProgress'], 'readwrite');
    const store = transaction.objectStore('dailyProgress');
    store.put({ key: getTodayKey(), data: newProgress });
  };

  const loadHistory = () => {
    if (!db) return;
    
    const transaction = db.transaction(['progress'], 'readonly');
    const store = transaction.objectStore('progress');
    const request = store.getAll();
    
    request.onsuccess = () => {
      setHistory(request.result || []);
    };
  };

  const saveToHistory = (axisId, value, date = getTodayKey()) => {
    if (!db || value === 0) return;
    
    const transaction = db.transaction(['progress'], 'readwrite');
    const store = transaction.objectStore('progress');
    store.add({ axisId, value, date, timestamp: new Date().toISOString() });
    
    transaction.oncomplete = () => loadHistory();
  };

  const increment = (axisId) => {
    const newProgress = { ...todayProgress, [axisId]: (todayProgress[axisId] || 0) + 1 };
    setTodayProgress(newProgress);
    saveTodayProgress(newProgress);
    saveToHistory(axisId, 1);
  };

  const decrement = (axisId) => {
    const newProgress = { ...todayProgress, [axisId]: (todayProgress[axisId] || 0) - 1 };
    setTodayProgress(newProgress);
    saveTodayProgress(newProgress);
    saveToHistory(axisId, -1);
  };

  const addAxis = () => {
    if (!newAxisName.trim()) return;
    
    const colors = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];
    const newAxis = {
      id: Date.now(),
      name: newAxisName.trim(),
      color: colors[axes.length % colors.length]
    };
    
    setAxes([...axes, newAxis]);
    setTodayProgress({ ...todayProgress, [newAxis.id]: 0 });
    setNewAxisName('');
    setShowAddAxis(false);
  };

  const getDateRange = () => {
    const today = new Date();
    const ranges = {
      week: 7,
      month: 30,
      quarter: 90
    };
    
    const days = ranges[dateRange] || 7;
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    
    return { start, end: today };
  };

  const getChartData = () => {
    const { start, end } = getDateRange();
    const dateMap = {};
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dateMap[key] = { date: key };
      axes.forEach(axis => dateMap[key][axis.name] = 0);
    }
    
    history.forEach(entry => {
      if (dateMap[entry.date] && selectedAxes.includes(entry.axisId)) {
        const axis = axes.find(a => a.id === entry.axisId);
        if (axis) {
          dateMap[entry.date][axis.name] = (dateMap[entry.date][axis.name] || 0) + entry.value;
        }
      }
    });
    
    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getSummaryData = () => {
    const { start } = getDateRange();
    return axes
      .filter(axis => selectedAxes.includes(axis.id))
      .map(axis => {
        const total = history
          .filter(h => h.axisId === axis.id && new Date(h.date) >= start)
          .reduce((sum, h) => sum + h.value, 0);
        return { name: axis.name, total, color: axis.color };
      });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Habit Tracker</h1>
          <p className="text-gray-600">Track your progress across different areas of life</p>
        </header>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setView('today')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              view === 'today' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setView('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              view === 'analytics' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Analytics
          </button>
        </div>

        {view === 'today' && (
          <div className="space-y-3">
            {axes.map(axis => (
              <div key={axis.id} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-all">
                <div className="flex items-stretch">
                  <button
                    onClick={() => decrement(axis.id)}
                    className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95 transition-all duration-150 flex items-center justify-center min-h-[100px] touch-manipulation"
                  >
                    <Minus size={48} className="text-white" strokeWidth={3} />
                  </button>
                  
                  <div className="flex flex-col items-center justify-center px-6 py-4 min-w-[140px] bg-gradient-to-b from-gray-50 to-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: axis.color }}></div>
                      <h3 className="text-sm font-medium text-gray-600 text-center">{axis.name}</h3>
                    </div>
                    <span className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {todayProgress[axis.id] || 0}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => increment(axis.id)}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:scale-95 transition-all duration-150 flex items-center justify-center min-h-[100px] touch-manipulation"
                  >
                    <Plus size={48} className="text-white" strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowAddAxis(true)}
              className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 rounded-2xl p-6 hover:from-indigo-100 hover:to-purple-100 transition-all flex items-center justify-center gap-3 font-semibold text-lg shadow-sm hover:shadow-md"
            >
              <Plus size={28} strokeWidth={2.5} />
              Add New Axis
            </button>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 90 Days</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter Axes</label>
                  <div className="relative">
                    <button className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between">
                      <span className="text-gray-700">{selectedAxes.length} selected</span>
                      <ChevronDown size={20} />
                    </button>
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-2 space-y-1">
                      {axes.map(axis => (
                        <label key={axis.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAxes.includes(axis.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAxes([...selectedAxes, axis.id]);
                              } else {
                                setSelectedAxes(selectedAxes.filter(id => id !== axis.id));
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span className="text-sm text-gray-700">{axis.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis />
                    <Tooltip labelFormatter={formatDate} />
                    <Legend />
                    {axes.filter(a => selectedAxes.includes(a.id)).map(axis => (
                      <Line
                        key={axis.id}
                        type="monotone"
                        dataKey={axis.name}
                        stroke={axis.color}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Progress Summary</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getSummaryData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {showAddAxis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Add New Axis</h3>
                <button onClick={() => setShowAddAxis(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <input
                type="text"
                value={newAxisName}
                onChange={(e) => setNewAxisName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAxis()}
                placeholder="Enter axis name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddAxis(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addAxis}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add Axis
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HabitTracker;
