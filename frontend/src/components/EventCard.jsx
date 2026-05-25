import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Trash2, Pencil } from 'lucide-react';
import ClosedEyeIcon from './ClosedEyeIcon';
import { CATEGORY_COLORS } from '../utils/constants';
import { formatTime } from '../utils/eventUtils';

const EventCard = ({ event, onDelete, onPreview, onEdit, tab, darkMode }) => {
    const [expanded, setExpanded] = useState(false);
    
    const startDateStr = event.event_date.slice(0, 10);
    const endDateStr = event.end_date ? event.end_date.slice(0, 10) : startDateStr;
    const isMultiDay = startDateStr !== endDateStr;
    
    let days = [];
    if (isMultiDay) {
        if (event.isMultiDaySpan && event.days) {
            days = event.days.map((d, idx) => ({
                dayNumber: idx + 1,
                dateStr: d.event_date.slice(0, 10),
                formattedDate: new Date(d.event_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
                start_time: d.start_time,
                end_time: d.end_time,
                venue: d.venue || event.venue,
                title: d.title || event.title,
                originalEvent: d
            }));
        } else {
            let currentDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);
            let dayCount = 1;
            while (currentDate <= endDate) {
                const y = currentDate.getFullYear();
                const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                const d = String(currentDate.getDate()).padStart(2, '0');
                days.push({
                    dayNumber: dayCount,
                    dateStr: `${y}-${m}-${d}`,
                    formattedDate: currentDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
                    start_time: event.start_time,
                    end_time: event.end_time,
                    venue: event.venue,
                    title: event.title,
                    originalEvent: event
                });
                currentDate.setDate(currentDate.getDate() + 1);
                dayCount++;
            }
        }
    }
    
    return (
        <div className="event-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 16 }}>
                <div className="event-info" style={{ flex: 1 }}>
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
                    <h3 className="event-title" style={{ marginTop: 8 }}>{event.title}</h3>
                    <div className="event-meta" style={{ marginTop: 8 }}>
                        <div className="meta-item">
                            <Calendar size={14} className="text-blue" />
                            <span>
                                {new Date(event.event_date).toLocaleDateString('en-GB')}
                                {isMultiDay && ` - ${new Date(event.end_date).toLocaleDateString('en-GB')}`}
                            </span>
                        </div>
                        <div className="meta-item"><Clock size={14} className="text-blue" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                        <div className="meta-item venue"><MapPin size={14} /><span>{event.venue}</span></div>
                    </div>
                </div>
                <div className="event-actions" style={{ flexShrink: 0 }}>
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
            
            {isMultiDay && (
                <div style={{ width: '100%' }}>
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
                        className="btn-secondary" 
                        style={{ width: '100%', justifyContent: 'center', gap: 6, fontSize: 13, padding: '8px 12px', background: darkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc', border: '1px dashed var(--border)', borderRadius: 8 }}
                    >
                        {expanded ? '▲ Hide Daily Schedule' : `▼ Show Daily Schedule (${days.length} Days)`}
                    </button>
                    
                    {expanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingLeft: 12, borderLeft: '3px solid var(--blue)' }}>
                            {days.map(d => (
                                <div key={d.dayNumber} className="sub-event-card" style={{
                                    background: darkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 16
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Day {d.dayNumber}: {d.formattedDate}</span>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                                            <span>🕐 {formatTime(d.start_time)} - {formatTime(d.end_time)}</span>
                                            <span>📍 {d.venue}</span>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        className="btn-icon" 
                                        style={{ padding: 4, height: 26, width: 26, flexShrink: 0 }} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPreview(d.originalEvent);
                                        }}
                                    >
                                        <ClosedEyeIcon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EventCard;
