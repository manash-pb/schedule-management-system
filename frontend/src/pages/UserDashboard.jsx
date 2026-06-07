import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, MapPin, X, Check, XCircle, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutList, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthData } from '../utils/authStorage';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

// Extracted Components & Utils
import { CATEGORIES, CATEGORY_COLORS } from '../utils/constants';
import { unrollEvents, toCalendarEvents, groupMultiDaySpans } from '../utils/eventUtils';
import CustomCalendarToolbar from '../components/CustomCalendarToolbar';
import CategoryDropdown from '../components/CategoryDropdown';
import UserPreviewModal from '../components/UserPreviewModal';
import UserEventCard from '../components/UserEventCard';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const UserDashboard = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('userActiveTab') || 'upcoming');
    const [search, setSearch] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 5;
    const [openPicker, setOpenPicker] = useState(null);
    
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('userViewMode') || 'list');
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

    useEffect(() => {
        localStorage.setItem('userActiveTab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('userViewMode', viewMode);
    }, [viewMode]);

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
        if (userEmail) {
            fetchEvents();
            const socket = io('http://localhost:3000', { withCredentials: true });
            socket.on('calendar_events_updated', (data) => {
                fetchEvents();
                if (data) {
                    const userEmailLower = userEmail.toLowerCase().trim();
                    if (data.action === 'created' && data.attendees && data.attendees.includes(userEmailLower)) {
                        toast.success(`You've been invited to a new event: ${data.title}`);
                    } else if (data.action === 'added_attendee' && data.email === userEmailLower) {
                        toast.success(`You've been added to an event: ${data.title || 'Check your calendar!'}`);
                    } else if (data.action === 'removed_attendee' && data.email === userEmailLower) {
                        toast.error(`You were removed from an event.`);
                    }
                }
            });
            return () => socket.disconnect();
        } else {
            navigate('/');
        }
    }, [userEmail]);

    return (
        <div className="dashboard-container">
            <Toaster position="top-center" />
            <style>{`
              .rbc-off-range-bg { background-color: #e5e7eb !important; }
              html.dark .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range { color: #9ca3af !important; opacity: 0.8 !important; }
            `}</style>
            {previewEvent && <UserPreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} />}
            <div className="dashboard-wrapper" style={{ maxWidth: '1000px', width: '100%' }}>
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
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'nowrap' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: 150 }}>
                                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
                                    <input className="custom-input" style={{ paddingLeft: 36, paddingRight: search ? 40 : 12, paddingTop: 10, paddingBottom: 10, height: 42, width: '100%', boxSizing: 'border-box' }} placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
                                    {search && (
                                        <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 10, pointerEvents: 'auto' }} onMouseEnter={(e) => e.currentTarget.style.color = '#cbd5e1'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                                            <X size={18} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                                {viewMode !== 'calendar' && activeTab !== 'live' && (
                                    <div style={{ position: 'relative', flexShrink: 0, width: 140 }}>
                                        <DateInput
                                            key={`filter-${filterDate ? 'filled' : 'empty'}`}
                                            placeholder="Filter by Date"
                                            valueFormat="DD-MM-YYYY"
                                            weekendDays={[0]}
                                            minDate={activeTab === 'upcoming' ? new Date() : undefined}
                                            maxDate={activeTab === 'past' ? new Date() : undefined}
                                            rightSection={
                                                filterDate ? (
                                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); setFilterDate(''); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px' }}>
                                                        <X size={16} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                                                    </div>
                                                ) : (
                                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); setOpenPicker(prev => prev === 'filter' ? null : 'filter'); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px' }}>
                                                        <Calendar size={18} className="text-gray-400" />
                                                    </div>
                                                )
                                            }
                                            rightSectionPointerEvents="auto"
                                            popoverProps={{
                                                opened: openPicker === 'filter',
                                                onChange: (opened) => { if (!opened) setOpenPicker(null); }
                                            }}
                                            dateParser={(input) => {
                                                const parsed = dayjs(input, ['DD-MM-YYYY', 'DD/MM/YYYY', 'DD.MM.YYYY', 'DD-MM-YY'], true);
                                                return parsed.isValid() ? parsed.toDate() : new Date(NaN);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = e.currentTarget.value;
                                                    if (val) {
                                                        const parsed = dayjs(val, ['DD-MM-YYYY', 'DD/MM/YYYY', 'DD.MM.YYYY', 'DD-MM-YY'], true);
                                                        if (!parsed.isValid()) {
                                                            toast.error('Invalid date format. Please use DD-MM-YYYY');
                                                            e.preventDefault();
                                                        } else {
                                                            e.currentTarget.blur();
                                                        }
                                                    }
                                                }
                                            }}
                                            value={filterDate ? dayjs(filterDate).toDate() : null}
                                            onChange={(date) => {
                                                setFilterDate(date ? dayjs(date).format('YYYY-MM-DD') : '');
                                                setOpenPicker(null);
                                            }}
                                            classNames={{ input: "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm" }}
                                            styles={{ input: { height: 42 } }}
                                        />
                                    </div>
                                )}
                                <div style={{ position: 'relative', flexShrink: 0, width: 150 }}>
                                    <CategoryDropdown value={filterCategory} onChange={setFilterCategory} isFilter={true} />
                                </div>
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
                                            
                                            const now = new Date();
                                            const isPast = now > e.end;
                                            const isLive = now >= e.start && now <= e.end;
                                            
                                            let className = '';
                                            if (isLive) className = 'event-live';

                                            return { className, style: { backgroundColor: c?.color || '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 } };
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