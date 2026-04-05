import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Calendar, Trash2, PlusCircle, UserPlus, X, Download, LogOut, Clock, MapPin } from 'lucide-react';

const ClosedEyeIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 8 Q12 16 20 8" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/>
    <line x1="7.5" y1="11.5" x2="6.5" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="10.5" y1="13" x2="10" y2="15.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="13.5" y1="13" x2="14" y2="15.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="16.5" y1="11.5" x2="17.5" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
import { useNavigate } from 'react-router-dom';

const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
};

const PreviewModal = ({ event, onClose, onDownload }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <div>
                    <span className="status-badge">Confirmed</span>
                    <h2 className="event-title" style={{ marginBottom: 4 }}>{event.title}</h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="tooltip-wrap">
                        <button className="btn-icon excel" onClick={() => onDownload(event)}>
                            <Download size={20} />
                        </button>
                        <span className="tooltip-text">Download Excel</span>
                    </div>
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

            <div className="modal-attendees">
                <p className="modal-attendees-title">Attendees ({(event.attendees || []).length})</p>
                {(event.attendees || []).length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>No attendees added.</p>
                ) : (
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
                )}
            </div>
        </div>
    </div>
);

const EventCard = ({ event, onDelete, onPreview }) => (
    <div className="event-card">
        <div className="event-info">
            <span className="status-badge">Confirmed</span>
            <h3 className="event-title">{event.title}</h3>
            <div className="event-meta">
                <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString()}</span></div>
                <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
            </div>
        </div>
        <div className="event-actions">
            <div className="tooltip-wrap">
                <button onClick={() => onPreview(event)} className="btn-icon preview"><ClosedEyeIcon size={20} /></button>
                <span className="tooltip-text">Preview</span>
            </div>
            <div className="tooltip-wrap">
                <button onClick={() => onDelete(event.event_id)} className="btn-icon delete"><Trash2 size={20} /></button>
                <span className="tooltip-text">Delete</span>
            </div>
        </div>
    </div>
);

const CustomTimeInput = ({ value, onChange }) => {
  const parseTime = (val) => {
    if (!val) return { h: 12, m: 0, p: 'AM' };
    let [h, m] = val.split(':').map(Number);
    const p = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { h, m, p };
  };

  const { h, m, p } = parseTime(value);
  // Local state to allow empty strings while typing
  const [displayH, setDisplayH] = useState(String(h).padStart(2, '0'));
  const [displayM, setDisplayM] = useState(String(m).padStart(2, '0'));

  // Sync local state when external value changes (like arrow clicks)
  useEffect(() => {
    setDisplayH(String(h).padStart(2, '0'));
    setDisplayM(String(m).padStart(2, '0'));
  }, [h, m]);

  const update = (newH, newM, newP) => {
    let finalH = newP === 'PM' ? (newH % 12) + 12 : newH % 12;
    const timeStr = `${String(finalH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    onChange(timeStr);
  };

  const handleArrow = (type, direction) => {
    if (type === 'h') update(direction === 'up' ? (h === 12 ? 1 : h + 1) : (h === 1 ? 12 : h - 1), m, p);
    else if (type === 'm') update(h, direction === 'up' ? (m === 59 ? 0 : m + 1) : (m === 0 ? 59 : m - 1), p);
    else if (type === 'p') update(h, m, p === 'AM' ? 'PM' : 'AM');
  };

  // 1. Allow user to type ANYTHING (including backspace/empty)
  const onTextChange = (type, val) => {
    if (val === '' || /^\d+$/.test(val)) {
      if (type === 'h') setDisplayH(val);
      else setDisplayM(val);
    }
  };

  // 2. Validate ONLY when user clicks away or finishes (Blur)
  const onBlurValidation = (type) => {
    if (type === 'h') {
      let num = parseInt(displayH) || 12;
      let validH = Math.min(12, Math.max(1, num));
      update(validH, m, p);
    } else {
      let num = parseInt(displayM) || 0;
      let validM = Math.min(59, Math.max(0, num));
      update(h, validM, p);
    }
  };

  const InputField = ({ type, label, displayVal }) => (
    <div className="time-column">
        <button type="button" onClick={() => handleArrow(type, 'up')} className="arrow-btn">▲</button>
        <input
        type="text"
        className="time-type-input"
        value={displayVal}
        onChange={(e) => onTextChange(type, e.target.value)}
        onBlur={() => onBlurValidation(type)}
        onFocus={(e) => e.target.select()}
        placeholder="00"
        />
        <button type="button" onClick={() => handleArrow(type, 'down')} className="arrow-btn">▼</button>
        <span className="input-label-sm">{label}</span>
    </div>
);

  return (
    <div className="hybrid-time-picker">
      <InputField type="h" label="HRS" displayVal={displayH} />
      <span className="time-separator">:</span>
      <InputField type="m" label="MIN" displayVal={displayM} />
      <div className="time-column">
        <button type="button" onClick={() => handleArrow('p', 'up')} className="arrow-btn">▲</button>
        <div className="time-type-input ampm" onClick={() => handleArrow('p', 'up')}>{p}</div>
        <button type="button" onClick={() => handleArrow('p', 'down')} className="arrow-btn">▼</button>
        <span className="input-label-sm">AM/PM</span>
      </div>
    </div>
  );
};

// ... then your Dashboard component starts below ...

const AdminDashboard = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const [formData, setFormData] = useState({ title: '', description: '', venue: '', event_date: '', start_time: '', end_time: '' });
    const [attendees, setAttendees] = useState([]);
    const [currentAttendee, setCurrentAttendee] = useState({ name: '', email: '' });
    const navigate = useNavigate();

    const fetchEvents = async () => {
        try {
            const res = await axios.get('/api/events', { params: { role: 'admin' } });
            setEvents(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchEvents(); }, []);

    const handleLogout = () => {
        localStorage.removeItem('isAdminLoggedIn');
        navigate('/');
    };

    const handleDelete = async (id) => {
        console.log("Attempting to delete event with ID:", id);

        if (!id) {
            alert("Error: Event ID is undefined. Check your MySQL column names!");
            return; 
        }

        if (window.confirm("Delete this event?")) {
            try {
                await axios.delete(`/api/events/${id}`);
                fetchEvents();
            } catch (e) { 
                console.error("Delete Error:", e);
                alert("Delete failed on the server. Check backend console."); 
            }
        }
    };

    const handleDownload = (event) => {
        const ws = XLSX.utils.json_to_sheet(event.attendees || []);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendees");
        XLSX.writeFile(wb, `${event.title}_Attendees.xlsx`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/events', { ...formData, attendees });
            alert('Event scheduled!');
            setFormData({ title: '', description: '', venue: '', event_date: '', start_time: '', end_time: '' });
            setAttendees([]);
            fetchEvents();
        } catch (e) { alert('Failed to schedule.'); }
    };

    const handleAddAttendee = () => {
        if (currentAttendee.email.trim() !== "" && currentAttendee.name.trim() !== "") {
            setAttendees([...attendees, currentAttendee]);
            setCurrentAttendee({ name: '', email: '' });
        } else {
            alert("Please enter both Name and Email.");
        }
    };

    return (
        <div className="dashboard-container">
            {previewEvent && <PreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} onDownload={handleDownload} />}
            <div className="dashboard-wrapper">
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0', marginBottom: '5px', width: '100%' }}>
                    <button onClick={handleLogout} className="btn-secondary"><LogOut size={16} /> Logout</button>
                </div>

                <div className="main-content">
                    <div className="form-container">
                        <div className="floating-card">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}><PlusCircle color="#2563eb" />Create Event</h2>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input type="text" placeholder="Event Title" className="custom-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                                    <textarea placeholder="Add a brief description..." className="custom-input" style={{ minHeight: '90px', resize: 'none' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>

                                <input type="text" placeholder="Venue or Meeting Link" className="custom-input" value={formData.venue} onChange={e => setFormData({ ...formData, venue: e.target.value })} required />
                                <input type="date" className="custom-input" value={formData.event_date} onChange={e => setFormData({ ...formData, event_date: e.target.value })} required />

                                <div className="time-row">
                                    <div className="time-field">
                                        <label className="input-label">Start Time</label>
                                        <CustomTimeInput
                                            value={formData.start_time}
                                            onChange={(value) => setFormData(prev => ({ ...prev, start_time: value }))}
                                        />
                                    </div>
                                    <span className="time-row-divider">→</span>
                                    <div className="time-field">
                                        <label className="input-label">End Time</label>
                                        <CustomTimeInput
                                            value={formData.end_time}
                                            onChange={(value) => setFormData(prev => ({ ...prev, end_time: value }))}
                                        />
                                    </div>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '5px 0' }} />

                                <div className="attendee-logic">
                                    <label style={{ fontWeight: '600', fontSize: '13px', color: '#475569', display: 'block', marginBottom: '8px' }}>Invite Guests</label>
                                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                        <div className="attendee-input-row">
                                            <input type="text" placeholder="Guest Name" className="custom-input" style={{ flex: 1 }} value={currentAttendee.name} onChange={e => setCurrentAttendee({ ...currentAttendee, name: e.target.value })} />
                                            <input type="email" placeholder="Guest Email" className="custom-input" style={{ flex: 1 }} value={currentAttendee.email} onChange={e => setCurrentAttendee({ ...currentAttendee, email: e.target.value })} />
                                            <button type="button" className="btn-secondary" onClick={handleAddAttendee}><UserPlus size={18} /></button>
                                        </div>
                                    </div>

                                    {attendees.length > 0 && (
                                        <div style={{ marginTop: '10px', maxHeight: '100px', overflowY: 'auto', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            {attendees.map((p, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                                                    <span style={{ color: '#64748b' }}>{p.name} ({p.email})</span>
                                                    <X size={14} onClick={() => setAttendees(attendees.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer', color: '#ef4444' }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className="btn-primary">Schedule & Send Invites</button>
                            </form>
                        </div>
                    </div>

                    <div className="list-container">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 24px 0' }}><Calendar size={24} color="#2563eb" /> Upcoming Schedule</h2>
                        <div className="schedule-list">
                            {events.length === 0 ? (
                                <div className="empty-state-card">No meetings scheduled yet...</div>
                            ) : (
                                events.map((item) => (
                                    <EventCard 
                                        key={item.event_id} 
                                        event={item} 
                                        onDelete={handleDelete}
                                        onPreview={setPreviewEvent}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;