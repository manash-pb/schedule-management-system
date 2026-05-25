import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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

export default CustomCalendarToolbar;
