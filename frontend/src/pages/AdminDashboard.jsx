import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, Trash2, PlusCircle, UserPlus, X, Download, FileSpreadsheet, Clock, MapPin, AlertTriangle, Pencil, Search, Tag, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutList, CalendarDays } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getAuthData } from '../utils/authStorage';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const toCalendarEvents = (events) => events.map(e => {
    const date = e.event_date.slice(0, 10);
    const [sH, sM] = e.start_time.split(':');
    const [eH, eM] = e.end_time.split(':');
    const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
    const end   = new Date(date); end.setHours(+eH, +eM, 0, 0);
    return { title: e.title, start, end, resource: e };
});
const CATEGORIES = ['General', 'Meeting', 'Workshop', 'Holiday', 'Training', 'Social'];

let googleMapsScriptPromise = null;
const loadGoogleMapsScript = (apiKey) => {
    if (!apiKey) return Promise.reject(new Error('Google Maps API key is required'));
    if (window.google && window.google.maps && window.google.maps.places) return Promise.resolve();
    if (googleMapsScriptPromise) return googleMapsScriptPromise;

    googleMapsScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-google-maps-script]');
        if (existingScript) {
            existingScript.addEventListener('load', resolve);
            existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed to load')));
            return;
        }

        const script = document.createElement('script');
        script.setAttribute('data-google-maps-script', 'true');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Google Maps script failed to load'));
        document.head.appendChild(script);
    });

    return googleMapsScriptPromise;
};

const PlaceAutocompleteInput = ({ apiKey, value, onChange, onPlaceSelected, placeholder, className, style, required }) => {
    const inputRef = useRef(null);
    const autocompleteRef = useRef(null);

    useEffect(() => {
        let mounted = true;
        if (!apiKey) return;

        loadGoogleMapsScript(apiKey)
            .then(() => {
                if (!mounted || !inputRef.current) return;
                if (autocompleteRef.current) return;

                const createAutocomplete = () => {
                    const element = new window.google.maps.places.Autocomplete(inputRef.current, {
                        types: ['establishment', 'geocode'],
                        fields: ['name', 'formatted_address'],
                    });

                    element.addListener('place_changed', () => {
                        const place = element.getPlace();
                        if (place) onPlaceSelected(place);
                    });

                    autocompleteRef.current = element;
                };

                if (window.google && window.google.maps && window.google.maps.places) {
                    createAutocomplete();
                }
            })
            .catch((error) => {
                console.error('Error loading Google Maps script:', error);
            });

        return () => {
            mounted = false;
        };
    }, [apiKey, onPlaceSelected]);

    return (
        <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={className}
            style={style}
            required={required}
        />
    );
};
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

const PreviewModal = ({ event, onClose, onDownload, onAttendeesChange, showToast }) => {
    const [newAttendee, setNewAttendee] = useState({ name: '', email: '' });
    const [attendees, setAttendees] = useState(event.attendees || []);
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [confirmRemoveEmail, setConfirmRemoveEmail] = useState(null);

    const handleAdd = async () => {
        if (!newAttendee.name.trim() || !newAttendee.email.trim()) return;
        setSaving(true);
        try {
            await axios.post(`/api/events/${event.event_id}/attendees`, newAttendee);
            const updated = [...attendees, { ...newAttendee, rsvp_status: 'pending' }];
            setAttendees(updated);
            showToast(`${newAttendee.email} added to this event.`);
            setNewAttendee({ name: '', email: '' });
            onAttendeesChange();
        } catch (e) { showToast(e.response?.data?.error || 'Failed to add attendee.', 'error'); }
        finally { setSaving(false); }
    };

    const handleRemove = async (email) => {
        setRemoving(email);
        try {
            await axios.delete(`/api/events/${event.event_id}/attendees/${encodeURIComponent(email)}`);
            setAttendees(attendees.filter(a => a.email !== email));
            onAttendeesChange();
            showToast(`${email} removed from this event.`);
        } catch { showToast('Failed to remove attendee.', 'error'); }
        finally { setRemoving(null); }
    };

    return (
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
                <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString('en-GB')}</span></div>
                <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
            </div>

            {event.description && (
                <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{event.description}</p>
                </div>
            )}

            <div className="modal-attendees">
                <p className="modal-attendees-title">Attendees ({attendees.length})</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <input className="custom-input" style={{ flex: 1 }} placeholder="Name" value={newAttendee.name} onChange={e => setNewAttendee({ ...newAttendee, name: e.target.value })} />
                    <input className="custom-input" style={{ flex: 1 }} placeholder="Email" value={newAttendee.email} onChange={e => setNewAttendee({ ...newAttendee, email: e.target.value })} />
                    <button className="btn-secondary" onClick={handleAdd} disabled={saving}>
                        {saving ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> : <UserPlus size={16} />}
                    </button>
                </div>
                {attendees.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>No attendees added.</p>
                ) : (
                    <div className="modal-attendees-list">
                        {attendees.map((a, i) => (
                            <div key={i} className="modal-attendee-row">
                                <div className="attendee-avatar">{a.name?.[0]?.toUpperCase() || '?'}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>{a.email}</div>
                                </div>
                                <span style={{
                                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                    background: a.rsvp_status === 'accepted' ? '#dcfce7' : a.rsvp_status === 'declined' ? '#fee2e2' : '#f1f5f9',
                                    color: a.rsvp_status === 'accepted' ? '#16a34a' : a.rsvp_status === 'declined' ? '#dc2626' : '#94a3b8'
                                }}>{a.rsvp_status || 'pending'}</span>
                                <button onClick={() => setConfirmRemoveEmail(a.email)} disabled={removing === a.email} style={{ background: 'none', border: 'none', cursor: removing === a.email ? 'not-allowed' : 'pointer', color: '#ef4444', marginLeft: 4, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {removing === a.email ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> : <X size={14} />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
            {confirmRemoveEmail && (
                <div className="modal-overlay" onClick={() => setConfirmRemoveEmail(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={22} color="#ef4444" />
                            </div>
                        </div>
                        <h2 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>Remove Attendee?</h2>
                        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            <strong>{confirmRemoveEmail}</strong> will be removed from this event.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmRemoveEmail(null)}>Cancel</button>
                            <button onClick={() => { handleRemove(confirmRemoveEmail); setConfirmRemoveEmail(null); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: '#ef4444', color: '#fff' }}>
                                <X size={14} /> Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </div>
    );
};

const EventCard = ({ event, onDelete, onPreview, onEdit, tab, darkMode }) => (
    <div className="event-card">
        <div className="event-info">
            <span className="status-badge" style={
                tab === 'past' ? { background: darkMode ? 'rgba(100,116,139,0.2)' : '#f1f5f9', color: darkMode ? '#94a3b8' : '#475569', border: darkMode ? '1px solid rgba(100,116,139,0.3)' : 'none' } :
                tab === 'live' ? { background: darkMode ? 'rgba(22,163,74,0.2)' : '#dcfce7', color: darkMode ? '#4ade80' : '#16a34a', border: darkMode ? '1px solid rgba(22,163,74,0.3)' : 'none' } : {}
            }>
                {tab === 'past' ? 'Past' : tab === 'live' ? '🔴 Live' : 'Confirmed'}
            </span>
            {event.category && (
                <span className="category-badge" style={{ background: CATEGORY_COLORS[event.category.charAt(0).toUpperCase() + event.category.slice(1).toLowerCase()]?.bg || '#f1f5f9', color: CATEGORY_COLORS[event.category.charAt(0).toUpperCase() + event.category.slice(1).toLowerCase()]?.color || '#64748b', textTransform: 'capitalize' }}>
                    {event.category}
                </span>
            )}
            <h3 className="event-title">{event.title}</h3>
            <div className="event-meta">
                <div className="meta-item"><Calendar size={14} className="text-blue" /><span>{new Date(event.event_date).toLocaleDateString('en-GB')}</span></div>
                <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
            </div>
        </div>
        <div className="event-actions">
            <div className="tooltip-wrap">
                <button onClick={() => onPreview(event)} className="btn-icon preview"><ClosedEyeIcon size={20} /></button>
                <span className="tooltip-text">Preview</span>
            </div>
            {onEdit && (
                <div className="tooltip-wrap">
                    <button onClick={() => onEdit(event)} className="btn-icon edit"><Pencil size={18} /></button>
                    <span className="tooltip-text">Edit</span>
                </div>
            )}
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
        <button type="button" onClick={() => handleArrow('h', 'up')} className="arrow-btn">▲</button>
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
            if (e.key === 'ArrowUp')   { e.preventDefault(); handleArrow('h', 'up'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); handleArrow('h', 'down'); }
          }}
        />
        <button type="button" onClick={() => handleArrow('h', 'down')} className="arrow-btn">▼</button>
        <span className="input-label-sm">HRS</span>
      </div>

      <span className="time-separator">:</span>

      <div className="time-column">
        <button type="button" onClick={() => handleArrow('m', 'up')} className="arrow-btn">▲</button>
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
            if (e.key === 'ArrowUp')   { e.preventDefault(); handleArrow('m', 'up'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); handleArrow('m', 'down'); }
          }}
        />
        <button type="button" onClick={() => handleArrow('m', 'down')} className="arrow-btn">▼</button>
        <span className="input-label-sm">MIN</span>
      </div>

      <div className="time-column">
        <button type="button" onClick={() => handleArrow('p', 'up')} className="arrow-btn">▲</button>
        <div
          ref={ampmRef}
          className="time-type-input ampm"
          tabIndex={0}
          onClick={() => handleArrow('p', 'up')}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') handleArrow('p', 'up'); }}
        >{p}</div>
        <button type="button" onClick={() => handleArrow('p', 'down')} className="arrow-btn">▼</button>
        <span className="input-label-sm">AM/PM</span>
      </div>
    </div>
  );
};

const AttendeesModal = ({ attendees, onRemove, onClearAll, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
                <h2 style={{ margin: 0, fontSize: 17 }}>Invited Guests ({attendees.length})</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {attendees.length > 0 && (
                        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px', color: '#ef4444', borderColor: '#fca5a5' }} onClick={onClearAll}>Clear All</button>
                    )}
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>
            </div>
            {attendees.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No guests added yet.</p>
            ) : (
                <div className="modal-attendees-list" style={{ maxHeight: 360 }}>
                    {attendees.map((p, i) => (
                        <div key={i} className="modal-attendee-row">
                            <div className="attendee-avatar">{p.name?.[0]?.toUpperCase() || '?'}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{p.email}</div>
                            </div>
                            <button onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
);

const EditModal = ({ event, onClose, onSave, showToast }) => {
    const [form, setForm] = useState({
        title: event.title || '',
        description: event.description || '',
        venue: event.venue || '',
        event_date: event.event_date?.slice(0, 10) || '',
        start_time: event.start_time?.slice(0, 5) || '',
        end_time: event.end_time?.slice(0, 5) || '',
        category: event.category || 'General',
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (form.start_time === form.end_time) {
            showToast('Start time and end time cannot be the same.', 'error');
            return;
        }
        setSaving(true);
        try {
            await axios.patch(`/api/events/${event.event_id}`, form);
            onSave();
            onClose();
        } catch { /* handled by parent toast */ }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ margin: 0, fontSize: 18 }}>Edit Event</h2>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                    <input className="custom-input" placeholder="Event Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                    <textarea className="custom-input" placeholder="Description" style={{ minHeight: 80, resize: 'none' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    <PlaceAutocompleteInput
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                        value={form.venue}
                        onChange={(value) => setForm({ ...form, venue: value })}
                        onPlaceSelected={(place) => setForm({ ...form, venue: place.name ? `${place.name}, ${place.formatted_address || ''}`.replace(/, $/, '') : place.formatted_address })}
                        className="custom-input"
                        placeholder="Venue"
                        required
                    />
                    <input type="date" className="custom-input" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} required />
                    <select className="custom-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="time-row">
                        <div className="time-field">
                            <label className="input-label">Start Time</label>
                            <CustomTimeInput value={form.start_time} onChange={v => setForm({ ...form, start_time: v })} />
                        </div>
                        <span className="time-row-divider">→</span>
                        <div className="time-field">
                            <label className="input-label">End Time</label>
                            <CustomTimeInput value={form.end_time} onChange={v => setForm({ ...form, end_time: v })} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" style={{ flex: 2, marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
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

// ... then your Dashboard component starts below ...

const AdminDashboard = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const [editEvent, setEditEvent] = useState(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [submitting, setSubmitting] = useState(false);
    const [meetLoading, setMeetLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [calendarConnected, setCalendarConnected] = useState(true);
    const [formData, setFormData] = useState({ title: '', description: '', venue: '', event_date: '', start_time: '00:00', end_time: '00:00', category: 'General' });
    const [attendees, setAttendees] = useState([]);
    const [currentAttendee, setCurrentAttendee] = useState({ name: '', email: '' });
    const [showAttendeesModal, setShowAttendeesModal] = useState(false);
    const [search, setSearch] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 5;
    const navigate = useNavigate();
    const adminEmail = getAuthData('userEmail');
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [viewMode, setViewMode] = useState('list');
    const [calendarView, setCalendarView] = useState('month');
    const [calendarDate, setCalendarDate] = useState(new Date());

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
            const res = await axios.get('/api/events', { params: { role: 'admin' }, withCredentials: true });
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


    const handleEditSave = async () => {
        fetchEvents();
        showToast('Event updated successfully!');
    };

    const handleDelete = async (id) => {
        if (!id) { showToast('Event ID missing.', 'error'); return; }
        setConfirmDeleteId(id);
    };

    const confirmDelete = async () => {
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
        setDeleting(true);
        try {
            await axios.delete(`/api/events/${id}`);
            fetchEvents();
            showToast('Event deleted successfully!');
        } catch (e) {
            console.error('Delete Error:', e);
            showToast('Delete failed. Please try again.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleDownload = async (event) => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const formattedDate = new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const attendees = event.attendees || [];

        const data = [
            // Event details block
            ['Event Title',    event.title],
            ['Date',           formattedDate],
            ['Start Time',     formatTime(event.start_time)],
            ['End Time',       formatTime(event.end_time)],
            ['Venue',          event.venue || '—'],
            ['Category',       event.category || 'General'],
            ['Description',    event.description || '—'],
            ['Total Attendees', attendees.length],
            [], // blank separator row
            // Attendees header
            ['#', 'Name', 'Email', 'Status'],
            // Attendee rows
            ...attendees.map((a, i) => [
                i + 1,
                a.name || '—',
                a.email || '—',
                a.rsvp_status ? a.rsvp_status.charAt(0).toUpperCase() + a.rsvp_status.slice(1) : 'Pending',
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 35 }, { wch: 15 }];

        // Bold event detail labels (column A, rows 0–7)
        for (let r = 0; r < 8; r++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
            if (cell) cell.s = { font: { bold: true } };
        }
        // Bold attendees header row (row 9)
        for (let c = 0; c < 4; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r: 9, c })];
            if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'EFF6FF' } } };
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Event Report');
        XLSX.writeFile(wb, `${event.title.replace(/[^a-z0-9]/gi, '_')}_Report.xlsx`);
    };

    const showToast = (msg, type = 'success') => {
        if (type === 'error') toast.error(msg);
        else toast.success(msg);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (attendees.length === 0) {
            showToast('At least one guest must be invited.', 'error');
            return;
        }
        if (formData.start_time === formData.end_time) {
            showToast('Start time and end time cannot be the same.', 'error');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post('/api/events', { ...formData, attendees });
            setFormData({ title: '', description: '', venue: '', event_date: '', start_time: '00:00', end_time: '00:00', category: 'General' });
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

    const handleExcelImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const XLSX = await import('xlsx');
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
            <style>{`
              .rbc-off-range-bg { background-color: #e5e7eb !important; }
              html.dark .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range { color: #9ca3af !important; opacity: 0.8 !important; }
            `}</style>
            {previewEvent && <PreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} onDownload={handleDownload} onAttendeesChange={fetchEvents} showToast={showToast} />}
            {deleting && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9998,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 16, padding: '28px 40px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                        border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
                    }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Deleting event...</span>
                    </div>
                </div>
            )}
            {confirmDeleteId && (
                <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={26} color="#ef4444" />
                            </div>
                        </div>
                        <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--text-primary)' }}>Delete Event?</h2>
                        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            This action cannot be undone. The event will be permanently removed along with all its attendees.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                            <button onClick={confirmDelete} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: '#ef4444', color: '#fff' }}>
                                <Trash2 size={15} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {editEvent && <EditModal event={editEvent} onClose={() => setEditEvent(null)} onSave={handleEditSave} showToast={showToast} />}
            {showAttendeesModal && (
                <AttendeesModal
                    attendees={attendees}
                    onRemove={i => setAttendees(attendees.filter((_, idx) => idx !== i))}
                    onClearAll={() => { setAttendees([]); setShowAttendeesModal(false); }}
                    onClose={() => setShowAttendeesModal(false)}
                />
            )}

            <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontWeight: 600, fontSize: 14, borderRadius: 12, padding: '12px 18px' } }} />
            <div className="dashboard-wrapper">

                {!calendarConnected && (
                    <div className="calendar-connect-banner">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <AlertTriangle size={18} color="#b45309" />
                            <span>Google Calendar is not connected. Events won't sync.</span>
                        </div>
                        <a href="/auth/google?role=admin" className="btn-connect-calendar">
                            Connect Calendar
                        </a>
                    </div>
                )}

                <div className="main-content">
                    <div className="form-container">
                        <div className="floating-card">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, paddingBottom: '16px' }}><PlusCircle color="#2563eb" />Create Event</h2>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input type="text" placeholder="Event Title" className="custom-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                                    <textarea placeholder="Description" className="custom-input" style={{ minHeight: '90px', resize: 'none' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>

                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <PlaceAutocompleteInput
                                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                                        value={formData.venue}
                                        onChange={(value) => setFormData({ ...formData, venue: value })}
                                        onPlaceSelected={(place) => setFormData({ ...formData, venue: place.name ? `${place.name}, ${place.formatted_address || ''}`.replace(/, $/, '') : place.formatted_address })}
                                        placeholder="Venue"
                                        className="custom-input"
                                        style={{ flex: 1, height: '42px', boxSizing: 'border-box' }}
                                        required
                                    />
                                    <button type="button" onClick={async () => {
                                        if (!calendarConnected) { showToast('Connect Google Calendar first to generate a Meet link.', 'error'); return; }
                                        setMeetLoading(true);
                                        try {
                                            const res = await axios.post('/api/auth/meet/generate', { email: adminEmail });
                                            setFormData(prev => ({ ...prev, venue: res.data.meetLink }));
                                        } catch { showToast('Failed to generate Meet link.', 'error'); }
                                        finally { setMeetLoading(false); }
                                    }} className="btn-secondary" disabled={meetLoading} style={{ whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: calendarConnected ? 1 : 0.5, height: '42px', width: '90px', boxSizing: 'border-box' }}>
                                        {meetLoading ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>}
                                        {meetLoading ? 'Loading' : 'Meet'}
                                    </button>
                                </div>
                                <input type="date" className="custom-input" value={formData.event_date} onChange={e => setFormData({ ...formData, event_date: e.target.value })} required />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tag size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <select className="custom-input" style={{ flex: 1 }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

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
                                        <button type="button" className="btn-secondary" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 13 }} onClick={() => setShowAttendeesModal(true)}>
                                            <UserPlus size={15} /> View {attendees.length} Guest{attendees.length > 1 ? 's' : ''} Added
                                        </button>
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
                                    ) : 'Schedule & Send'}
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
                                    Events
                                </h2>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {/* View Mode Toggle */}
                                    <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${darkMode ? '#30363d' : '#d0d7de'}` }}>
                                        <button onClick={() => setViewMode('list')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: viewMode === 'list' ? (darkMode ? '#388bfd' : '#0969da') : (darkMode ? '#21262d' : '#f6f8fa'), color: viewMode === 'list' ? '#fff' : (darkMode ? '#8b949e' : '#656d76') }}>
                                            <LayoutList size={15} /> List
                                        </button>
                                        <button onClick={() => setViewMode('calendar')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: viewMode === 'calendar' ? (darkMode ? '#388bfd' : '#0969da') : (darkMode ? '#21262d' : '#f6f8fa'), color: viewMode === 'calendar' ? '#fff' : (darkMode ? '#8b949e' : '#656d76') }}>
                                            <CalendarDays size={15} /> Calendar
                                        </button>
                                    </div>
                                    <button onClick={() => setActiveTab('upcoming')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'upcoming' ? { background: darkMode ? '#0d1f35' : '#eff6ff', color: darkMode ? '#93c5fd' : '#2563eb', borderColor: darkMode ? '#3b82f6' : '#bfdbfe' } : {}) }}>Upcoming</button>
                                    <button onClick={() => setActiveTab('live')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'live' ? { background: darkMode ? '#081810' : '#dcfce7', color: darkMode ? '#86efac' : '#16a34a', borderColor: darkMode ? '#22c55e' : '#bbf7d0' } : { color: darkMode ? '#86efac' : '#16a34a', borderColor: darkMode ? '#22c55e' : '#bbf7d0' }) }}>Live</button>
                                    <button onClick={() => setActiveTab('past')} className="btn-secondary" style={{ fontSize: '13px', padding: '8px 14px', ...(activeTab === 'past' ? { background: darkMode ? '#0a0e1a' : '#f1f5f9', color: darkMode ? '#94a3b8' : '#475569', borderColor: darkMode ? '#475569' : '#cbd5e1' } : {}) }}>Past</button>
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
                                        events={toCalendarEvents(events.filter(e => {
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
                                        const filtered = events.filter(e => {
                                            const date = e.event_date.slice(0, 10);
                                            const [sH, sM] = e.start_time.split(':');
                                            const [eH, eM] = e.end_time.split(':');
                                            const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
                                            const end   = new Date(date); end.setHours(+eH, +eM, 0, 0);
                                            const tabMatch = activeTab === 'upcoming' ? now < start : activeTab === 'live' ? now >= start && now <= end : end < now;
                                            const searchMatch = !search || e.title.toLowerCase().startsWith(search.toLowerCase());
                                            const dateMatch = !filterDate || date === filterDate;
                                            const catMatch = !filterCategory || (e.category || 'General').toLowerCase() === filterCategory.toLowerCase();
                                            return tabMatch && searchMatch && dateMatch && catMatch;
                                        }).sort((a, b) => {
                                            const dateA = a.event_date.slice(0, 10);
                                            const [sHa, sMa] = a.start_time.split(':');
                                            const startA = new Date(dateA); startA.setHours(+sHa, +sMa, 0, 0);
                                            const endA = new Date(dateA); endA.setHours(+a.end_time.split(':')[0], +a.end_time.split(':')[1], 0, 0);
                                            const dateB = b.event_date.slice(0, 10);
                                            const [sHb, sMb] = b.start_time.split(':');
                                            const startB = new Date(dateB); startB.setHours(+sHb, +sMb, 0, 0);
                                            const endB = new Date(dateB); endB.setHours(+b.end_time.split(':')[0], +b.end_time.split(':')[1], 0, 0);
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
                                                    <EventCard key={item.event_id} event={item} onDelete={activeTab !== 'live' ? handleDelete : null} onEdit={activeTab !== 'live' ? setEditEvent : null} onPreview={setPreviewEvent} tab={activeTab} darkMode={darkMode} />
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

export default AdminDashboard;