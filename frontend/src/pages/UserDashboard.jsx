import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, MapPin, X, Check, XCircle, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutList, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthData } from '../utils/authStorage';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const CATEGORIES = ['General', 'Meeting', 'Workshop', 'Holiday', 'Training', 'Social'];
const CATEGORY_COLORS = {
    General:  { bg: '#eff6ff', color: '#2563eb' },
    Meeting:  { bg: '#fef3c7', color: '#d97706' },
    Workshop: { bg: '#f0fdf4', color: '#16a34a' },
    Holiday:  { bg: '#fce7f3', color: '#db2777' },
    Training: { bg: '#f5f3ff', color: '#7c3aed' },
    Social:   { bg: '#fff7ed', color: '#ea580c' },
};

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const unrollEvents = (events) => {
    const unrolled = [];
    events.forEach(e => {
        const startDateStr = e.event_date.slice(0, 10);
        const endDateStr = e.end_date ? e.end_date.slice(0, 10) : startDateStr;
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        const isMultiDay = startDate.getTime() !== endDate.getTime();
        
        let currentDate = new Date(startDateStr);
        let dayCount = 1;
        
        while (currentDate <= endDate) {
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            
            unrolled.push({
                ...e,
                title: isMultiDay ? `${e.title} : Day ${dayCount}` : e.title,
                event_date: `${y}-${m}-${d}`,
                _listKey: `${e.event_id || e.id}_day${dayCount}`
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
    });
    return unrolled;
};

const toCalendarEvents = (unrolledEvents) => unrolledEvents.map(e => {
    const date = e.event_date.slice(0, 10);
    const [sH, sM] = e.start_time.split(':');
    const [eH, eM] = e.end_time.split(':');
    const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
    const end = new Date(date); end.setHours(+eH, +eM, 0, 0);
    return { title: e.title, start, end, resource: e };
});

const groupMultiDaySpans = (eventsList) => {
    const grouped = [];
    const spanMap = {};
    
    eventsList.forEach(e => {
        if (e.span_id) {
            if (!spanMap[e.span_id]) {
                spanMap[e.span_id] = [];
            }
            spanMap[e.span_id].push(e);
        } else {
            grouped.push(e);
        }
    });
    
    Object.keys(spanMap).forEach(spanId => {
        const group = spanMap[spanId];
        group.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
        
        const firstEvent = group[0];
        const lastEvent = group[group.length - 1];
        
        grouped.push({
            ...firstEvent,
            event_date: firstEvent.event_date,
            end_date: lastEvent.event_date,
            isMultiDaySpan: true,
            days: group
        });
    });
    
    return grouped;
};

const CustomCalendarToolbar = ({ label, onNavigate, onView, view, date, setCalendarDate }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8, padding: '4px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {view === 'day' && (
                <button 
                    onClick={() => onView('month')} 
                    className="btn-icon" 
                    style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', background: 'var(--bg-hover)', cursor: 'pointer', transition: 'all 0.2s', marginRight: 4 }}
                    title="Back to month view"
                >
                    <ChevronLeft size={16} />
                </button>
            )}
            <button onClick={() => setCalendarDate && setCalendarDate(new Date(date.getFullYear() - 1, date.getMonth(), date.getDate()))} className="btn-icon" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', background: 'var(--bg-hover)', cursor: 'pointer', transition: 'all 0.2s' }} title="Previous Year">
                <ChevronsLeft size={16} />
            </button>
            <button onClick={() => onNavigate('PREV')} className="btn-icon" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', background: 'var(--bg-hover)', cursor: 'pointer', transition: 'all 0.2s' }} title="Previous Month">
                <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>{label}</span>
            <button onClick={() => onNavigate('NEXT')} className="btn-icon" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', background: 'var(--bg-hover)', cursor: 'pointer', transition: 'all 0.2s' }} title="Next Month">
                <ChevronRight size={16} />
            </button>
            <button onClick={() => setCalendarDate && setCalendarDate(new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()))} className="btn-icon" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', background: 'var(--bg-hover)', cursor: 'pointer', transition: 'all 0.2s' }} title="Next Year">
                <ChevronsRight size={16} />
            </button>
        </div>
    </div>
);

const ClosedEyeIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 8 Q12 16 20 8" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/>
    <line x1="7.5" y1="11.5" x2="6.5" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="10.5" y1="13" x2="10" y2="15.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="13.5" y1="13" x2="14" y2="15.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="16.5" y1="11.5" x2="17.5" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
};

const PreviewModal = ({ event, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <div>
                    <span className="status-badge">Confirmed</span>
                    <h2 className="event-title" style={{ marginBottom: 4 }}>{event.title}</h2>
                </div>
                <button className="btn-icon" onClick={onClose}><X size={20} /></button>
            </div>

            <div className="event-meta" style={{ marginBottom: 16 }}>
                <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString('en-GB')}</span></div>
                <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>

            </div>

            {event.description && (
                <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{event.description}</p>
                </div>
            )}
        </div>
    </div>
);

const UserEventCard = ({ event, onPreview, tab }) => {
    const [expanded, setExpanded] = useState(false);
    
    const startDateStr = event.event_date.slice(0, 10);
    const endDateStr = event.end_date ? event.end_date.slice(0, 10) : startDateStr;
    const isMultiDay = startDateStr !== endDateStr;
    
    const days = [];
    if (isMultiDay) {
        let currentDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        let dayCount = 1;
        while (currentDate <= endDate) {
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            days.push({
                dayNumber: dayCount,
                dateStr: `${y}-${m}-${d}`,
                formattedDate: currentDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
    }
    
    return (
        <div className="event-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 16 }}>
                <div className="event-info" style={{ flex: 1 }}>
                    <span className="status-badge" style={tab === 'past' ? { background: '#f1f5f9', color: '#64748b' } : tab === 'live' ? { background: '#dcfce7', color: '#16a34a' } : {}}>
                        {tab === 'past' ? 'Past' : tab === 'live' ? '🔴 Live' : 'Confirmed'}
                    </span>
                    {event.category && (
                        <span className="category-badge" style={{ background: CATEGORY_COLORS[event.category.charAt(0).toUpperCase() + event.category.slice(1).toLowerCase()]?.bg || '#f1f5f9', color: CATEGORY_COLORS[event.category.charAt(0).toUpperCase() + event.category.slice(1).toLowerCase()]?.color || '#64748b', textTransform: 'capitalize' }}>
                            {event.category}
                        </span>
                    )}
                    <h3 className="event-title" style={{ marginTop: 8 }}>{event.title}</h3>
                    <div className="event-meta" style={{ marginTop: 8 }}>
                        <div className="meta-item">
                            <Calendar size={14} className="text-blue" />
                            <span>
                                {new Date(event.event_date).toLocaleDateString('en-GB')}
                                {isMultiDay && ` - ${new Date(event.end_date).toLocaleDateString('en-GB')}`}
                            </span>
                        </div>
                        <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                        <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
                    </div>
                </div>
                <div className="event-actions" style={{ flexShrink: 0 }}>
                    <div className="tooltip-wrap">
                        <button onClick={() => onPreview(event)} className="btn-icon preview"><ClosedEyeIcon size={20} /></button>
                        <span className="tooltip-text">Preview</span>
                    </div>
                </div>
            </div>
            
            {isMultiDay && (
                <div style={{ width: '100%' }}>
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
                        className="btn-secondary" 
                        style={{ width: '100%', justifyContent: 'center', gap: 6, fontSize: 13, padding: '8px 12px', background: 'var(--bg-muted)', border: '1px dashed var(--border)', borderRadius: 8 }}
                    >
                        {expanded ? '▲ Hide Daily Schedule' : `▼ Show Daily Schedule (${days.length} Days)`}
                    </button>
                    
                    {expanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingLeft: 12, borderLeft: '3px solid var(--blue)' }}>
                            {days.map(d => (
                                <div key={d.dayNumber} className="sub-event-card" style={{
                                    background: 'var(--bg-muted)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 16
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Day {d.dayNumber}: {d.formattedDate}</span>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                                            <span>🕐 {formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                                            <span>📍 {event.venue}</span>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        className="btn-icon" 
                                        style={{ padding: 4, height: 26, width: 26, flexShrink: 0 }} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPreview({
                                                ...event,
                                                title: `${event.title} : Day ${d.dayNumber}`,
                                                event_date: d.dateStr
                                            });
                                        }}
                                    >
                                        <ClosedEyeIcon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const UserDashboard = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [search, setSearch] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 5;
    
    const [viewMode, setViewMode] = useState('list');
    const [calendarView, setCalendarView] = useState('month');
    const [calendarDate, setCalendarDate] = useState(new Date());

    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const navigate = useNavigate();

    const userEmail = getAuthData('userEmail');
    const userRole = getAuthData('userRole');
    const userName = getAuthData('userName') || 'User';

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setDarkMode(document.documentElement.classList.contains('dark'));
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    useEffect(() => { setPage(1); }, [search, filterDate, filterCategory, activeTab]);

    const fetchEvents = async () => {
        try {
            const res = await axios.get(`/api/events?email=${userEmail}&role=${userRole}`);
            setEvents(res.data);
        } catch (e) {
            console.error("Failed to fetch your specific schedule:", e);
        }
    };

    // RSVP removed

    useEffect(() => {
        if (userEmail) fetchEvents();
        else navigate('/');
    }, [userEmail]);

    return (
        <div className="dashboard-container">
            <style>{`
              .rbc-off-range-bg { background-color: #e5e7eb !important; }
              html.dark .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range { color: #9ca3af !important; opacity: 0.8 !important; }
            `}</style>
            {previewEvent && <PreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} />}
            <div className="dashboard-wrapper">
                <h2 style={{ margin: '10px 0 20px 0', fontSize: 24 }}>Welcome, {userName}</h2>

                <div className="main-content" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="list-container">
                        <div className="floating-card">
                            {/* Header: title + tab buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                                    <Calendar size={24} color="#2563eb" />
                                    Events
                                </h2>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${darkMode ? '#30363d' : '#d0d7de'}` }}>
                                        <button onClick={() => setViewMode('list')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: viewMode === 'list' ? (darkMode ? '#388bfd' : '#0969da') : (darkMode ? '#21262d' : '#f6f8fa'), color: viewMode === 'list' ? '#fff' : (darkMode ? '#8b949e' : '#656d76') }}>
                                            <LayoutList size={15} /> List
                                        </button>
                                        <button onClick={() => setViewMode('calendar')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: viewMode === 'calendar' ? (darkMode ? '#388bfd' : '#0969da') : (darkMode ? '#21262d' : '#f6f8fa'), color: viewMode === 'calendar' ? '#fff' : (darkMode ? '#8b949e' : '#656d76') }}>
                                            <CalendarDays size={15} /> Calendar
                                        </button>
                                    </div>
                                    <button onClick={() => setActiveTab('upcoming')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'upcoming' ? { background: darkMode ? '#1e3a5f' : '#eff6ff', color: darkMode ? '#93c5fd' : '#2563eb', borderColor: darkMode ? '#3b82f6' : '#bfdbfe' } : {}) }}>Upcoming</button>
                                    <button onClick={() => setActiveTab('live')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'live' ? { background: darkMode ? '#14532d' : '#dcfce7', color: darkMode ? '#86efac' : '#16a34a', borderColor: darkMode ? '#22c55e' : '#bbf7d0' } : { color: darkMode ? '#86efac' : '#16a34a', borderColor: darkMode ? '#22c55e' : '#bbf7d0' }) }}>Live</button>
                                    <button onClick={() => setActiveTab('past')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'past' ? { background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#94a3b8' : '#475569', borderColor: darkMode ? '#475569' : '#cbd5e1' } : {}) }}>Past</button>
                                </div>
                            </div>

                            {/* Search & Filter */}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
                                    <input className="custom-input" style={{ paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10, height: 42 }} placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
                                </div>
                                {viewMode !== 'calendar' && (
                                <div style={{ position: 'relative', flexShrink: 0, width: 160 }}>
                                    <input type="date" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} id="filter-date-input" />
                                    <button type="button" className="btn-secondary" onClick={() => document.getElementById('filter-date-input').showPicker()} style={{ gap: 8, whiteSpace: 'nowrap', width: '100%', justifyContent: 'center', height: 42, boxSizing: 'border-box' }}>
                                        <Calendar size={15} />
                                        {filterDate ? new Date(filterDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Filter by Date'}
                                    </button>
                                </div>
                                )}
                                <select className="custom-input" style={{ width: 180, height: 42, paddingTop: 0, paddingBottom: 0 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                    <option value="">All Categories</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {(search || filterDate || filterCategory) && (
                                    <button className="btn-secondary" onClick={() => { setSearch(''); setFilterDate(''); setFilterCategory(''); }}>Clear</button>
                                )}
                            </div>

                            {/* Event list / Calendar */}
                            {viewMode === 'calendar' ? (
                                <div style={{ height: 600 }}>
                                    <BigCalendar
                                        localizer={localizer}
                                        events={toCalendarEvents(unrollEvents(events).filter(e => {
                                            const date = e.event_date.slice(0, 10);
                                            const [sH, sM] = e.start_time.split(':');
                                            const [eH, eM] = e.end_time.split(':');
                                            const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
                                            const end = new Date(date); end.setHours(+eH, +eM, 0, 0);
                                            const now = new Date();
                                            const tabMatch = activeTab === 'upcoming' ? now < start : activeTab === 'live' ? now >= start && now <= end : end < now;
                                            const searchMatch = !search || e.title.toLowerCase().startsWith(search.toLowerCase());
                                            const dateMatch = !filterDate || date === filterDate;
                                            const catMatch = !filterCategory || (e.category || 'General').toLowerCase() === filterCategory.toLowerCase();
                                            return tabMatch && searchMatch && dateMatch && catMatch;
                                        }))}
                                        startAccessor="start"
                                        endAccessor="end"
                                        view={calendarView}
                                        onView={setCalendarView}
                                        date={calendarDate}
                                        onNavigate={setCalendarDate}
                                        onSelectEvent={(e) => setPreviewEvent(e.resource)}
                                        eventPropGetter={(e) => {
                                            const rawCat = e.resource?.category || 'General';
                                            const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
                                            const c = CATEGORY_COLORS[cat];
                                            return { style: { backgroundColor: c?.color || '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 } };
                                        }}
                                        components={{ toolbar: (props) => <CustomCalendarToolbar {...props} setCalendarDate={setCalendarDate} /> }}
                                        style={{ height: '100%' }}
                                    />
                                </div>
                            ) : (
                                <div className="schedule-list">
                                {(() => {
                                    const now = new Date();
                                    const filtered = groupMultiDaySpans(events).filter(e => {
                                        const date = e.event_date.slice(0, 10);
                                        const endDate = e.end_date ? e.end_date.slice(0, 10) : date;
                                        const [sH, sM] = e.start_time.split(':');
                                        const [eH, eM] = e.end_time.split(':');
                                        const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
                                        const end   = new Date(endDate); end.setHours(+eH, +eM, 0, 0);
                                        const tabMatch = activeTab === 'upcoming' ? now < start : activeTab === 'live' ? now >= start && now <= end : end < now;
                                        const searchMatch = !search || e.title.toLowerCase().startsWith(search.toLowerCase());
                                        const dateMatch = !filterDate || (filterDate >= date && filterDate <= endDate);
                                        const catMatch = !filterCategory || (e.category || 'General').toLowerCase() === filterCategory.toLowerCase();
                                        return tabMatch && searchMatch && dateMatch && catMatch;
                                    }).sort((a, b) => {
                                        const dateA = a.event_date.slice(0, 10);
                                        const endDateA = a.end_date ? a.end_date.slice(0, 10) : dateA;
                                        const [sHa, sMa] = a.start_time.split(':');
                                        const [eHa, eMa] = a.end_time.split(':');
                                        const startA = new Date(dateA); startA.setHours(+sHa, +sMa, 0, 0);
                                        const endA = new Date(endDateA); endA.setHours(+eHa, +eMa, 0, 0);

                                        const dateB = b.event_date.slice(0, 10);
                                        const endDateB = b.end_date ? b.end_date.slice(0, 10) : dateB;
                                        const [sHb, sMb] = b.start_time.split(':');
                                        const [eHb, eMb] = b.end_time.split(':');
                                        const startB = new Date(dateB); startB.setHours(+sHb, +sMb, 0, 0);
                                        const endB = new Date(endDateB); endB.setHours(+eHb, +eMb, 0, 0);

                                        if (activeTab === 'upcoming') return startA - startB;
                                        if (activeTab === 'live') return endA - endB;
                                        return startB - startA;
                                    });

                                    if (filtered.length === 0)
                                        return <div className="empty-state-card">No {activeTab} events found.</div>;

                                    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                                    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

                                    return (
                                        <>
                                            {paginated.map(item => (
                                                <UserEventCard key={item._listKey || item.event_id || item.id} event={item} onPreview={setPreviewEvent} tab={activeTab} />
                                            ))}
                                            {totalPages > 1 && (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                                                    <button className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} /></button>
                                                    {Array.from({ length: totalPages }, (_, i) => (
                                                        <button key={i} className="btn-secondary" style={{ padding: '6px 12px', ...(page === i + 1 ? { background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' } : {}) }} onClick={() => setPage(i + 1)}>{i + 1}</button>
                                                    ))}
                                                    <button className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={16} /></button>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;