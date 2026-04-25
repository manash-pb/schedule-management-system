import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Calendar, Trash2, PlusCircle, UserPlus, X, Download, FileSpreadsheet, LogOut, Clock, MapPin, AlertTriangle } from 'lucide-react';

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

const EventCard = ({ event, onDelete, onPreview, tab }) => (
    <div className="event-card">
        <div className="event-info">
            <span className="status-badge" style={tab === 'past' ? { background: '#f1f5f9', color: '#64748b' } : tab === 'live' ? { background: '#dcfce7', color: '#16a34a' } : {}}>
                {tab === 'past' ? 'Past' : tab === 'live' ? '🔴 Live' : 'Confirmed'}
            </span>
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
            {onDelete && (
                <div className="tooltip-wrap">
                    <button onClick={() => onDelete(event.event_id)} className="btn-icon delete"><Trash2 size={20} /></button>
                    <span className="tooltip-text">Delete</span>
                </div>
            )}
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
  const [displayH, setDisplayH] = useState(String(h).padStart(2, '0'));
  const [displayM, setDisplayM] = useState(String(m).padStart(2, '0'));
  const mRef = useRef(null);
  const ampmRef = useRef(null);

  useEffect(() => {
    setDisplayH(String(h).padStart(2, '0'));
    setDisplayM(String(m).padStart(2, '0'));
  }, [h, m]);

  const update = (newH, newM, newP) => {
    let finalH = newP === 'PM' ? (newH % 12) + 12 : newH % 12;
    onChange(`${String(finalH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  const handleArrow = (type, direction) => {
    if (type === 'h') update(direction === 'up' ? (h === 12 ? 1 : h + 1) : (h === 1 ? 12 : h - 1), m, p);
    else if (type === 'm') update(h, direction === 'up' ? (m === 59 ? 0 : m + 1) : (m === 0 ? 59 : m - 1), p);
    else if (type === 'p') update(h, m, p === 'AM' ? 'PM' : 'AM');
  };

  const commitH = (raw) => {
    let num = parseInt(raw);
    if (isNaN(num) || num < 1) num = 1;
    if (num > 12) num = 12;
    setDisplayH(String(num).padStart(2, '0'));
    update(num, m, p);
  };

  const commitM = (raw) => {
    let num = parseInt(raw);
    if (isNaN(num)) num = 0;
    if (num > 59) num = 59;
    setDisplayM(String(num).padStart(2, '0'));
    update(h, num, p);
  };

  const handleHInput = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-2);
    setDisplayH(raw);
    // auto-advance: 2 digits entered, or first digit > 1 (can't be valid start of 12-hr hour)
    if (raw.length === 2 || (raw.length === 1 && parseInt(raw) > 1)) {
      let num = parseInt(raw);
      if (isNaN(num) || num < 1) num = 1;
      if (num > 12) num = 12;
      update(num, m, p);
      mRef.current?.focus();
      mRef.current?.select();
    }
  };

  const handleMInput = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-2);
    setDisplayM(raw);
    // auto-advance: 2 digits, or first digit > 5 (minutes max is 59)
    if (raw.length === 2 || (raw.length === 1 && parseInt(raw) > 5)) {
      let num = parseInt(raw);
      if (isNaN(num)) num = 0;
      if (num > 59) num = 59;
      update(h, num, p);
      ampmRef.current?.focus();
    }
  };

  return (
    <div className="hybrid-time-picker">
      <div className="time-column">
        <button type="button" onClick={() => handleArrow('h', 'down')} className="arrow-btn">▲</button>
        <input
          type="text"
          className="time-type-input"
          value={displayH}
          inputMode="numeric"
          maxLength={2}
          style={{ caretColor: 'currentColor' }}
          onFocus={e => e.target.select()}
          onChange={handleHInput}
          onBlur={(e) => commitH(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowUp')   { e.preventDefault(); handleArrow('h', 'down'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); handleArrow('h', 'up'); }
          }}
        />
        <button type="button" onClick={() => handleArrow('h', 'up')} className="arrow-btn">▼</button>
        <span className="input-label-sm">HRS</span>
      </div>

      <span className="time-separator">:</span>

      <div className="time-column">
        <button type="button" onClick={() => handleArrow('m', 'down')} className="arrow-btn">▲</button>
        <input
          ref={mRef}
          type="text"
          className="time-type-input"
          value={displayM}
          inputMode="numeric"
          maxLength={2}
          style={{ caretColor: 'currentColor' }}
          onFocus={e => e.target.select()}
          onChange={handleMInput}
          onBlur={(e) => commitM(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowUp')   { e.preventDefault(); handleArrow('m', 'down'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); handleArrow('m', 'up'); }
          }}
        />
        <button type="button" onClick={() => handleArrow('m', 'up')} className="arrow-btn">▼</button>
        <span className="input-label-sm">MIN</span>
      </div>

      <div className="time-column">
        <button type="button" onClick={() => handleArrow('p', 'down')} className="arrow-btn">▲</button>
        <div
          ref={ampmRef}
          className="time-type-input ampm"
          tabIndex={0}
          onClick={() => handleArrow('p', 'down')}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') handleArrow('p', 'down'); }}
        >{p}</div>
        <button type="button" onClick={() => handleArrow('p', 'up')} className="arrow-btn">▼</button>
        <span className="input-label-sm">AM/PM</span>
      </div>
    </div>
  );
};

// ... then your Dashboard component starts below ...

const AdminDashboard = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [calendarConnected, setCalendarConnected] = useState(true);
    const [formData, setFormData] = useState({ title: '', description: '', venue: '', event_date: '', start_time: '', end_time: '' });
    const [attendees, setAttendees] = useState([]);
    const [currentAttendee, setCurrentAttendee] = useState({ name: '', email: '' });
    const navigate = useNavigate();
    const adminEmail = localStorage.getItem('userEmail');

    const fetchEvents = async () => {
        try {
            const res = await axios.get('/api/events', { params: { role: 'admin' } });
            setEvents(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchEvents();
        // Check if Google Calendar is connected
        if (adminEmail) {
            axios.get('/api/auth/check-calendar', { params: { email: adminEmail } })
                .then(res => setCalendarConnected(res.data.connected))
                .catch(() => setCalendarConnected(false));
        }
        // Handle return from Google OAuth (calendar connect)
        const params = new URLSearchParams(window.location.search);
        if (params.get('login') === 'success') {
            setCalendarConnected(true);
            window.history.replaceState({}, '', '/admin-dashboard');
        }
    }, []);

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

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post('/api/events', { ...formData, attendees });
            setFormData({ title: '', description: '', venue: '', event_date: '', start_time: '', end_time: '' });
            setAttendees([]);
            fetchEvents();
            showToast('Event created successfully!');
        } catch (e) { showToast('Failed to schedule.', 'error'); }
        finally { setSubmitting(false); }
    };

    const handleAddAttendee = () => {
        if (currentAttendee.email.trim() !== "" && currentAttendee.name.trim() !== "") {
            setAttendees([...attendees, currentAttendee]);
            setCurrentAttendee({ name: '', email: '' });
        } else {
            alert("Please enter both Name and Email.");
        }
    };

    const handleExcelImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
            const parsed = rows
                .map(r => ({
                    name: String(r.name || r.Name || r.NAME || '').trim(),
                    email: String(r.email || r.Email || r.EMAIL || '').trim().toLowerCase(),
                }))
                .filter(r => r.name && r.email && /^[^@]+@[^@]+\.[^@]+$/.test(r.email));

            if (parsed.length === 0) {
                alert('No valid rows found. Make sure the sheet has "name" and "email" columns.');
                e.target.value = '';
                return;
            }

            // Merge, skipping duplicates by email
            setAttendees(prev => {
                const existing = new Set(prev.map(a => a.email));
                const newOnes = parsed.filter(a => !existing.has(a.email));
                return [...prev, ...newOnes];
            });
            e.target.value = '';
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="dashboard-container">
            {previewEvent && <PreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} onDownload={handleDownload} />}

            {/* Toast notification */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    border: `1.5px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`,
                    color: toast.type === 'error' ? '#dc2626' : '#16a34a',
                    padding: '18px 36px', borderRadius: 16,
                    fontWeight: 700, fontSize: 18,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                    animation: 'slideIn 0.25s ease',
                    whiteSpace: 'nowrap'
                }}>
                    <span style={{ fontSize: 22 }}>{toast.type === 'error' ? '✕' : '✓'}</span>
                    {toast.msg}
                </div>
            )}
            <div className="dashboard-wrapper">
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0', marginBottom: '5px', width: '100%' }}>
                    <button onClick={handleLogout} className="btn-secondary"><LogOut size={16} /> Logout</button>
                </div>

                {!calendarConnected && (
                    <div className="calendar-connect-banner">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <AlertTriangle size={18} color="#b45309" />
                            <span>Google Calendar is not connected. Events won't sync until you connect.</span>
                        </div>
                        <a href={`http://localhost:3000/auth/google?role=admin`} className="btn-connect-calendar">
                            Connect Google Calendar
                        </a>
                    </div>
                )}

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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ fontWeight: '600', fontSize: '13px', color: '#475569' }}>Invite Guests</label>
                                        <div className="tooltip-wrap">
                                            <label className="btn-secondary" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '12px' }}>
                                                <FileSpreadsheet size={14} />
                                                Import Excel
                                                <input
                                                    type="file"
                                                    accept=".xlsx,.xls"
                                                    style={{ display: 'none' }}
                                                    onChange={handleExcelImport}
                                                />
                                            </label>
                                            <span className="tooltip-text">Columns: name, email</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                        <div className="attendee-input-row">
                                            <input type="text" placeholder="Guest Name" className="custom-input" style={{ flex: 1 }} value={currentAttendee.name} onChange={e => setCurrentAttendee({ ...currentAttendee, name: e.target.value })} />
                                            <input type="email" placeholder="Guest Email" className="custom-input" style={{ flex: 1 }} value={currentAttendee.email} onChange={e => setCurrentAttendee({ ...currentAttendee, email: e.target.value })} />
                                            <button type="button" className="btn-secondary" onClick={handleAddAttendee}><UserPlus size={18} /></button>
                                        </div>
                                    </div>

                                    {attendees.length > 0 && (
                                        <div style={{ marginTop: '10px', maxHeight: '120px', overflowY: 'auto', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{attendees.length} guest{attendees.length > 1 ? 's' : ''}</span>
                                                <span onClick={() => setAttendees([])} style={{ fontSize: '11px', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>Clear all</span>
                                            </div>
                                            {attendees.map((p, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                                                    <span style={{ color: '#64748b' }}>{p.name} ({p.email})</span>
                                                    <X size={14} onClick={() => setAttendees(attendees.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer', color: '#ef4444' }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className="btn-primary" disabled={submitting} style={{ opacity: submitting ? 0.8 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                                    {submitting ? (
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                            </svg>
                                            Creating...
                                        </span>
                                    ) : 'Schedule & Send Invites'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="list-container">
                        <div className="floating-card">
                            {/* Header: title + tab buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                                    <Calendar size={24} color="#2563eb" />
                                    {activeTab === 'upcoming' ? 'Upcoming Events' : activeTab === 'live' ? '🔴 Live Events' : 'Past Events'}
                                </h2>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setActiveTab('upcoming')}
                                        className="btn-secondary"
                                        style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'upcoming' ? { background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' } : {}) }}
                                    >Upcoming</button>
                                    <button
                                        onClick={() => setActiveTab('live')}
                                        className="btn-secondary"
                                        style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'live' ? { background: '#dcfce7', color: '#16a34a', borderColor: '#bbf7d0' } : { color: '#16a34a', borderColor: '#bbf7d0' }) }}
                                    >🔴 Live</button>
                                    <button
                                        onClick={() => setActiveTab('past')}
                                        className="btn-secondary"
                                        style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'past' ? { background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' } : {}) }}
                                    >Past</button>
                                </div>
                            </div>

                            {/* Event list */}
                            <div className="schedule-list" style={{ maxHeight: '78vh', overflowY: 'auto', paddingRight: '4px' }}>
                                {(() => {
                                    const now = new Date();
                                    const filtered = events.filter(e => {
                                        const date = e.event_date.slice(0, 10);
                                        const [sH, sM] = e.start_time.split(':');
                                        const [eH, eM] = e.end_time.split(':');
                                        const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
                                        const end   = new Date(date); end.setHours(+eH, +eM, 0, 0);
                                        if (activeTab === 'upcoming') return now < start;
                                        if (activeTab === 'live')     return now >= start && now <= end;
                                        if (activeTab === 'past')     return end < now;
                                    });

                                    if (filtered.length === 0)
                                        return <div className="empty-state-card">No {activeTab} events.</div>;

                                    return filtered.map(item => (
                                        <EventCard
                                            key={item.event_id}
                                            event={item}
                                            onDelete={activeTab !== 'live' ? handleDelete : null}
                                            onPreview={setPreviewEvent}
                                            tab={activeTab}
                                        />
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;