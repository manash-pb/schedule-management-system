import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft, Paperclip, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthData } from '../utils/authStorage';

const PostNotification = () => {
    const navigate = useNavigate();
    const role = getAuthData('userRole') || 'user';
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState([]); // array of File objects
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files);
        // Merge, avoiding exact duplicates by name+size
        setAttachments(prev => {
            const existingKeys = new Set(prev.map(f => f.name + f.size));
            return [...prev, ...newFiles.filter(f => !existingKeys.has(f.name + f.size))];
        });
        // Reset input so the same file can be re-added after removal
        e.target.value = '';
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) {
            toast.error("Message is required.");
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('message', message);
        attachments.forEach(file => formData.append('attachments', file));

        try {
            await axios.post('/api/notifications', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            toast.success("Notification posted successfully!");
            navigate('/notifications');
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
                onClick={() => navigate(role === 'admin' ? '/admin-dashboard' : '/user-dashboard')} 
                className="btn-secondary" 
                style={{ marginBottom: '20px', padding: '8px 16px', fontSize: '14px' }}
            >
                <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <div className="floating-card">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <Bell color="#2563eb" /> Post a Notification
                </h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>


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

                    {/* Attachments */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            Attachments (Optional)
                        </label>

                        {/* Selected files list */}
                        {attachments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {attachments.map((file, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <Paperclip size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {file.name}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                            {(file.size / 1024).toFixed(1)} KB
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(i)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add more files button */}
                        <div>
                            <input 
                                type="file" 
                                id="attachments"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                            <label 
                                htmlFor="attachments" 
                                className="btn-secondary" 
                                style={{ display: 'inline-flex', cursor: 'pointer', gap: '8px' }}
                            >
                                <Paperclip size={16} />
                                {attachments.length > 0 ? 'Add More Files' : 'Choose Files'}
                            </label>
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
