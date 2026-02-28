import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Car, ShieldCheck, AlertTriangle, Lightbulb as LucideTooltip, 
  Info, History, ChevronRight, Star, DollarSign, Clock, 
  CheckCircle2, XCircle, Loader2, Sparkles, Heart, 
  Smartphone,
  MessageSquare, LayoutGrid, ArrowLeftRight, Settings,
  Send, User, Bot, Filter, SlidersHorizontal, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { generateVehicleReport, VehicleReport, getAiMechanicResponse, generateComparisonSummary, ChatMessage } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'search' | 'compare' | 'favorites' | 'mechanic' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [darkMode, setDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VehicleReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Storage states
  const [history, setHistory] = useState<VehicleReport[]>([]);
  const [favorites, setFavorites] = useState<VehicleReport[]>([]);
  const [compareList, setCompareList] = useState<VehicleReport[]>([]);
  
  // AI Mechanic states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [mileageFilter, setMileageFilter] = useState('any');
  const [issueFilter, setIssueFilter] = useState('all');

  // Comparison state
  const [comparisonSummary, setComparisonSummary] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('vehicle_history');
    const savedFavorites = localStorage.getItem('vehicle_favorites');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
  }, []);

  // Sound Effects
  const playSound = (type: 'tap' | 'transition' | 'success') => {
    if (!soundEnabled) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'tap') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'transition') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  };

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('dark_mode');
    const savedSound = localStorage.getItem('sound_enabled');
    if (savedDarkMode !== null) setDarkMode(savedDarkMode === 'true');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark_mode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('sound_enabled', soundEnabled.toString());
  }, [soundEnabled]);

  const handleTabChange = (t: Tab) => {
    playSound('transition');
    setActiveTab(t);
  };

  const saveToHistory = (newReport: VehicleReport) => {
    const updatedHistory = [newReport, ...history.filter(h => !(h.make === newReport.make && h.model === newReport.model && h.year === newReport.year))].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('vehicle_history', JSON.stringify(updatedHistory));
  };

  const toggleFavorite = (v: VehicleReport) => {
    const isFav = favorites.some(f => f.make === v.make && f.model === v.model && f.year === v.year);
    let updated;
    if (isFav) {
      updated = favorites.filter(f => !(f.make === v.make && f.model === v.model && f.year === v.year));
    } else {
      updated = [v, ...favorites];
    }
    setFavorites(updated);
    localStorage.setItem('vehicle_favorites', JSON.stringify(updated));
  };

  const addToCompare = (v: VehicleReport) => {
    if (compareList.length >= 3) return;
    if (compareList.some(c => c.make === v.make && c.model === v.model && c.year === v.year)) return;
    setCompareList([...compareList, v]);
    setActiveTab('compare');
  };

  const removeFromCompare = (idx: number) => {
    setCompareList(compareList.filter((_, i) => i !== idx));
    setComparisonSummary(null);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!make || !model || !year) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const result = await generateVehicleReport(make, model, parseInt(year));
      setReport(result);
      saveToHistory(result);
      playSound('success');
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await getAiMechanicResponse(chatMessages, chatInput);
      setChatMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting to my tools right now." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const runComparison = async () => {
    if (compareList.length < 2) return;
    setComparing(true);
    try {
      const summary = await generateComparisonSummary(compareList);
      setComparisonSummary(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setComparing(false);
    }
  };

  // Filtered Common Issues for the current report
  const filteredIssues = report?.commonIssues.filter(issue => {
    if (issueFilter === 'all') return true;
    return issue.category.toLowerCase().includes(issueFilter.toLowerCase());
  }) || [];

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="h-16 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight gradient-text">AutoTrust AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => handleTabChange('settings')}
            className={cn("p-2 rounded-full transition-all", activeTab === 'settings' ? "bg-emerald-500/10 text-emerald-500" : "hover:bg-white/5 text-zinc-400")}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="app-content">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && (
            <motion.div 
              key="search-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 max-w-4xl mx-auto"
            >
              {/* Search Header */}
              {!report && (
                <div className="mb-8">
                  <h1 className="text-4xl font-bold tracking-tight mb-2">Find Your Next <span className="text-emerald-400">Reliable</span> Ride</h1>
                  <p className="text-zinc-500">Search millions of data points with AI precision.</p>
                </div>
              )}

              {/* Search Bar & Filters */}
              <div className="glass-panel p-4 mb-8 shadow-xl">
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Year"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-white/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Make"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      className="w-full bg-zinc-800/50 border border-white/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-zinc-800/50 border border-white/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium",
                        showFilters ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"
                      )}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Filters
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-zinc-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5" /> Analyze</>}
                    </button>
                  </div>

                  {showFilters && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Mileage Range</label>
                        <select 
                          value={mileageFilter}
                          onChange={(e) => setMileageFilter(e.target.value)}
                          className="w-full bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none"
                        >
                          <option value="any">Any Mileage</option>
                          <option value="low">Low (&lt; 50k)</option>
                          <option value="mid">Mid (50k - 100k)</option>
                          <option value="high">High (100k+)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Focus Issue</label>
                        <select 
                          value={issueFilter}
                          onChange={(e) => setIssueFilter(e.target.value)}
                          className="w-full bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none"
                        >
                          <option value="all">All Systems</option>
                          <option value="engine">Engine</option>
                          <option value="transmission">Transmission</option>
                          <option value="electrical">Electrical</option>
                          <option value="suspension">Suspension</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </form>
              </div>

              {/* Report View */}
              {report && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Quick Summary Card */}
                  <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-500">AI Quick Summary</h3>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                      {report.summary.replace(/\\n/g, '\n')}
                    </p>
                  </div>

                  <div className="glass-panel p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-zinc-500 font-mono text-xs mb-1 uppercase tracking-widest">{report.year} {report.make}</div>
                        <h2 className="text-3xl font-bold">{report.model}</h2>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => toggleFavorite(report)}
                          className={cn(
                            "p-3 rounded-xl border transition-all",
                            favorites.some(f => f.make === report.make && f.model === report.model) 
                              ? "bg-red-500/10 border-red-500/20 text-red-400" 
                              : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10"
                          )}
                        >
                          <Heart className={cn("w-5 h-5", favorites.some(f => f.make === report.make && f.model === report.model) && "fill-current")} />
                        </button>
                        <button 
                          onClick={() => addToCompare(report)}
                          className="p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-500 hover:bg-white/10 transition-all"
                        >
                          <ArrowLeftRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Score</div>
                        <div className="text-2xl font-bold text-emerald-400">{report.reliabilityScore}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Verdict</div>
                        <div className="text-sm font-bold truncate">{report.verdict}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Annual Cost</div>
                        <div className="text-sm font-bold truncate">{report.estimatedAnnualCost}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Longevity</div>
                        <div className="text-sm font-bold truncate">{report.longevityRating}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Common Issues {issueFilter !== 'all' && <span className="text-xs font-normal text-zinc-500">(Filtered by {issueFilter})</span>}
                      </h3>
                      <div className="space-y-3">
                        {filteredIssues.length > 0 ? filteredIssues.map((issue, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{issue.category}</span>
                              <span className={cn(
                                "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                                issue.severity === 'High' ? "text-red-400 bg-red-400/10" : "text-amber-400 bg-amber-400/10"
                              )}>{issue.severity}</span>
                            </div>
                            <p className="text-sm text-zinc-400">{issue.description}</p>
                          </div>
                        )) : (
                          <div className="p-8 text-center text-zinc-600 border border-dashed border-white/10 rounded-xl">
                            No issues found for this filter.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <LucideTooltip className="w-5 h-5 text-emerald-400" />
                        Maintenance Tips
                      </h3>
                      <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                        {report.maintenanceTips.map((tip, idx) => (
                          <div key={idx} className="flex gap-3 text-sm text-zinc-300">
                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            {tip}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-6 markdown-body">
                    <Markdown>{report.fullReportMarkdown.replace(/\\n/g, '\n')}</Markdown>
                  </div>
                </motion.div>
              )}

              {/* Recent History */}
              {!report && history.length > 0 && (
                <div className="mt-12 space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-400">
                    <History className="w-5 h-5" />
                    Recent Searches
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {history.map((h, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => { setReport(h); setYear(h.year.toString()); setMake(h.make); setModel(h.model); }}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                      >
                        <div className="text-left">
                          <div className="text-[10px] font-mono text-zinc-500 uppercase">{h.year}</div>
                          <div className="font-bold">{h.make} {h.model}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-emerald-400 font-bold">{h.reliabilityScore}</div>
                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'compare' && (
            <motion.div 
              key="compare-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 max-w-5xl mx-auto"
            >
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Vehicle Comparison</h1>
                <p className="text-zinc-500">Select up to 3 vehicles to compare reliability head-to-head.</p>
              </div>

              {compareList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <ArrowLeftRight className="w-8 h-8 text-zinc-600" />
                  </div>
                  <h3 className="text-xl font-bold">Your comparison list is empty</h3>
                  <p className="text-zinc-500 max-w-xs">Search for vehicles and tap the comparison icon to add them here.</p>
                  <button onClick={() => setActiveTab('search')} className="px-6 py-2 bg-emerald-500 text-zinc-950 font-bold rounded-xl">Go to Search</button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {compareList.map((v, idx) => (
                      <div key={idx} className="glass-panel p-5 relative">
                        <button 
                          onClick={() => removeFromCompare(idx)}
                          className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="text-zinc-500 font-mono text-[10px] uppercase mb-1">{v.year} {v.make}</div>
                        <h3 className="text-xl font-bold mb-4">{v.model}</h3>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-zinc-500">Reliability</span>
                            <span className="font-bold text-emerald-400">{v.reliabilityScore}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-zinc-500">Annual Cost</span>
                            <span className="text-xs font-bold">{v.estimatedAnnualCost}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-zinc-500">Verdict</span>
                            <span className="text-xs font-bold">{v.verdict}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {compareList.length < 3 && (
                      <button 
                        onClick={() => setActiveTab('search')}
                        className="border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 text-zinc-500 hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
                      >
                        <Search className="w-6 h-6 mb-2" />
                        <span className="text-sm font-bold">Add Vehicle</span>
                      </button>
                    )}
                  </div>

                  {compareList.length >= 2 && (
                    <div className="space-y-6">
                      <button 
                        onClick={runComparison}
                        disabled={comparing}
                        className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {comparing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Sparkles className="w-6 h-6" /> Generate AI Comparison Summary</>}
                      </button>

                      {comparisonSummary && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-8 markdown-body">
                          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Bot className="w-6 h-6 text-emerald-400" />
                            AI Comparative Verdict
                          </h3>
                          <Markdown>{comparisonSummary.replace(/\\n/g, '\n')}</Markdown>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'favorites' && (
            <motion.div 
              key="favorites-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 max-w-4xl mx-auto"
            >
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Favorites</h1>
                <p className="text-zinc-500">Your curated list of reliable vehicles.</p>
              </div>

              {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <Heart className="w-8 h-8 text-zinc-600" />
                  </div>
                  <h3 className="text-xl font-bold">No favorites yet</h3>
                  <p className="text-zinc-500 max-w-xs">Tap the heart icon on any vehicle report to save it here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {favorites.map((f, idx) => (
                    <div key={idx} className="glass-panel p-5 flex items-center justify-between group">
                      <button 
                        onClick={() => { setReport(f); setActiveTab('search'); }}
                        className="flex-1 text-left"
                      >
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">{f.year} {f.make}</div>
                        <div className="text-lg font-bold">{f.model}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-emerald-400 font-bold">{f.reliabilityScore} Score</span>
                          <span className="text-zinc-700">•</span>
                          <span className="text-xs text-zinc-500">{f.verdict}</span>
                        </div>
                      </button>
                      <button 
                        onClick={() => toggleFavorite(f)}
                        className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <Heart className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings-tab"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 max-w-2xl mx-auto space-y-6"
            >
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-zinc-500">Customize your AutoTrust experience.</p>
              </div>

              <div className="space-y-4">
                <div className="glass-panel p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="font-bold">Dark Mode</div>
                      <div className="text-xs text-zinc-500">Toggle dark and light themes</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { playSound('tap'); setDarkMode(!darkMode); }}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      darkMode ? "bg-emerald-500" : "bg-zinc-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      darkMode ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="glass-panel p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                      <LucideTooltip className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-bold">Sound Effects</div>
                      <div className="text-xs text-zinc-500">Enable UI feedback sounds</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setSoundEnabled(!soundEnabled); if(!soundEnabled) playSound('tap'); }}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      soundEnabled ? "bg-emerald-500" : "bg-zinc-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      soundEnabled ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="glass-panel p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                      <History className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-bold">Clear History</div>
                      <div className="text-xs text-zinc-500">Remove all recent searches</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { playSound('tap'); setHistory([]); localStorage.removeItem('vehicle_history'); }}
                    className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                  >
                    Clear
                  </button>
                </div>

                <div className="glass-panel p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                      <Send className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="font-bold">Share App</div>
                      <div className="text-xs text-zinc-500">Invite friends to AutoTrust AI</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      playSound('tap');
                      if (navigator.share) {
                        navigator.share({
                          title: 'AutoTrust AI',
                          text: 'Check out this professional vehicle reliability app!',
                          url: window.location.href,
                        });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert('Link copied to clipboard!');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                  >
                    Share
                  </button>
                </div>

                <div className="glass-panel p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="font-bold">Install as App (Free)</div>
                      <div className="text-xs text-zinc-500">No Play Store account needed</div>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-4">
                    You can install AutoTrust AI directly to your home screen for free. This gives you a full-screen, native app experience without paying Google Play fees.
                  </p>
                  <div className="bg-zinc-100 dark:bg-white/5 p-4 rounded-xl space-y-2">
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Instructions:</div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold">1</div>
                      <span>Tap the <span className="font-bold">Share</span> or <span className="font-bold">Menu</span> button in your browser.</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold">2</div>
                      <span>Select <span className="font-bold">"Add to Home Screen"</span>.</span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                      <Info className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <div className="font-bold">About AutoTrust AI</div>
                      <div className="text-xs text-zinc-500">Version 2.1.0 (Stable)</div>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    AutoTrust AI uses advanced machine learning to provide the most accurate vehicle reliability data. Our mission is to make car buying transparent and stress-free.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'mechanic' && (
            <motion.div 
              key="mechanic-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full max-w-3xl mx-auto"
            >
              <div className="p-6 border-b border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">AI Mechanic</h1>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">24/7 Virtual Support</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 max-w-sm">
                      <h3 className="text-lg font-bold mb-2">How can I help you today?</h3>
                      <p className="text-sm text-zinc-500">Ask me about weird noises, maintenance schedules, or how to fix common issues.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                      {["Brake squealing", "Check engine light", "Oil change interval", "Battery issues"].map((q, i) => (
                        <button 
                          key={i}
                          onClick={() => { setChatInput(q); }}
                          className="p-3 text-xs font-bold text-zinc-400 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      msg.role === 'user' ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"
                    )}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed",
                      msg.role === 'user' ? "bg-blue-500 text-white rounded-tr-none" : "bg-zinc-800 text-zinc-200 rounded-tl-none"
                    )}>
                      {msg.role === 'user' ? msg.text : <Markdown>{msg.text.replace(/\\n/g, '\n')}</Markdown>}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="p-4 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 border-t border-white/5 bg-zinc-900/50">
                <form onSubmit={handleChat} className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Describe your car issue..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-white/5 rounded-2xl px-5 py-3 focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none"
                  />
                  <button 
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="w-12 h-12 rounded-2xl bg-emerald-500 text-zinc-950 flex items-center justify-center hover:bg-emerald-400 transition-all disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="bottom-nav safe-area-bottom">
        <button 
          onClick={() => handleTabChange('search')}
          className={cn("nav-item", activeTab === 'search' && "active")}
        >
          <Search className="nav-item-icon" />
          <span className="nav-item-label">Search</span>
        </button>
        <button 
          onClick={() => handleTabChange('compare')}
          className={cn("nav-item", activeTab === 'compare' && "active")}
        >
          <ArrowLeftRight className="nav-item-icon" />
          <span className="nav-item-label">Compare</span>
        </button>
        <button 
          onClick={() => handleTabChange('favorites')}
          className={cn("nav-item", activeTab === 'favorites' && "active")}
        >
          <Heart className="nav-item-icon" />
          <span className="nav-item-label">Favorites</span>
        </button>
        <button 
          onClick={() => handleTabChange('mechanic')}
          className={cn("nav-item", activeTab === 'mechanic' && "active")}
        >
          <MessageSquare className="nav-item-icon" />
          <span className="nav-item-label">Mechanic</span>
        </button>
      </nav>
    </div>
  );
}
