import React, { useState, useRef } from 'react';
import axios from 'axios';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);
import PlaceAutocompleteInput from './PlaceAutocompleteInput';
import CustomTimeInput from './CustomTimeInput';
import CategoryDropdown from './CategoryDropdown';

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
    const [openPicker, setOpenPicker] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dateErrorMsg, setDateErrorMsg] = useState('');
    const [displayedMonth, setDisplayedMonth] = useState(form.event_date ? dayjs(form.event_date) : dayjs());
    const dateInputRef = useRef(null);

    const handleSave = async (e) => {
        e.preventDefault();
        if (dateErrorMsg || !form.event_date) {
            showToast('Please enter a valid upcoming date.', 'error');
            return;
        }
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
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ overflow: 'visible' }}>
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
                    <div style={{ position: 'relative', display: 'block' }}>
                        <DateInput
                            ref={dateInputRef}
                            key={`edit-${form.event_date ? 'filled' : 'empty'}`}
                            placeholder="dd-mm-yyyy"
                            valueFormat="DD-MM-YYYY"
                            value={form.event_date ? dayjs(form.event_date).toDate() : null}
                            onChange={(date) => {
                                if (!date) {
                                    setForm({ ...form, event_date: '' });
                                    setDateErrorMsg('');
                                    return;
                                }
                                const parsed = dayjs(date);
                                const today = dayjs().startOf('day');
                                if (parsed.isBefore(today)) {
                                    setDateErrorMsg('Date cannot be in the past.');
                                    return;
                                }
                                setDateErrorMsg('');
                                setForm({ ...form, event_date: parsed.format('YYYY-MM-DD') });
                                setOpenPicker(false);
                            }}
                            dateParser={(input) => {
                                let parts = input.split('-');
                                if (parts.length === 3) {
                                    parts = parts.map(part => part.padStart(2, '0'));
                                    input = parts.join('-');
                                }
                                const parsed = dayjs(input, 'DD-MM-YYYY', true);
                                return parsed.isValid() ? parsed.toDate() : new Date(NaN);
                            }}
                            onBlur={(e) => {
                                const raw = e.currentTarget.value.trim();
                                if (!raw) { setDateErrorMsg(''); return; }
                                let parts = raw.split('-');
                                if (parts.length === 3) {
                                    parts = parts.map(part => part.padStart(2, '0'));
                                    const formattedDate = parts.join('-');
                                    e.currentTarget.value = formattedDate;
                                }
                                const parsed = dayjs(e.currentTarget.value, 'DD-MM-YYYY', true);
                                if (!parsed.isValid()) {
                                    setDateErrorMsg('Invalid format. Use DD-MM-YYYY (e.g. 25-12-2027).');
                                    setForm({ ...form, event_date: '' });
                                    return;
                                }
                                const today = dayjs().startOf('day');
                                if (parsed.isBefore(today)) {
                                    setDateErrorMsg('Date cannot be in the past.');
                                    setForm({ ...form, event_date: '' });
                                    return;
                                }
                                setDateErrorMsg('');
                                setForm({ ...form, event_date: parsed.format('YYYY-MM-DD') });
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            minDate={dayjs().startOf('day').toDate()}
                            getDayProps={(date) => {
                                const dateObj = dayjs(date);
                                const isSunday = dateObj.day() === 0;
                                const isInCurrentMonth = dateObj.month() === displayedMonth.month() && dateObj.year() === displayedMonth.year();
                                return { style: { color: isSunday && isInCurrentMonth ? '#ef4444' : 'inherit' } };
                            }}
                            error={dateErrorMsg ? true : false}
                            rightSection={
                                form.event_date ? (
                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); setForm({ ...form, event_date: '' }); setDateErrorMsg(''); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px' }}>
                                        <X size={16} style={{ color: '#9ca3af' }} />
                                    </div>
                                ) : (
                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); setOpenPicker(p => !p); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px' }}>
                                        <Calendar size={18} style={{ color: '#9ca3af' }} />
                                    </div>
                                )
                            }
                            rightSectionPointerEvents="auto"
                            popoverProps={{ zIndex: 9999, withinPortal: true, opened: openPicker, onChange: (o) => { if (!o) setOpenPicker(false); } }}
                            onMonthChange={(date) => setDisplayedMonth(dayjs(date))}
                            required
                            classNames={{ input: 'w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm' }}
                            styles={{ input: { height: '46px', borderRadius: '8px', fontSize: '14px' } }}
                        />
                        {dateErrorMsg && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                left: '10px',
                                background: '#1f2937',
                                color: 'white',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                whiteSpace: 'nowrap',
                                zIndex: 10000,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                border: '1px solid #ea580c',
                            }}>
                                <AlertCircle size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
                                {dateErrorMsg}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CategoryDropdown value={form.category} onChange={(cat) => setForm({ ...form, category: cat })} />
                    </div>

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
