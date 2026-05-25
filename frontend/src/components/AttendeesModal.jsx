import React from 'react';
import { X } from 'lucide-react';

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

export default AttendeesModal;
