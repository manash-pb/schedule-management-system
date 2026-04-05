import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, LogOut, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UserDashboard = () => {
    const [events, setEvents] = useState([]);
    const navigate = useNavigate();

    // Retrieve stored user info
    const userEmail = localStorage.getItem('userEmail'); 
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName') || 'User';

    const fetchEvents = async () => {
        try {
            // Pass email and role to the backend for filtering
            const res = await axios.get(`/api/events?email=${userEmail}&role=${userRole}`);
            setEvents(res.data);
        } catch (e) { 
            console.error("Failed to fetch your specific schedule:", e); 
        }
    };

    useEffect(() => { 
        if (userEmail) {
            fetchEvents();
        } else {
            navigate('/'); // Redirect if session data is missing
        }
    }, [userEmail]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        const [hours, minutes] = timeStr.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', width: '100%' }}>
                    <h2 style={{ margin: 0 }}>Welcome, {userName}</h2>
                    <button onClick={handleLogout} className="btn-secondary">
                        <LogOut size={16} /> Logout
                    </button>
                </div>

                <div className="main-content" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="list-container">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                            <Calendar size={24} color="#2563eb" /> Your Upcoming Schedule
                        </h2>
                        
                        <div className="schedule-list">
                            {events.length === 0 ? (
                                <div className="empty-state-card">No meetings assigned to you yet.</div>
                            ) : (
                                events.map((event) => (
                                    <div className="event-card" key={event.id || event.event_id}>
                                        <div className="event-info">
                                            <span className="status-badge">Confirmed</span>
                                            <h3 className="event-title">{event.title}</h3>
                                            <p className="event-description">{event.description}</p>
                                            <div className="event-meta">
                                                <div className="meta-item">
                                                    <Calendar size={14} className="text-blue" />
                                                    <span>{new Date(event.event_date).toLocaleDateString()}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <Clock size={14} className="text-blue" />
                                                    <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                                                </div>
                                                <div className="meta-item venue">
                                                    <MapPin size={14} />
                                                    <span>{event.venue}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;