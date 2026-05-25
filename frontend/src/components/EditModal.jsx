import React, { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { CATEGORIES } from '../utils/constants';
import PlaceAutocompleteInput from './PlaceAutocompleteInput';
import CustomTimeInput from './CustomTimeInput';

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

export default EditModal;
