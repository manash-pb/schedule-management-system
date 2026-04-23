import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, MapPin, X, ArrowLeft } from 'lucide-react';
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

const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${String(h % 12 || 12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
};

const isPast = (event) => {
    const now = new Date();
    const eventDate = event.event_date.slice(0,10);
    const [endH, endM] = event.end_time.split(':');
    
    const end = new Date(eventDate);
    end.setHours(endH, endM, 0, 0);
    
    console.log('🔍 isPast Debug:', {
        eventTitle: event.title,
        eventDate: eventDate,
        end_time: event.end_time,
        endObj: end.toString(),
        endMs: end.getTime(),
        nowObj: now.toString(),
        nowMs: now.getTime(),
        result: end < now
    });
    
    return end < now;
};

const PreviewModal = ({ event, onClose, isAdmin, onDownload }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <div>
                    <span className="status-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Past</span>
                    <h2 className="event-title" style={{ marginBottom: 4 }}>{event.title}</h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isAdmin && onDownload && (
                        <div className="tooltip-wrap">
                            <button className="btn-icon excel" onClick={() => onDownload(event)}><span style={{fontSize:18}}>⬇</span></button>
                            <span className="tooltip-text">Download Excel</span>
                        </div>
                    )}
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>
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
            {isAdmin && (event.attendees || []).length > 0 && (
                <div className="modal-attendees">
                    <p className="modal-attendees-title">Attendees ({event.attendees.length})</p>
                    <div className="modal-attendees-list">
                        {event.attendees.map((a, i) => (
                            <div key={i} className="modal-attendee-row">
                                <div className="attendee-avatar">{a.name?.[0]?.toUpperCase() || '?'}</div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>{a.email}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
);

const PastEvents = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const navigate = useNavigate();
    const role  = localStorage.getItem('userRole');
    const email = localStorage.getItem('userEmail');
    const isAdmin = role === 'admin';

    useEffect(() => {
        const params = isAdmin ? { role: 'admin' } : { role, email };
        axios.get('/api/events', { params })
            .then(res => setEvents(res.data.filter(isPast)))
            .catch(console.error);
    }, []);

    const backPath = isAdmin ? '/admin-dashboard' : '/user-dashboard';

    return (
        <div className="dashboard-container">
            {previewEvent && <PreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} isAdmin={isAdmin} />}
            <div className="dashboard-wrapper">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', marginBottom: '10px' }}>
                    <button onClick={() => navigate(backPath)} className="btn-secondary"><ArrowLeft size={16} /> Back</button>
                    <h2 style={{ margin: 0, color: '#64748b' }}>Past Events</h2>
                    <div style={{ width: 80 }} />
                </div>
                <div className="schedule-list">
                    {events.length === 0 ? (
                        <div className="empty-state-card">No past events found.</div>
                    ) : (
                        events
                            .sort((a, b) => {
                                const dateA = new Date(a.event_date + 'T' + a.start_time);
                                const dateB = new Date(b.event_date + 'T' + b.start_time);
                                return dateB - dateA;
                            })
                            .map(event => (
                            <div className="event-card" key={event.event_id} style={{ opacity: 0.75 }}>
                                <div className="event-info">
                                    <span className="status-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Past</span>
                                    <h3 className="event-title">{event.title}</h3>
                                    <div className="event-meta">
                                        <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString()}</span></div>
                                        <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                                        <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
                                    </div>
                                </div>
                                <div className="event-actions">
                                    <div className="tooltip-wrap">
                                        <button onClick={() => setPreviewEvent(event)} className="btn-icon preview"><ClosedEyeIcon size={20} /></button>
                                        <span className="tooltip-text">Preview</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PastEvents;
