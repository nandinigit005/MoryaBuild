import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppNotification, dismissNotification, formatNotificationDate, getActiveNotifications, getNotificationState, markAllNotificationsRead, markNotificationRead, NotificationSeverity } from '../../services/notifications';

const severityClass: Record<NotificationSeverity, string> = { critical: 'bg-rose-100 text-rose-800 border-rose-200', high: 'bg-orange-100 text-orange-800 border-orange-200', medium: 'bg-amber-100 text-amber-800 border-amber-200', low: 'bg-emerald-100 text-emerald-800 border-emerald-200' };

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const refresh = () => { setNotifications(getActiveNotifications()); setReadIds(getNotificationState().read); };
  useEffect(() => { refresh(); window.addEventListener('morya-notifications-updated', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('morya-notifications-updated', refresh); window.removeEventListener('storage', refresh); }; }, []);
  const unreadCount = notifications.filter((notification) => !readIds.includes(notification.id)).length;
  const openNotification = (notification: AppNotification) => { markNotificationRead(notification.id); navigate(notification.targetPath); };
  const markRead = (notification: AppNotification) => { markNotificationRead(notification.id); refresh(); };
  const dismiss = (notification: AppNotification) => { dismissNotification(notification.id); refresh(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-[11px] font-bold text-brand-600 uppercase tracking-wider"><Bell className="w-3.5 h-3.5" /> Operations center</div><h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">Notifications & Updates</h2><p className="text-xs text-slate-500 mt-0.5">Project alerts generated from your current local records.</p></div>{unreadCount > 0 && <button type="button" onClick={() => { markAllNotificationsRead(); refresh(); }} className="self-start px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold">Mark all as read</button>}</div>
      {notifications.length === 0 ? <div className="bg-white rounded-xl border border-slate-200 p-12 text-center"><CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" /><h3 className="text-sm font-bold text-slate-800">You&apos;re all caught up!</h3><p className="text-xs text-slate-500 mt-1">There are no active project alerts right now.</p></div> : <div className="space-y-3">{notifications.map((notification) => <article key={notification.id} className={`bg-white rounded-xl border p-5 shadow-sm ${readIds.includes(notification.id) ? 'border-slate-200 opacity-70' : 'border-brand-200'}`}><div className="flex items-start gap-4"><div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${notification.severity === 'critical' ? 'bg-rose-50 text-rose-600' : notification.severity === 'high' ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-amber-600'}`}><AlertTriangle className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{notification.title}</h3><span className={`px-2 py-1 rounded-full border text-[10px] font-bold uppercase ${severityClass[notification.severity]}`}>{notification.severity}</span>{!readIds.includes(notification.id) && <span className="text-[10px] font-bold text-brand-700">Unread</span>}</div><p className="text-xs text-slate-600 mt-2">{notification.description}</p></div><button type="button" onClick={() => dismiss(notification)} className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 self-start"><X className="w-3.5 h-3.5" /> Dismiss</button></div><div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-3"><span>{notification.projectName || 'Morya Enterprises'}</span><span>{formatNotificationDate(notification.date)}</span></div><div className="flex flex-wrap gap-2 mt-4"><button type="button" onClick={() => openNotification(notification)} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">View related record</button>{!readIds.includes(notification.id) && <button type="button" onClick={() => markRead(notification)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Mark as read</button>}</div></div></div></article>)}</div>}
    </div>
  );
};

export default NotificationsPage;
