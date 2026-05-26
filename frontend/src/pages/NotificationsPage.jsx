import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { getAuthData } from '../utils/authStorage';
import { Trash2, Bell, ArrowLeft, Paperclip } from 'lucide-react';

const NotificationsPage = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const role = getAuthData('userRole') || 'user';
    const email = getAuthData('userEmail');

    const fetchNotifications = async () => {
        if (!email) return;
        try {
            const res = await axios.get('/api/notifications', { params: { email }, withCredentials: true });
            setNotifications(res.data);
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // 2. CONNECT TO SOCKET.IO SERVER
        const socket = io(window.location.origin, {
            path: '/socket.io',
            withCredentials: true // Needed because of HttpOnly cookies!
        });

        // 3. LISTEN FOR NEW NOTIFICATIONS
        socket.on('new_notification_posted', (newNotification) => {
            console.log("Real-time notification received!", newNotification);
            
            // Format the notification to match the UI's expected structure
            const formattedNotif = {
                id: newNotification.id,
                subject: newNotification.subject,
                text: newNotification.message,
                time: new Date().toLocaleString(),
                attachments: [],
                read: false
            };

            // Add the new notification to the TOP of the current list in React State
            setNotifications((prevNotifications) => [formattedNotif, ...prevNotifications]);
        });

        // 4. CLEANUP ON DISCONNECT
        return () => {
            socket.disconnect();
        };
    }, []);

    const confirmDelete = async () => {
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
        try {
            await axios.delete(`/api/notifications/${id}`, { withCredentials: true });
            fetchNotifications();
            window.dispatchEvent(new Event('storage'));
        } catch (e) {
            console.error("Failed to delete notification", e);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>

            {/* Confirmation Modal */}
            {confirmDeleteId && (
                <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={26} color="#ef4444" />
                            </div>
                        </div>
                        <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--text-primary)' }}>Delete Notification?</h2>
                        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            This notification will be permanently removed for all users.
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

            <button 
                onClick={() => navigate(role === 'admin' ? '/admin-dashboard' : '/user-dashboard')} 
                className="btn-secondary" 
                style={{ marginBottom: '20px', padding: '8px 16px', fontSize: '14px' }}
            >
                <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <div className="floating-card">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <Bell color="#2563eb" /> All Notifications
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {notifications.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No notifications found.</p>
                    ) : (
                        notifications.map(notif => (
                            <div key={notif.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ flex: 1, paddingRight: '10px' }}>
                                    <p style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--text-primary)' }}>{notif.text}</p>
                                    {notif.attachments && notif.attachments.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                            {notif.attachments.map(att => (
                                                <div key={att.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                    <Paperclip size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                    <a href={att.url} target="_blank" rel="noreferrer" className="attachment-link" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {att.name || 'Attachment'}
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notif.time}</span>
                                </div>
                                {role === 'admin' && (
                                    <button 
                                        onClick={() => setConfirmDeleteId(notif.id)} 
                                        className="btn-icon delete" 
                                        style={{ color: '#ef4444' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;
