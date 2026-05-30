import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SummaryModal = ({ event, onClose, onSave, mode = 'view' }) => {
    const [summary, setSummary] = useState(event?.summary || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        if (onSave) {
            await onSave(summary);
        }
        setSaving(false);
    };

    const modalContent = (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '500px', position: 'relative' }}>
                <button 
                    onClick={onClose} 
                    className="btn-icon" 
                    style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg-muted)', padding: 6, borderRadius: '50%', cursor: 'pointer' }}
                >
                    <X size={18} />
                </button>
                
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {mode === 'edit' ? (event?.summary ? 'Edit Summary Note' : 'Create Summary Note') : 'Event Summary Note'}
                </h3>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', fontWeight: 500 }}>
                    {event?.title}
                </div>
                
                {mode === 'edit' ? (
                    <form onSubmit={handleSave}>
                        <textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="Write a summary note for this event..."
                            className="form-input"
                            style={{ width: '100%', minHeight: '150px', resize: 'vertical', padding: '12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input, var(--bg-muted))', color: 'var(--text-primary)' }}
                            required
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving} style={{ padding: '0 16px', fontSize: '13px', margin: 0, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0 16px', fontSize: '13px', margin: 0, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {saving ? 'Saving...' : 'Save Summary'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div>
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', background: 'var(--bg-muted)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '400px', overflowY: 'auto' }}>
                            {event?.summary || 'No summary available for this event.'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button onClick={onClose} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '13px' }}>Close</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default SummaryModal;
