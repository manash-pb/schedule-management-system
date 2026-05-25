import React from 'react';
import { Calendar, Clock, MapPin, X } from 'lucide-react';
import { formatTime } from '../utils/eventUtils';

const UserPreviewModal = ({ event, onClose }) => (
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

export default UserPreviewModal;
