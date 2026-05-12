import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, MapPin, X, Check, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['General', 'Meeting', 'Workshop', 'Holiday', 'Training', 'Social'];
const CATEGORY_COLORS = {
    General:  { bg: '#eff6ff', color: '#2563eb' },
    Meeting:  { bg: '#fef3c7', color: '#d97706' },
    Workshop: { bg: '#f0fdf4', color: '#16a34a' },
    Holiday:  { bg: '#fce7f3', color: '#db2777' },
    Training: { bg: '#f5f3ff', color: '#7c3aed' },
    Social:   { bg: '#fff7ed', color: '#ea580c' },
};

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
                <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString()}</span></div>
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

const UserEventCard = ({ event, onPreview, onRsvp, tab }) => {
    const rsvp = (event.attendees || [])[0]?.rsvp_status || 'pending';
    
    return (
        <div className="event-card">
            <div className="event-info">
                <span className="status-badge" style={tab === 'past' ? { background: '#f1f5f9', color: '#64748b' } : tab === 'live' ? { background: '#dcfce7', color: '#16a34a' } : {}}>
                    {tab === 'past' ? 'Past' : tab === 'live' ? '🔴 Live' : 'Confirmed'}
                </span>
                {event.category && (
                    <span className="category-badge" style={{ background: CATEGORY_COLORS[event.category]?.bg || '#f1f5f9', color: CATEGORY_COLORS[event.category]?.color || '#64748b' }}>
                        {event.category}
                    </span>
                )}
                <h3 className="event-title">{event.title}</h3>
                <div className="event-meta">
                    <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString()}</span></div>
                    <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                    <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
                </div>
            </div>
            <div className="event-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div className="tooltip-wrap">
                    <button onClick={() => onPreview(event)} className="btn-icon preview"><ClosedEyeIcon size={20} /></button>
                    <span className="tooltip-text">Preview</span>
                </div>
                {tab === 'upcoming' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={() => onRsvp(event.event_id, 'accepted')}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: rsvp === 'accepted' ? '#dcfce7' : '#f1f5f9', color: rsvp === 'accepted' ? '#16a34a' : '#64748b' }}
                        ><Check size={13} /> Accept</button>
                        <button
                            onClick={() => onRsvp(event.event_id, 'declined')}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: rsvp === 'declined' ? '#fee2e2' : '#f1f5f9', color: rsvp === 'declined' ? '#dc2626' : '#64748b' }}
                        ><XCircle size={13} /> Decline</button>
                    </div>
                )}
            </div>
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
    
    const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
    const navigate = useNavigate();

    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName') || 'User';

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

    const handleRsvp = async (eventId, status) => {
        try {
            await axios.patch(`/api/events/${eventId}/rsvp`, { email: userEmail, status });
            fetchEvents();
        } catch (e) {
            console.error('RSVP failed:', e);
        }
    };

    useEffect(() => {
        if (userEmail) fetchEvents();
        else navigate('/');
    }, [userEmail]);

    return (
        <div className="dashboard-container">
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
                                    {activeTab === 'upcoming' ? 'Upcoming Events' : activeTab === 'live' ? 'Live Events' : 'Past Events'}
                                </h2>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                                <div style={{ position: 'relative', flexShrink: 0, width: 160 }}>
                                    <input type="date" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '100%', height: '100%', top: 0, left: 0 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} id="filter-date-input" />
                                    <button type="button" className="btn-secondary" onClick={() => document.getElementById('filter-date-input').showPicker()} style={{ gap: 8, whiteSpace: 'nowrap', width: '100%', justifyContent: 'center', height: 42, boxSizing: 'border-box' }}>
                                        <Calendar size={15} />
                                        {filterDate ? new Date(filterDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Filter by Date'}
                                    </button>
                                </div>
                                <select className="custom-input" style={{ width: 180, height: 42, paddingTop: 0, paddingBottom: 0 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                    <option value="">All Categories</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {(search || filterDate || filterCategory) && (
                                    <button className="btn-secondary" onClick={() => { setSearch(''); setFilterDate(''); setFilterCategory(''); }}>Clear</button>
                                )}
                            </div>

                            {/* Event list */}
                            <div className="schedule-list">
                                {(() => {
                                    const now = new Date();
                                    const filtered = events.filter(e => {
                                        const date = e.event_date.slice(0, 10);
                                        const [sH, sM] = e.start_time.split(':');
                                        const [eH, eM] = e.end_time.split(':');
                                        const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
                                        const end   = new Date(date); end.setHours(+eH, +eM, 0, 0);
                                        const tabMatch = activeTab === 'upcoming' ? now < start : activeTab === 'live' ? now >= start && now <= end : end < now;
                                        const searchMatch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || (e.venue || '').toLowerCase().includes(search.toLowerCase());
                                        const dateMatch = !filterDate || date === filterDate;
                                        const catMatch = !filterCategory || e.category === filterCategory;
                                        return tabMatch && searchMatch && dateMatch && catMatch;
                                    });

                                    if (filtered.length === 0)
                                        return <div className="empty-state-card">No {activeTab} events found.</div>;

                                    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                                    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

                                    return (
                                        <>
                                            {paginated.map(item => (
                                                <UserEventCard key={item.event_id || item.id} event={item} onPreview={setPreviewEvent} onRsvp={handleRsvp} tab={activeTab} />
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;