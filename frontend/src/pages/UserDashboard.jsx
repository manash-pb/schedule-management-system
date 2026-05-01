import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, LogOut, Clock, MapPin, X, Check, XCircle, User, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>{event.description}</p>
                </div>
            )}
        </div>
    </div>
);

const UserDashboard = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const navigate = useNavigate();

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName') || 'User';

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

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    return (
        <div className="dashboard-container">
            {previewEvent && <PreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} />}
            <div className="dashboard-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', width: '100%' }}>
                    <h2 style={{ margin: 0 }}>Welcome, {userName}</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setDarkMode(d => !d)} className="btn-secondary">{darkMode ? <Sun size={16} /> : <Moon size={16} />}{darkMode ? 'Light' : 'Dark'}</button>
                        <button onClick={() => navigate('/profile')} className="btn-secondary"><User size={16} /> Profile</button>
                        <button onClick={handleLogout} className="btn-secondary"><LogOut size={16} /> Logout</button>
                    </div>
                </div>

                <div className="main-content" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="list-container">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0', flexWrap: 'wrap', gap: '10px' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                                <Calendar size={24} color="#2563eb" /> Upcoming Events
                            </h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => navigate('/live-events')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px', color: '#16a34a', borderColor: '#bbf7d0' }}>🔴 Live Events</button>
                                <button onClick={() => navigate('/past-events')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px' }}>Past Events</button>
                            </div>
                        </div>
                        <div className="schedule-list">
                            {events.filter(e => {
                                const eventDate = e.event_date.slice(0,10);
                                const [endH, endM] = e.end_time.split(':');
                                const end = new Date(eventDate);
                                end.setHours(endH, endM, 0, 0);
                                const isUpcoming = end >= new Date();
                                console.log('🔍 UserDashboard Upcoming:', { title: e.title, end: end.toString(), now: new Date().toString(), isUpcoming });
                                return isUpcoming;
                            }).length === 0 ? (
                                <div className="empty-state-card">No upcoming events assigned to you.</div>
                            ) : (
                                events
                                    .filter(e => {
                                        const eventDate = e.event_date.slice(0,10);
                                        const [endH, endM] = e.end_time.split(':');
                                        const end = new Date(eventDate);
                                        end.setHours(endH, endM, 0, 0);
                                        return end >= new Date();
                                    })
                                    .sort((a, b) => {
                                        const dateA = new Date(a.event_date + 'T' + a.start_time);
                                        const dateB = new Date(b.event_date + 'T' + b.start_time);
                                        return dateA - dateB;
                                    })
                                    .map((event) => (
                                        <div className="event-card" key={event.id || event.event_id}>
                                            <div className="event-info">
                                                <span className="status-badge">Confirmed</span>
                                                <h3 className="event-title">{event.title}</h3>
                                                <div className="event-meta">
                                                    <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString()}</span></div>
                                                    <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                                                    <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
                                                </div>
                                            </div>
                                            <div className="event-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <div className="tooltip-wrap">
                                                        <button onClick={() => setPreviewEvent(event)} className="btn-icon preview"><ClosedEyeIcon size={20} /></button>
                                                        <span className="tooltip-text">Preview</span>
                                                    </div>
                                                </div>
                                                {(() => {
                                                    const rsvp = (event.attendees || [])[0]?.rsvp_status || 'pending';
                                                    return (
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button
                                                                onClick={() => handleRsvp(event.event_id, 'accepted')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: rsvp === 'accepted' ? '#dcfce7' : '#f1f5f9', color: rsvp === 'accepted' ? '#16a34a' : '#64748b' }}
                                                            ><Check size={13} /> Accept</button>
                                                            <button
                                                                onClick={() => handleRsvp(event.event_id, 'declined')}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: rsvp === 'declined' ? '#fee2e2' : '#f1f5f9', color: rsvp === 'declined' ? '#dc2626' : '#64748b' }}
                                                            ><XCircle size={13} /> Decline</button>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;