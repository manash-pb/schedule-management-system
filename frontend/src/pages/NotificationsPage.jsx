import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getAuthData } from '../utils/authStorage';
import { Trash2, Bell, ArrowLeft, Paperclip } from 'lucide-react';

const NotificationsPage = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
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
    }, []);

    const handleDeleteNotification = async (id) => {
        try {
            await axios.delete(`/api/notifications/${id}`, { withCredentials: true });
            fetchNotifications();
            // Optional: emit an event so Layout can also fetch new notifications
            window.dispatchEvent(new Event('storage'));
        } catch (e) {
            console.error("Failed to delete notification", e);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
            <button 
                onClick={() => navigate(-1)} 
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
                                    {notif.attachment && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <a href={notif.attachment} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                <Paperclip size={14} />
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notif.attachmentName || 'Attachment'}</span>
                                            </a>
                                        </div>
                                    )}
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notif.time}</span>
                                </div>
                                {role === 'admin' && (
                                    <button 
                                        onClick={() => handleDeleteNotification(notif.id)} 
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
