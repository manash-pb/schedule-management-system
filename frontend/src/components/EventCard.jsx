import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Trash2, Pencil, FileText, Send, BarChart2, CheckCircle, Copy } from 'lucide-react';
import ClosedEyeIcon from './ClosedEyeIcon';
import SummaryModal from './SummaryModal';
import { CATEGORY_COLORS } from '../utils/constants';
import { formatTime } from '../utils/eventUtils';

const EventCard = ({ event, onDelete, onPreview, onEdit, tab, darkMode }) => {
    const [expanded, setExpanded] = useState(false);
    const [formUrl, setFormUrl] = useState(event.google_form_url);
    const [formId, setFormId] = useState(event.google_form_id);
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [sentStatus, setSentStatus] = useState('');
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState('');
    const [showChart, setShowChart] = useState(false);
    const [showSummaryEditModal, setShowSummaryEditModal] = useState(false);
    const [showSummaryViewModal, setShowSummaryViewModal] = useState(false);
    const [localSummary, setLocalSummary] = useState(event.summary || '');

    useEffect(() => {
        if (tab === 'past' && formId && !stats) {
            fetchStats();
        }
    }, [tab, formId]);

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/feedback/stats/${event.event_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.stats) {
                setStats(data.stats);
            }
        } catch (e) {
            console.error(e);
        }
        setStatsLoading(false);
    };

    const handleGenerateForm = async (e) => {
        e.stopPropagation();
        setGenerating(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/feedback/generate/${event.event_id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setFormUrl(data.responderUri);
                setFormId(data.formId);
                window.open(data.editUrl, '_blank');
            } else {
                alert(data.error || 'Failed to generate form.');
            }
        } catch (err) {
            alert('Failed to generate form.');
        }
        setGenerating(false);
    };

    const handleSendFeedback = async (e) => {
        e.stopPropagation();
        setSending(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/feedback/send/${event.event_id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setSentStatus(`Sent to ${data.sentCount} attendees`);
                setTimeout(() => setSentStatus(''), 5000);
            } else {
                alert(data.error || 'Failed to send feedback emails.');
            }
        } catch (err) {
            alert('Failed to send feedback emails.');
        }
        setSending(false);
    };

    const handleSaveSummary = async (summaryText) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/events/${event.event_id}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ summary: summaryText })
            });
            if (res.ok) {
                setLocalSummary(summaryText);
                event.summary = summaryText;
                setShowSummaryEditModal(false);
            } else {
                alert('Failed to save summary note.');
            }
        } catch (err) {
            alert('Failed to save summary note.');
        }
    };

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', width: '100%', gap: 16 }}>
                <div className="event-info" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    {tab === 'live' && (
                        <span className="status-badge" style={{ background: darkMode ? 'rgba(22,163,74,0.2)' : '#dcfce7', color: darkMode ? '#4ade80' : '#16a34a', border: darkMode ? '1px solid rgba(22,163,74,0.3)' : 'none' }}>
                            🔴 Live
                        </span>
                    )}
                    {event.category && (
                        <span className="category-badge" style={{ background: CATEGORY_COLORS[event.category.charAt(0).toUpperCase() + event.category.slice(1).toLowerCase()]?.bg || '#f1f5f9', color: CATEGORY_COLORS[event.category.charAt(0).toUpperCase() + event.category.slice(1).toLowerCase()]?.color || '#64748b', textTransform: 'capitalize', marginLeft: tab === 'live' ? undefined : 0 }}>
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
                <div className="event-actions" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
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
                    {tab === 'past' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: 16, alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {!formId ? (
                                    <button 
                                        className="btn-primary" 
                                        onClick={handleGenerateForm} 
                                        disabled={generating}
                                        style={{ fontSize: 13, padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}
                                    >
                                        <FileText size={14} />
                                        {generating ? 'Generating...' : 'Create Feedback Form'}
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            className="btn-secondary" 
                                            onClick={handleSendFeedback}
                                            disabled={sending || !!sentStatus}
                                            style={{ 
                                                fontSize: 13, 
                                                padding: '6px 12px', 
                                                display: 'flex', 
                                                gap: 6, 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                whiteSpace: 'nowrap',
                                                minWidth: 175,
                                                borderColor: sentStatus ? '#16a34a' : '#2563eb', 
                                                color: sentStatus ? '#16a34a' : '#2563eb' 
                                            }}
                                        >
                                            {sentStatus ? <CheckCircle size={14} /> : sending ? <Clock size={14} /> : <Send size={14} />}
                                            {sentStatus ? sentStatus : sending ? 'Sending...' : 'Send to Attendees'}
                                        </button>
                                        <a 
                                            href={`https://docs.google.com/forms/d/${formId}/edit`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="btn-secondary"
                                            style={{ fontSize: 13, padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center', textDecoration: 'none', whiteSpace: 'nowrap' }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Pencil size={14} /> Edit Form
                                        </a>
                                    </>
                                )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: 8 }}>
                                {!localSummary ? (
                                    <button 
                                        className="btn-secondary" 
                                        onClick={(e) => { e.stopPropagation(); setShowSummaryEditModal(true); }} 
                                        style={{ fontSize: 13, padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}
                                    >
                                        <FileText size={14} /> Create Summary Note
                                    </button>
                                ) : (
                                    <button 
                                        className="btn-secondary" 
                                        onClick={(e) => { e.stopPropagation(); setShowSummaryEditModal(true); }} 
                                        style={{ fontSize: 13, padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}
                                    >
                                        <Pencil size={14} /> Edit Summary
                                    </button>
                                )}
                            </div>
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

            {tab === 'past' && (formId || localSummary) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                            {localSummary && (
                                <button 
                                    className="btn-primary" 
                                    onClick={(e) => { e.stopPropagation(); setShowSummaryViewModal(true); }} 
                                    style={{ fontSize: 13, padding: '6px 12px', margin: 0, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}
                                >
                                    <FileText size={14} /> Summary
                                </button>
                            )}
                        </div>
                        {formId && (
                            <div 
                                style={{ display: 'flex', alignItems: 'center', gap: 8, background: darkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: stats && stats.totalResponses > 0 ? 'pointer' : 'default', transition: 'all 0.2s' }}
                                onClick={() => { if (stats && stats.totalResponses > 0) setShowChart(!showChart); }}
                                className={stats && stats.totalResponses > 0 ? "hover-bg-subtle" : ""}
                            >
                                <BarChart2 size={16} style={{ color: 'var(--blue)' }} />
                                {statsLoading ? (
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading stats...</span>
                                ) : stats ? (
                                    <div style={{ display: 'flex', gap: 12, fontSize: 13, alignItems: 'center' }}>
                                        <span><strong>{stats.avgRating > 0 ? stats.avgRating : 'N/A'}</strong> / {stats.maxRating || 5} avg rating</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>({stats.totalResponses} responses)</span>
                                        {stats.totalResponses > 0 && (
                                            <span style={{ fontSize: 10, color: 'var(--blue)', marginLeft: 4 }}>{showChart ? '▲ Hide Chart' : '▼ Show Chart'}</span>
                                        )}
                                    </div>
                                ) : (
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No responses yet</span>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {showChart && stats && stats.ratingDistribution && (
                        <div style={{ marginTop: 16, padding: 16, background: darkMode ? 'rgba(0,0,0,0.2)' : '#ffffff', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Rating Distribution</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {Array.from({ length: stats.maxRating || 5 }, (_, i) => (stats.maxRating || 5) - i).map(star => {
                                    const count = stats.ratingDistribution[star] || 0;
                                    const percentage = stats.totalResponses > 0 ? Math.round((count / stats.totalResponses) * 100) : 0;
                                    return (
                                        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                                            <span style={{ width: 28, textAlign: 'right', fontWeight: 500 }}>{star} ★</span>
                                            <div style={{ flex: 1, height: 8, background: darkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #2563eb)', borderRadius: 4, transition: 'width 0.5s ease-out' }}></div>
                                            </div>
                                            <span style={{ width: 36, fontWeight: 500 }}>{percentage}%</span>
                                            <span style={{ width: 32, textAlign: 'right', opacity: 0.6 }}>({count})</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {showSummaryEditModal && (
                <SummaryModal 
                    event={{ ...event, summary: localSummary }} 
                    mode="edit"
                    onClose={() => setShowSummaryEditModal(false)}
                    onSave={handleSaveSummary}
                />
            )}
            
            {showSummaryViewModal && (
                <SummaryModal 
                    event={{ ...event, summary: localSummary }} 
                    mode="view"
                    onClose={() => setShowSummaryViewModal(false)}
                />
            )}
        </div>
    );
};

export default EventCard;
