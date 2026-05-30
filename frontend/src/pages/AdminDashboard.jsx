import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, Trash2, PlusCircle, UserPlus, X, Download, FileSpreadsheet, Clock, MapPin, AlertTriangle, Pencil, Search, Tag, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutList, CalendarDays, MessageCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getAuthData } from '../utils/authStorage';
import { io } from 'socket.io-client';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Extracted Components & Utils
import { CATEGORIES, CATEGORY_COLORS } from '../utils/constants';
import { unrollEvents, toCalendarEvents, groupMultiDaySpans, formatTime } from '../utils/eventUtils';
import CustomCalendarToolbar from '../components/CustomCalendarToolbar';
import PlaceAutocompleteInput from '../components/PlaceAutocompleteInput';
import CustomTimeInput from '../components/CustomTimeInput';
import AttendeesModal from '../components/AttendeesModal';
import EditModal from '../components/EditModal';
import AdminPreviewModal from '../components/AdminPreviewModal';
import EventCard from '../components/EventCard';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ... then your Dashboard component starts below ...

const AdminDashboard = () => {
    const [events, setEvents] = useState([]);
    const [previewEvent, setPreviewEvent] = useState(null);
    const [editEvent, setEditEvent] = useState(null);
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('adminActiveTab') || 'upcoming');
    const [submitting, setSubmitting] = useState(false);
    const [meetLoading, setMeetLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [calendarConnected, setCalendarConnected] = useState(true);
    const [formData, setFormData] = useState({ title: '', description: '', venue: '', event_date: '', end_date: '', start_time: '00:00', end_time: '00:00', category: 'General', event_span: 'single' });
    const [subDays, setSubDays] = useState([]);
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

    const prevTimesRef = useRef({ start: formData.start_time, end: formData.end_time });

    useEffect(() => {
        const prevTimes = prevTimesRef.current;
        if (formData.start_time !== prevTimes.start || formData.end_time !== prevTimes.end) {
            setSubDays(prev => 
                prev.map(day => ({
                    ...day,
                    start_time: formData.start_time || '00:00',
                    end_time: formData.end_time || '00:00'
                }))
            );
            prevTimesRef.current = { start: formData.start_time, end: formData.end_time };
        }
    }, [formData.start_time, formData.end_time]);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('adminViewMode') || 'list');
    const [calendarView, setCalendarView] = useState('month');
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [queries, setQueries] = useState([]);
    const [queryModalOpen, setQueryModalOpen] = useState(false);
    const [queryLoading, setQueryLoading] = useState(false);
    const [queryError, setQueryError] = useState('');
    const [replyDrafts, setReplyDrafts] = useState({});
    const [replySending, setReplySending] = useState({});
    const [expandedQueryId, setExpandedQueryId] = useState(null);
    const [replyingQueryId, setReplyingQueryId] = useState(null);

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

    useEffect(() => {
        localStorage.setItem('adminActiveTab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('adminViewMode', viewMode);
    }, [viewMode]);

    useEffect(() => { setPage(1); }, [search, filterDate, filterCategory, activeTab]);

    const fetchEvents = async () => {
        try {
            const res = await axios.get('/api/events', { params: { role: 'admin' }, withCredentials: true });
            setEvents(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchEvents();
        fetchQueries();
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

    useEffect(() => {
        if (formData.event_span === 'multiple' && formData.event_date && formData.end_date) {
            const startDateStr = formData.event_date;
            const endDateStr = formData.end_date;
            
            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);
            
            if (startDate <= endDate) {
                const dateList = [];
                let currentDate = new Date(startDateStr);
                while (currentDate <= endDate) {
                    const y = currentDate.getFullYear();
                    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const d = String(currentDate.getDate()).padStart(2, '0');
                    dateList.push(`${y}-${m}-${d}`);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                setSubDays(prev => {
                    return dateList.map((dt, idx) => {
                        const existing = prev.find(p => p.date === dt);
                        if (existing && existing.customized) {
                            return existing;
                        }
                        
                        return {
                            date: dt,
                            dayNumber: idx + 1,
                            title: formData.title,
                            description: formData.description || '',
                            start_time: formData.start_time || '00:00',
                            end_time: formData.end_time || '00:00',
                            attendees: [...attendees],
                            currentAttendee: { name: '', email: '' },
                            expanded: existing ? existing.expanded : false,
                            customized: false
                        };
                    });
                });
            } else {
                setSubDays([]);
            }
        } else {
            setSubDays([]);
        }
    }, [formData.event_date, formData.end_date, formData.event_span, formData.title, formData.start_time, formData.end_time, formData.description, attendees]);

    const updateSubDay = (idx, key, val) => {
        setSubDays(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [key]: val, customized: true };
            return next;
        });
    };

    const updateSubDayCurrentAttendee = (idx, key, val) => {
        setSubDays(prev => {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                currentAttendee: { ...next[idx].currentAttendee, [key]: val }
            };
            return next;
        });
    };

    const addSubDayAttendee = (idx) => {
        const day = subDays[idx];
        if (day.currentAttendee.name.trim() && day.currentAttendee.email.trim()) {
            setSubDays(prev => {
                const next = [...prev];
                next[idx] = {
                    ...next[idx],
                    attendees: [...next[idx].attendees, { ...day.currentAttendee }],
                    currentAttendee: { name: '', email: '' },
                    customized: true
                };
                return next;
            });
        } else {
            alert('Please enter both Name and Email.');
        }
    };

    const removeSubDayAttendee = (dayIdx, attIdx) => {
        setSubDays(prev => {
            const next = [...prev];
            const nextAttendees = [...next[dayIdx].attendees];
            nextAttendees.splice(attIdx, 1);
            next[dayIdx] = { ...next[dayIdx], attendees: nextAttendees, customized: true };
            return next;
        });
    };

    useEffect(() => {
        const socket = io(window.location.origin, { path: '/socket.io' });
        socket.on('support_queries_updated', () => {
            fetchQueries({ background: true });
        });
        return () => socket.disconnect();
    }, []);

    const fetchQueries = async ({ background = false } = {}) => {
        if (!background) setQueryLoading(true);
        try {
            const res = await axios.get('/api/queries', { withCredentials: true });
            setQueries(res.data || []);
        } catch (err) {
            console.error('Fetch queries failed:', err);
            setQueryError('Unable to load support queries.');
        } finally {
            if (!background) setQueryLoading(false);
        }
    };

    const openQueryModal = async () => {
        setQueryError('');
        if (queries.length === 0) {
            await fetchQueries();
        } else {
            fetchQueries({ background: true });
        }
        setQueryModalOpen(true);
    };

    const toggleQueryDetails = async (queryId) => {
        const query = queries.find((q) => q.id === queryId);
        const isOpening = expandedQueryId !== queryId;

        setExpandedQueryId((prev) => (prev === queryId ? null : queryId));
        setReplyingQueryId(null);

        if (isOpening && query && query.status === 'new') {
            // Optimistically update status to 'read' locally
            setQueries((prev) => prev.map((q) => (q.id === queryId ? { ...q, status: 'read' } : q)));
            try {
                await axios.patch(`/api/queries/${queryId}/read`, {}, { withCredentials: true });
            } catch (err) {
                console.error('Failed to mark query as read:', err);
                // Rollback status to 'new' on failure
                setQueries((prev) => prev.map((q) => (q.id === queryId ? { ...q, status: 'new' } : q)));
            }
        }
    };

    const hasUnreadQueries = queries.some((q) => q.status === 'new');

    const handleReplyChange = (queryId, value) => {
        setReplyDrafts((prev) => ({ ...prev, [queryId]: value }));
    };

    const sendReply = async (queryId) => {
        const message = replyDrafts[queryId];
        if (!message || !message.trim()) {
            showToast('Reply message cannot be empty.', 'error');
            return;
        }

        const query = queries.find((q) => q.id === queryId);
        const expectedLastReplyAt = query ? query.reply_at : null;

        setReplySending((prev) => ({ ...prev, [queryId]: true }));
        try {
            await axios.post(
                `/api/queries/${queryId}/reply`,
                { reply: message, expectedLastReplyAt },
                { withCredentials: true }
            );
            showToast('Reply sent to user successfully.');
            fetchQueries();
            setReplyDrafts((prev) => ({ ...prev, [queryId]: '' }));
            setReplyingQueryId(null);
        } catch (err) {
            console.error('Send reply failed:', err);
            if (err.response?.status === 409) {
                showToast(err.response.data.error || 'This query has been updated by another admin. Refreshing...', 'error');
                fetchQueries();
            } else {
                showToast('Unable to send reply. Please try again.', 'error');
            }
        } finally {
            setReplySending((prev) => ({ ...prev, [queryId]: false }));
        }
    };

    const handleDeleteQuery = async (queryId) => {
        if (!window.confirm('Are you sure you want to delete this query from the admin panel?')) return;
        try {
            await axios.delete(`/api/queries/${queryId}`, { withCredentials: true });
            showToast('Query deleted successfully.');
            setQueries((prev) => prev.filter((q) => q.id !== queryId));
            if (expandedQueryId === queryId) {
                setExpandedQueryId(null);
            }
        } catch (err) {
            console.error('Delete query failed:', err);
            showToast('Unable to delete query. Please try again.', 'error');
        }
    };

    const handleClearAllQueries = async () => {
        if (!window.confirm('Are you sure you want to clear all queries from the admin panel? This cannot be undone.')) return;
        try {
            await axios.delete('/api/queries/clear/all', { withCredentials: true });
            showToast('All queries cleared successfully.');
            setQueries([]);
            setExpandedQueryId(null);
        } catch (err) {
            console.error('Clear queries failed:', err);
            showToast('Unable to clear queries. Please try again.', 'error');
        }
    };

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
            ['Event Title', event.title],
            ['Date', formattedDate],
            ['Start Time', formatTime(event.start_time)],
            ['End Time', formatTime(event.end_time)],
            ['Venue', event.venue || '—'],
            ['Category', event.category || 'General'],
            ['Description', event.description || '—'],
            ['Total Attendees', attendees.length],
            [], // blank separator row
            // Attendees header
            ['#', 'Name', 'Email'],
            // Attendee rows
            ...attendees.map((a, i) => [
                i + 1,
                a.name || '—',
                a.email || '—',
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 35 }];

        // Bold event detail labels (column A, rows 0–7)
        for (let r = 0; r < 8; r++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
            if (cell) cell.s = { font: { bold: true } };
        }
        // Bold attendees header row (row 9)
        for (let c = 0; c < 3; c++) {
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
        
        if (formData.event_span === 'multiple') {
            if (subDays.length === 0) {
                showToast('Please select a valid date range for Multiple Days.', 'error');
                return;
            }
            for (let i = 0; i < subDays.length; i++) {
                const d = subDays[i];
                if (!d.start_time || !d.end_time) {
                    showToast(`Please specify start and end times for Day ${d.dayNumber}.`, 'error');
                    return;
                }
                if (d.end_time <= d.start_time) {
                    showToast(`End time must be strictly after start time on Day ${d.dayNumber} (${d.date}).`, 'error');
                    return;
                }
                if (d.attendees.length === 0) {
                    showToast(`At least one guest must be invited for Day ${d.dayNumber}.`, 'error');
                    return;
                }
            }
        } else {
            if (attendees.length === 0) {
                showToast('At least one guest must be invited.', 'error');
                return;
            }
            if (formData.end_time <= formData.start_time) {
                showToast('End time must be strictly after start time.', 'error');
                return;
            }
        }

        setSubmitting(true);
        try {
            await axios.post('/api/events', { ...formData, attendees, days: subDays });
            setFormData({ title: '', description: '', venue: '', event_date: '', end_date: '', start_time: '00:00', end_time: '00:00', category: 'General', event_span: 'single' });
            setAttendees([]);
            setSubDays([]);
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

    const handleSubDayExcelImport = async (idx, e) => {
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

            // Merge into subDays[idx].attendees
            setSubDays(prev => {
                const next = [...prev];
                const day = next[idx];
                const existing = new Set(day.attendees.map(a => a.email));
                const newOnes = parsed.filter(a => !existing.has(a.email));
                next[idx] = {
                    ...day,
                    attendees: [...day.attendees, ...newOnes],
                    customized: true
                };
                return next;
            });
            e.target.value = '';
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="dashboard-container">
            <Toaster position="top-center" />
            <style>{`
              .rbc-off-range-bg { background-color: #e5e7eb !important; }
              html.dark .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range-bg { background-color: #1a202c !important; }
              html.dark .rbc-month-view .rbc-off-range { color: #9ca3af !important; opacity: 0.8 !important; }
              
              .sub-day-card {
                  border: 1px solid var(--border);
                  border-radius: 12px;
                  padding: 16px;
                  margin-top: 12px;
                  background: var(--bg-muted);
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
              }
              .guest-badge {
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  background: var(--bg-card);
                  border: 1px solid var(--border);
                  border-radius: 8px;
                  padding: 4px 10px;
                  font-size: 12px;
                  color: var(--text-primary);
                  font-weight: 500;
              }
              .guest-badge button {
                  background: none;
                  border: none;
                  color: #ef4444;
                  cursor: pointer;
                  padding: 0;
                  font-size: 13px;
                  display: flex;
                  align-items: center;
              }
            `}</style>
            {previewEvent && <AdminPreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} onDownload={handleDownload} onAttendeesChange={fetchEvents} showToast={showToast} />}
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
            <button
                type="button"
                onClick={openQueryModal}
                className="floating-query-button"
                style={{ zIndex: 10000 }}
                title="Support queries"
            >
                <MessageCircle size={24} />
                {hasUnreadQueries && (
                    <span style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 2px rgba(255,255,255,0.7)' }} />
                )}
            </button>

            {queryModalOpen && (
                <div className="modal-overlay" onClick={() => setQueryModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 22 }}>Support Queries</h2>
                                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>Review messages from users and reply directly.</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {queries.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearAllQueries}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            background: 'transparent',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8,
                                            padding: '6px 12px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.color = '#ef4444';
                                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                                            e.currentTarget.style.background = 'rgba(239,68,68,0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <Trash2 size={13} />
                                        Clear All
                                    </button>
                                )}
                                <button onClick={() => setQueryModalOpen(false)} className="icon-button">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {queryLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>Loading queries...</div>
                        ) : queryError ? (
                            <div style={{ color: '#dc2626', padding: 20 }}>{queryError}</div>
                        ) : queries.length === 0 ? (
                            <div style={{ padding: 20, color: 'var(--text-secondary)' }}>No support queries yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {queries.map((query) => {
                                    const expanded = expandedQueryId === query.id;
                                    return (
                                        <div key={query.id} className="floating-card" style={{ padding: 18, borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{query.subject || 'No subject'}</p>
                                                    <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>{query.user_name || 'Anonymous'} · {query.user_email}</p>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    {query.status === 'new' ? (
                                                        <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: 6 }}>New</span>
                                                    ) : query.status === 'answered' ? (
                                                        <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', background: 'rgba(22,163,74,0.08)', padding: '2px 8px', borderRadius: 6 }}>Answered</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 6 }}>Read</span>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteQuery(query.id)}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            padding: '6px',
                                                            cursor: 'pointer',
                                                            color: 'var(--text-secondary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s',
                                                        }}
                                                        title="Delete query"
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.color = '#ef4444';
                                                            e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                                            e.currentTarget.style.background = 'transparent';
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleQueryDetails(query.id)}
                                                        style={{
                                                            color: 'var(--text-secondary)',
                                                            fontSize: 12,
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '4px 8px',
                                                            borderRadius: 6,
                                                            fontWeight: 600,
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none'; }}
                                                    >
                                                        {expanded ? 'Hide' : 'View'}
                                                    </button>
                                                </div>
                                            </div>
                                            {expanded && (
                                                <>
                                                    <p style={{ margin: '0 0 12px', color: 'var(--text-primary)', lineHeight: 1.8 }}>{query.message}</p>
                                                    {query.reply_message && (
                                                        <div style={{
                                                            marginTop: 12,
                                                            marginBottom: 16,
                                                            padding: '12px 14px',
                                                            borderRadius: 12,
                                                            background: 'rgba(22, 163, 74, 0.04)',
                                                            border: '1px dashed rgba(22, 163, 74, 0.3)',
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                                                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                                                                    Replied by: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{query.replied_by || 'Admin'}</span>
                                                                </span>
                                                                {query.reply_at && (
                                                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                                                        {new Date(query.reply_at).toLocaleString('en-GB')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                                {query.reply_message}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {replyingQueryId === query.id ? (
                                                        <>
                                                            {query.reply_message && (
                                                                <div style={{
                                                                    display: 'flex',
                                                                    alignItems: 'flex-start',
                                                                    gap: 8,
                                                                    background: 'rgba(234, 179, 8, 0.06)',
                                                                    border: '1px solid rgba(234, 179, 8, 0.3)',
                                                                    borderRadius: 10,
                                                                    padding: '10px 12px',
                                                                    marginBottom: 10,
                                                                    fontSize: 13,
                                                                    color: '#a16207',
                                                                    lineHeight: 1.5
                                                                }}>
                                                                    <span style={{ fontSize: 15, marginTop: -2 }}>⚠️</span>
                                                                    <span>
                                                                        This query was already answered by <strong>{query.replied_by || 'another admin'}</strong>. Sending a new reply will overwrite their response.
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <textarea
                                                                value={replyDrafts[query.id] ?? ''}
                                                                onChange={(e) => handleReplyChange(query.id, e.target.value)}
                                                                placeholder="Write a reply..."
                                                                rows={4}
                                                                className="custom-input"
                                                                style={{ resize: 'vertical', minHeight: 95 }}
                                                            />
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 10 }}>
                                                                <button
                                                                    type="button"
                                                                    className="btn-secondary"
                                                                    style={{ fontSize: 13, padding: '6px 14px', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                    onClick={() => setReplyingQueryId(null)}
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn-primary"
                                                                    style={{ fontSize: 13, padding: '6px 16px', height: 34, width: 'auto', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                    onClick={() => sendReply(query.id)}
                                                                    disabled={replySending[query.id]}
                                                                >
                                                                    {replySending[query.id] ? 'Sending...' : 'Send Reply'}
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                                            <button
                                                                type="button"
                                                                className="btn-secondary"
                                                                style={{ fontSize: 13, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                                                                onClick={() => {
                                                                    setReplyingQueryId(query.id);
                                                                    if (query.reply_message && !replyDrafts[query.id]) {
                                                                        setReplyDrafts(prev => ({ ...prev, [query.id]: query.reply_message }));
                                                                    }
                                                                }}
                                                            >
                                                                {query.reply_message ? <Pencil size={14} /> : <MessageCircle size={14} />}
                                                                {query.reply_message ? 'Edit Reply' : 'Reply'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                {/* 1. Title */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <input 
                                        type="text" 
                                        placeholder="Event Title" 
                                        className="custom-input" 
                                        value={formData.title} 
                                        onChange={e => setFormData({ ...formData, title: e.target.value })} 
                                        required 
                                    />
                                </div>

                                {/* 2. Description (optional) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <textarea 
                                        placeholder="Description" 
                                        className="custom-input" 
                                        style={{ minHeight: '90px', resize: 'none' }} 
                                        value={formData.description} 
                                        onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                    />
                                </div>

                                {/* 3. Event Span */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <select 
                                        className="custom-input" 
                                        style={{ width: '100%' }}
                                        value={formData.event_span} 
                                        onChange={e => setFormData({ ...formData, event_span: e.target.value })}
                                    >
                                        <option value="single">Single Day</option>
                                        <option value="multiple">Multiple Days</option>
                                    </select>
                                </div>

                                {/* 4. Location */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                                            {meetLoading ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>}
                                            {meetLoading ? 'Loading' : 'Meet'}
                                        </button>
                                    </div>
                                </div>

                                {/* 5. Dates */}
                                {formData.event_span === 'single' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <input 
                                            type="date" 
                                            className="custom-input" 
                                            value={formData.event_date} 
                                            onChange={e => setFormData({ ...formData, event_date: e.target.value, end_date: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <input 
                                                type="date" 
                                                className="custom-input" 
                                                value={formData.event_date} 
                                                onChange={e => setFormData({ ...formData, event_date: e.target.value })} 
                                                required 
                                            />
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <input 
                                                type="date" 
                                                className="custom-input" 
                                                value={formData.end_date} 
                                                onChange={e => setFormData({ ...formData, end_date: e.target.value })} 
                                                min={formData.event_date} 
                                                required 
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 6. Times (Defaults/Base) */}
                                <div className="time-row">
                                    <div className="time-field">
                                        <CustomTimeInput
                                            value={formData.start_time}
                                            onChange={(value) => setFormData(prev => ({ ...prev, start_time: value }))}
                                        />
                                    </div>
                                    <span className="time-row-divider" style={{ alignSelf: 'center', marginTop: '0px' }}>→</span>
                                    <div className="time-field">
                                        <CustomTimeInput
                                            value={formData.end_time}
                                            onChange={(value) => setFormData(prev => ({ ...prev, end_time: value }))}
                                        />
                                    </div>
                                </div>

                                {/* 7. Category */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tag size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <select className="custom-input" style={{ flex: 1 }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '5px 0' }} />

                                {/* 8. Attendees List (Main) */}
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
                                            <input type="email" placeholder="Guest Email" className="custom-input" style={{ flex: 1 }} value={currentAttendee.email} onChange={e => setCurrentAttendee({ ...currentAttendee, email: e.target.value.toLowerCase() })} />
                                            <button type="button" className="btn-secondary" onClick={handleAddAttendee}><UserPlus size={18} /></button>
                                        </div>
                                    </div>

                                    {attendees.length > 0 && (
                                        <button type="button" className="btn-secondary" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 13 }} onClick={() => setShowAttendeesModal(true)}>
                                            <UserPlus size={15} /> View {attendees.length} Guest{attendees.length > 1 ? 's' : ''} Added
                                        </button>
                                    )}
                                </div>

                                {/* 9. Sub forms (only for Multiple Days) */}
                                {formData.event_span === 'multiple' && subDays.length > 0 && (
                                    <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 10px', color: 'var(--text-primary)' }}>Daily Schedule Details</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                                            {subDays.map((day, idx) => {
                                                const formattedDate = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                                const isExpanded = day.expanded;
                                                return (
                                                    <div key={day.date} className="sub-day-card" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', background: 'var(--bg-muted)' }}>
                                                        {/* Collapsed Header */}
                                                        <div 
                                                            onClick={() => {
                                                                setSubDays(prev => {
                                                                    const next = [...prev];
                                                                    next[idx] = { ...next[idx], expanded: !next[idx].expanded };
                                                                    return next;
                                                                });
                                                            }}
                                                            style={{ 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between', 
                                                                alignItems: 'center', 
                                                                cursor: 'pointer',
                                                                userSelect: 'none'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                                    {isExpanded ? '▼' : '▶'}
                                                                </span>
                                                                <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                                                                    📅 Day {day.dayNumber} - {formattedDate}
                                                                </span>
                                                                {day.title && (
                                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        ({day.title})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                                {isExpanded ? 'Collapse' : 'Expand & Edit'}
                                                            </span>
                                                        </div>

                                                        {/* Expanded Form Fields */}
                                                        {isExpanded && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                                                {/* Sub Day Title */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder={`Day ${day.dayNumber} Title`} 
                                                                        className="custom-input" 
                                                                        value={day.title} 
                                                                        onChange={e => updateSubDay(idx, 'title', e.target.value)} 
                                                                        required 
                                                                    />
                                                                </div>

                                                                {/* Sub Day Description */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    <textarea 
                                                                        placeholder={`Day ${day.dayNumber} Description`} 
                                                                        className="custom-input" 
                                                                        style={{ minHeight: '60px', resize: 'none' }} 
                                                                        value={day.description} 
                                                                        onChange={e => updateSubDay(idx, 'description', e.target.value)} 
                                                                    />
                                                                </div>

                                                                {/* Sub Day Times */}
                                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                                                                    <div style={{ flex: 1 }}>
                                                                        <CustomTimeInput
                                                                            value={day.start_time}
                                                                            onChange={(value) => updateSubDay(idx, 'start_time', value)}
                                                                            compact={true}
                                                                        />
                                                                    </div>
                                                                    <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-muted)', userSelect: 'none', position: 'relative', top: '-6px' }}>→</span>
                                                                    <div style={{ flex: 1 }}>
                                                                        <CustomTimeInput
                                                                            value={day.end_time}
                                                                            onChange={(value) => updateSubDay(idx, 'end_time', value)}
                                                                            compact={true}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Sub Day Attendees Section */}
                                                                <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                                                        <label style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-primary)' }}>Invite Guests</label>
                                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                            {/* Import Excel */}
                                                                            <div className="tooltip-wrap">
                                                                                <label className="btn-secondary" style={{ cursor: 'pointer', padding: '4px 8px', fontSize: '11px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <FileSpreadsheet size={12} />
                                                                                    Import Excel
                                                                                    <input
                                                                                        type="file"
                                                                                        accept=".xlsx,.xls"
                                                                                        style={{ display: 'none' }}
                                                                                        onChange={(e) => handleSubDayExcelImport(idx, e)}
                                                                                    />
                                                                                </label>
                                                                                <span className="tooltip-text">Columns: name, email</span>
                                                                            </div>

                                                                            {idx === 0 && attendees.length > 0 && (
                                                                                <button 
                                                                                    type="button" 
                                                                                    className="btn-secondary" 
                                                                                    style={{ fontSize: '10px', padding: '3px 8px', height: 'auto' }}
                                                                                    onClick={() => {
                                                                                        updateSubDay(idx, 'attendees', [...day.attendees, ...attendees]);
                                                                                    }}
                                                                                >
                                                                                    Copy Main Guests
                                                                                </button>
                                                                            )}
                                                                            {idx > 0 && subDays[idx - 1].attendees.length > 0 && (
                                                                                <button 
                                                                                    type="button" 
                                                                                    className="btn-secondary" 
                                                                                    style={{ fontSize: '10px', padding: '3px 8px', height: 'auto' }}
                                                                                    onClick={() => {
                                                                                        updateSubDay(idx, 'attendees', [...day.attendees, ...subDays[idx - 1].attendees]);
                                                                                    }}
                                                                                >
                                                                                    Copy Day {idx} Guests
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                                                                        <div className="attendee-input-row" style={{ display: 'flex', gap: '6px' }}>
                                                                            <input 
                                                                                type="text" 
                                                                                placeholder="Guest Name" 
                                                                                className="custom-input" 
                                                                                style={{ flex: 1, height: '34px', fontSize: '12px' }} 
                                                                                value={day.currentAttendee?.name || ''} 
                                                                                onChange={e => updateSubDayCurrentAttendee(idx, 'name', e.target.value)} 
                                                                            />
                                                                                <input 
                                                                                type="email" 
                                                                                placeholder="Guest Email" 
                                                                                className="custom-input" 
                                                                                style={{ flex: 1, height: '34px', fontSize: '12px' }} 
                                                                                value={day.currentAttendee?.email || ''} 
                                                                                onChange={e => updateSubDayCurrentAttendee(idx, 'email', e.target.value.toLowerCase())} 
                                                                            />
                                                                            <button 
                                                                                type="button" 
                                                                                className="btn-secondary" 
                                                                                style={{ height: '34px', padding: '0 10px' }}
                                                                                onClick={() => addSubDayAttendee(idx)}
                                                                            >
                                                                                <UserPlus size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Sub Day Attendee Badges List */}
                                                                    {day.attendees && day.attendees.length > 0 && (
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                                                            {day.attendees.map((att, attIdx) => (
                                                                                <div key={attIdx} className="guest-badge">
                                                                                    <span>{att.name} ({att.email})</span>
                                                                                    <button 
                                                                                        type="button" 
                                                                                        onClick={() => removeSubDayAttendee(idx, attIdx)}
                                                                                        title="Remove guest"
                                                                                    >
                                                                                        ×
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
                                        events={toCalendarEvents(unrollEvents(events).filter(e => {
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
                                            
                                            const now = new Date();
                                            const isPast = now > e.end;
                                            const isLive = now >= e.start && now <= e.end;
                                            
                                            let className = '';
                                            if (isLive) className = 'event-live';

                                            return { className, style: { backgroundColor: c?.color || '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 } };
                                        }}
                                        components={{ toolbar: (props) => <CustomCalendarToolbar {...props} setCalendarDate={setCalendarDate} /> }}
                                        style={{ height: '100%' }}
                                    />
                                </div>
                            ) : (
                                <div className="schedule-list">
                                    {(() => {
                                        const now = new Date();
                                        const filtered = groupMultiDaySpans(events).filter(e => {
                                             const date = e.event_date.slice(0, 10);
                                             const endDate = e.end_date ? e.end_date.slice(0, 10) : date;
                                             const [sH, sM] = e.start_time.split(':');
                                             const [eH, eM] = e.end_time.split(':');
                                             const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
                                             const end = new Date(endDate); end.setHours(+eH, +eM, 0, 0);
                                             const tabMatch = activeTab === 'upcoming' ? now < start : activeTab === 'live' ? now >= start && now <= end : end < now;
                                             const searchMatch = !search || e.title.toLowerCase().startsWith(search.toLowerCase());
                                             const dateMatch = !filterDate || (filterDate >= date && filterDate <= endDate);
                                             const catMatch = !filterCategory || (e.category || 'General').toLowerCase() === filterCategory.toLowerCase();
                                             return tabMatch && searchMatch && dateMatch && catMatch;
                                         }).sort((a, b) => {
                                             const dateA = a.event_date.slice(0, 10);
                                             const endDateA = a.end_date ? a.end_date.slice(0, 10) : dateA;
                                             const [sHa, sMa] = a.start_time.split(':');
                                             const startA = new Date(dateA); startA.setHours(+sHa, +sMa, 0, 0);
                                             const endA = new Date(endDateA); endA.setHours(+a.end_time.split(':')[0], +a.end_time.split(':')[1], 0, 0);
                                             
                                             const dateB = b.event_date.slice(0, 10);
                                             const endDateB = b.end_date ? b.end_date.slice(0, 10) : dateB;
                                             const [sHb, sMb] = b.start_time.split(':');
                                             const startB = new Date(dateB); startB.setHours(+sHb, +sMb, 0, 0);
                                             const endB = new Date(endDateB); endB.setHours(+b.end_time.split(':')[0], +b.end_time.split(':')[1], 0, 0);
                                             
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
                                                    <EventCard key={item._listKey || item.event_id} event={item} onDelete={activeTab !== 'live' ? handleDelete : null} onEdit={activeTab !== 'live' ? setEditEvent : null} onPreview={setPreviewEvent} tab={activeTab} darkMode={darkMode} />
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