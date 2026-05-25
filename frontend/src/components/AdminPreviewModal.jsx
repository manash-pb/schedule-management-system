import React, { useState } from 'react';
import axios from 'axios';
import { Calendar, Clock, MapPin, X, Download, UserPlus } from 'lucide-react';
import { formatTime } from '../utils/eventUtils';

const AdminPreviewModal = ({ event, onClose, onDownload, onAttendeesChange, showToast }) => {
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
            const updated = [...attendees, { ...newAttendee }];
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
                        <input className="custom-input" style={{ flex: 1 }} placeholder="Email" value={newAttendee.email} onChange={e => setNewAttendee({ ...newAttendee, email: e.target.value.toLowerCase() })} />
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

export default AdminPreviewModal;
