import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';

const PostNotification = () => {
    const navigate = useNavigate();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) {
            toast.error("Message is required.");
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('subject', subject);
        formData.append('message', message);
        if (attachment) {
            formData.append('attachment', attachment);
        }

        try {
            await axios.post('/api/notifications', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            toast.success("Notification posted successfully!");
            navigate('/notifications'); // go to the list page after posting
        } catch (error) {
            console.error("Error posting notification:", error);
            toast.error("Failed to post notification.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
            <button 
                onClick={() => navigate(-1)} 
                className="btn-secondary" 
                style={{ marginBottom: '20px', padding: '8px 16px', fontSize: '14px' }}
            >
                <ArrowLeft size={16} /> Back
            </button>
            <div className="floating-card">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <Bell color="#2563eb" /> Post a Notification
                </h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Subject (Optional)</label>
                        <input 
                            type="text" 
                            className="custom-input" 
                            placeholder="Enter subject..." 
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Message</label>
                        <textarea 
                            className="custom-input" 
                            placeholder="Enter your notification message..." 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            style={{ minHeight: '120px', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Attachment (Optional)</label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="file" 
                                id="attachment"
                                style={{ display: 'none' }}
                                onChange={(e) => setAttachment(e.target.files[0])}
                            />
                            <label 
                                htmlFor="attachment" 
                                className="btn-secondary" 
                                style={{ display: 'inline-flex', cursor: 'pointer', gap: '8px' }}
                            >
                                <Paperclip size={16} />
                                {attachment ? attachment.name : "Choose File"}
                            </label>
                            {attachment && (
                                <span 
                                    style={{ marginLeft: '12px', fontSize: '13px', color: '#ef4444', cursor: 'pointer' }}
                                    onClick={() => setAttachment(null)}
                                >
                                    Remove
                                </span>
                            )}
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        style={{ marginTop: '10px' }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Posting..." : "Post Notification"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PostNotification;
