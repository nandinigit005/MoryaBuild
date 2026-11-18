import React from 'react';
import {
  Bell,
  Search,
  Plus,
  AlertTriangle,
  Building,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStoredAuthSession, logout } from '../../services/auth';
import { fetchProjects } from '../../services/projectsApi';
import { Project } from '../../types';
import { AppNotification, dismissNotification, formatNotificationDate, getActiveNotifications, getNotificationState, markAllNotificationsRead, markNotificationRead } from '../../services/notifications';
import { SearchResult, searchRecords } from '../../services/globalSearch';

interface HeaderProps {
  onNewProjectClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewProjectClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const notificationRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const projectSelectorRef = useRef<HTMLDivElement>(null);
  const session = getStoredAuthSession();
  const currentUserName = session?.user?.name ?? 'Aniket Desai';
  const currentUserRole = session?.user?.role === 'CLIENT' ? 'Client Access' : session?.user?.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Contractor Admin';
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notificationState, setNotificationState] = useState(getNotificationState());
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const projectStatusFilters = [
    { value: 'ALL', label: 'All Projects', count: projects.length },
    { value: 'PLANNING', label: 'Planning', count: projects.filter((project) => project.status === 'PLANNING').length },
    { value: 'IN_PROGRESS', label: 'In Progress', count: projects.filter((project) => project.status === 'IN_PROGRESS').length },
    { value: 'ON_HOLD', label: 'On Hold', count: projects.filter((project) => project.status === 'ON_HOLD').length },
    { value: 'COMPLETED', label: 'Completed', count: projects.filter((project) => project.status === 'COMPLETED').length },
    { value: 'DELAYED', label: 'Delayed', count: projects.filter((project) => project.status !== 'COMPLETED' && project.expectedCompletionDate < new Date().toISOString().split('T')[0]).length },
  ];
  const selectedProjectStatus = location.pathname === '/projects' ? new URLSearchParams(location.search).get('status') || 'ALL' : 'ALL';
  const selectedProjectFilter = projectStatusFilters.find((filter) => filter.value === selectedProjectStatus) || projectStatusFilters[0];
  const atRiskCount = projects.filter(
    (p) => p.costRiskTier === 'HIGH' || p.scheduleRiskTier === 'HIGH'
  ).length;

  const refreshNotifications = () => {
    setNotifications(getActiveNotifications());
    setNotificationState(getNotificationState());
  };

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const records = await fetchProjects();
        setProjects(records as Project[]);
      } catch {
        setProjects([]);
      }
    };

    void loadProjects();
    refreshNotifications();
    const handleRefresh = () => refreshNotifications();
    const handleOutsideClick = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setIsNotificationOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsSearchOpen(false);
      if (projectSelectorRef.current && !projectSelectorRef.current.contains(event.target as Node)) setIsProjectSelectorOpen(false);
    };
    window.addEventListener('morya-notifications-updated', handleRefresh);
    window.addEventListener('storage', handleRefresh);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('morya-notifications-updated', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const unreadCount = notifications.filter((notification) => !notificationState.read.includes(notification.id)).length;
  const searchResults = searchQuery.trim() ? searchRecords(searchQuery).slice(0, 8) : [];
  const handleNotificationClick = (notification: AppNotification) => {
    markNotificationRead(notification.id);
    setIsNotificationOpen(false);
    navigate(notification.targetPath);
  };
  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    refreshNotifications();
  };
  const handleDismiss = (event: React.MouseEvent, notification: AppNotification) => {
    event.stopPropagation();
    dismissNotification(notification.id);
    refreshNotifications();
  };
  const selectSearchResult = (result: SearchResult) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    setActiveSearchIndex(-1);
    navigate(result.route);
  };
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchIndex((index) => searchResults.length ? (index + 1) % searchResults.length : -1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchIndex((index) => searchResults.length ? (index <= 0 ? searchResults.length - 1 : index - 1) : -1);
    } else if (event.key === 'Enter' && activeSearchIndex >= 0 && searchResults[activeSearchIndex]) {
      event.preventDefault();
      selectSearchResult(searchResults[activeSearchIndex]);
    } else if (event.key === 'Escape') {
      setIsSearchOpen(false);
      setActiveSearchIndex(-1);
    }
  };
  const selectProjectFilter = (status: string) => {
    setIsProjectSelectorOpen(false);
    navigate(status === 'ALL' ? '/projects' : `/projects?status=${status}`);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Left: Global Project Selector & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1" ref={searchRef}>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects, quotations, materials, or invoices..."
            className="w-full pl-9 pr-4 py-2 bg-slate-100 hover:bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-lg border border-transparent focus:border-brand-500 focus:outline-none transition-all placeholder:text-slate-400"
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(event) => { setSearchQuery(event.target.value); setActiveSearchIndex(-1); setIsSearchOpen(true); }}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search projects, quotations, materials, or invoices"
            aria-expanded={isSearchOpen}
            aria-autocomplete="list"
          />
          {isSearchOpen && <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden" role="listbox">
            {!searchQuery.trim() ? <div className="px-4 py-4 text-xs text-slate-500"><strong className="block text-slate-700 mb-1">Search Morya Enterprises</strong>Try a project, client, invoice, material, worker, or milestone.</div> : searchResults.length === 0 ? <div className="px-4 py-5 text-center text-xs text-slate-500">No results found</div> : <div className="max-h-80 overflow-y-auto">{searchResults.map((result, index) => <button key={`${result.type}-${result.id}`} type="button" role="option" aria-selected={index === activeSearchIndex} onClick={() => selectSearchResult(result)} className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 ${index === activeSearchIndex ? 'bg-slate-50' : ''}`}><span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">{result.type}</span><strong className="block text-xs text-slate-800 mt-1">{result.title}</strong><span className="block text-[11px] text-slate-500 mt-0.5 truncate">{result.subtitle}</span></button>)}</div>}
          </div>}
        </div>

        {/* Project Selector dropdown shortcut */}
        <div className="hidden md:block relative" ref={projectSelectorRef}>
          <button type="button" onClick={() => setIsProjectSelectorOpen((open) => !open)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-200/70 transition-colors" aria-expanded={isProjectSelectorOpen} aria-haspopup="listbox">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-medium truncate max-w-[140px]">{selectedProjectFilter.label} ({selectedProjectFilter.count})</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {isProjectSelectorOpen && <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1" role="listbox" aria-label="Project filters">{projectStatusFilters.map((filter) => <button key={filter.value} type="button" role="option" aria-selected={selectedProjectFilter.value === filter.value} onClick={() => selectProjectFilter(filter.value)} className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs text-left ${selectedProjectFilter.value === filter.value ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}><span>{filter.label}</span><span className="text-[11px] text-slate-400">{filter.count}</span></button>)}</div>}
        </div>
      </div>

      {/* Right: Actions, AI Alerts, and Profile */}
      <div className="flex items-center gap-3">
        {/* AI Risk Alert Quick Button */}
        {atRiskCount > 0 && (
          <button
            onClick={() => navigate('/ai-risk')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-semibold transition-colors"
            title={`${atRiskCount} projects flagged with cost overrun or delay risk`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
            <span className="hidden sm:inline">AI Risk Alert:</span>
            <span className="bg-amber-600 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
              {atRiskCount}
            </span>
          </button>
        )}

        {/* Primary "+ New Project" action */}
        <button
          onClick={onNewProjectClick || (() => navigate('/projects?create=true'))}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => { setIsNotificationOpen((open) => !open); refreshNotifications(); }}
            onKeyDown={(event) => { if (event.key === 'Escape') setIsNotificationOpen(false); }}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 relative transition-colors"
            title="Notifications & Updates"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={isNotificationOpen}
            aria-haspopup="true"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {isNotificationOpen && <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100vh-5rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-y-auto" role="menu">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Notifications</h3><p className="text-[11px] text-slate-500 mt-0.5">{unreadCount ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'You\'re all caught up!'}</p></div>{unreadCount > 0 && <button type="button" onClick={handleMarkAllRead} className="text-[11px] font-semibold text-brand-700 hover:text-brand-900">Mark all read</button>}</div>
            <div className="max-h-80 overflow-y-auto">{notifications.length === 0 ? <div className="px-5 py-8 text-center text-xs text-slate-500">You&apos;re all caught up!</div> : notifications.slice(0, 6).map((notification) => <div key={notification.id} role="menuitem" tabIndex={0} onClick={() => handleNotificationClick(notification)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleNotificationClick(notification); }} className={`px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${notificationState.read.includes(notification.id) ? 'opacity-60' : ''}`}><div className="flex items-start gap-3"><span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${notification.severity === 'critical' ? 'bg-rose-600' : notification.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><strong className="text-xs text-slate-800">{notification.title}</strong><button type="button" onClick={(event) => handleDismiss(event, notification)} className="text-[10px] text-slate-400 hover:text-rose-600" aria-label={`Dismiss ${notification.title}`}>Dismiss</button></div><p className="text-[11px] text-slate-600 mt-1">{notification.description}</p><p className="text-[10px] text-slate-400 mt-1">{notification.projectName || 'Morya Enterprises'} · {formatNotificationDate(notification.date)}</p></div></div></div>)}</div>
            <div className="p-3 border-t border-slate-100"><button type="button" onClick={() => { setIsNotificationOpen(false); navigate('/notifications'); }} className="w-full text-center text-xs font-semibold text-brand-700 hover:text-brand-900">View all notifications</button></div>
          </div>}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User Mini Avatar & Name */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center border border-brand-500 shadow-sm">
            {currentUserName.split(' ').slice(0, 2).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-none">{currentUserName}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{currentUserRole}, Morya Enterprises</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          className="hidden items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 sm:inline-flex"
        >
          Logout
        </button>
      </div>
    </header>
  );
};
