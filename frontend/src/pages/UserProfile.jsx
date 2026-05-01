import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Check } from 'lucide-react';

const UserProfile = () => {
    const navigate = useNavigate();
    const userEmail = localStorage.getItem('userEmail');
    const userRole  = localStorage.getItem('userRole');
    const backPath  = userRole === 'admin' ? '/admin-dashboard' : '/user-dashboard';

    const [name, setName] = useState(localStorage.getItem('userName') || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [toast, setToast] = useState(null);
    const [saving, setSaving] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (newPassword && newPassword !== confirmPassword)
            return showToast('New passwords do not match.', 'error');
        setSaving(true);
        try {
            const res = await axios.patch('/api/auth/profile', {
                email: userEmail,
                name,
                currentPassword: newPassword ? currentPassword : undefined,
                newPassword:     newPassword || undefined,
            });
            localStorage.setItem('userName', res.data.name);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            showToast('Profile updated successfully!');
        } catch (e) {
            showToast(e.response?.data?.message || 'Update failed.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="dashboard-container">
            {toast && (
                <div style={{
                    position: 'fixed', top: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    border: `1.5px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`,
                    color: toast.type === 'error' ? '#dc2626' : '#16a34a',
                    padding: '18px 36px', borderRadius: 16, fontWeight: 700, fontSize: 18,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)', whiteSpace: 'nowrap'
                }}>
                    <span style={{ fontSize: 22 }}>{toast.type === 'error' ? '✕' : '✓'}</span>
                    {toast.msg}
                </div>
            )}
            <div className="dashboard-wrapper" style={{ maxWidth: 520 }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', marginBottom: 20 }}>
                    <button onClick={() => navigate(backPath)} className="btn-secondary"><ArrowLeft size={16} /> Back</button>
                </div>
                <div className="floating-card">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 0 }}>
                        <User size={22} color="#2563eb" /> My Profile
                    </h2>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="input-label">Full Name</label>
                            <input className="custom-input" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="input-label">Email</label>
                            <input className="custom-input" value={userEmail} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                        <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 13, fontWeight: 600, color: '#475569' }}>
                            <Lock size={14} /> Change Password <span style={{ fontWeight: 400, color: '#94a3b8' }}>(leave blank to keep current)</span>
                        </p>
                        <input className="custom-input" type="password" placeholder="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                        <input className="custom-input" type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        <input className="custom-input" type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />

                        <button type="submit" className="btn-primary" disabled={saving} style={{ opacity: saving ? 0.8 : 1, width: 'auto', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            {saving ? 'Saving...' : <><Check size={15} /> Save Changes</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
