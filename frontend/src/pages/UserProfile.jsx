import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, LogOut, Edit2, Camera, Check, X } from 'lucide-react';

const UserProfile = () => {
    const navigate = useNavigate();

    // Safely grab user data from localStorage
    const [userName, setUserName] = useState(localStorage.getItem('userName') || 'User');
    const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || 'Not provided');
    const [userPic, setUserPic] = useState(localStorage.getItem('userPicture') || '');
    const userRole = localStorage.getItem('userRole') || 'user';

    // UI Toggle States
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(userName);

    const handleLogout = () => {
        // 1. Remove ONLY the authentication data (leave darkMode alone!)
        localStorage.removeItem('isAdminLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userPicture');

        // 2. Force a full browser reload to clear React's internal cache
        // This stops the "bouncing back to login" bug dead in its tracks.
        window.location.href = '/';
    };

    const goBack = () => {
        navigate(userRole === 'admin' ? '/admin-dashboard' : '/user-dashboard');
    };

    const saveName = () => {
        setUserName(tempName);
        setIsEditingName(false);
        // Note: You will eventually add an axios.patch() here to save to MySQL
        localStorage.setItem('userName', tempName);
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-wrapper">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 30, paddingTop: 10 }}>
                    <button onClick={goBack} className="btn-icon" style={{ padding: 8 }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: 24 }}>My Profile</h2>
                </div>

                <div className="form-container">
                    <div style={{ maxWidth: 450, margin: '0 auto' }}>

                        {/* 1. Avatar Section */}
                        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 30px auto' }}>
                            {userPic ? (
                                <img src={userPic} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 'bold', border: '3px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                            )}

                            {/* Avatar Edit Icon */}
                            <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#2563eb', color: 'white', padding: 8, borderRadius: '50%', cursor: 'pointer', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Camera size={16} />
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => alert("Image upload functionality coming soon!")} />
                            </label>
                        </div>

                        {/* 2. Details Modal/Card */}
                        <div className="floating-card" style={{ padding: '24px', textAlign: 'left', marginBottom: '24px' }}>

                            {/* Name Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                <div style={{ flex: 1 }}>
                                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</span>
                                    {isEditingName ? (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <input type="text" className="custom-input" value={tempName} onChange={e => setTempName(e.target.value)} autoFocus />
                                            <button onClick={saveName} className="btn-icon" style={{ color: '#16a34a', background: '#dcfce7' }}><Check size={18} /></button>
                                            <button onClick={() => setIsEditingName(false)} className="btn-icon" style={{ color: '#ef4444', background: '#fee2e2' }}><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{userName}</span>
                                    )}
                                </div>
                                {!isEditingName && (
                                    <button onClick={() => setIsEditingName(true)} className="btn-icon"><Edit2 size={18} color="#64748b" /></button>
                                )}
                            </div>

                            {/* Email Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</span>
                                    <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{userEmail}</span>
                                </div>
                                <button onClick={() => alert("Email cannot be changed directly.")} className="btn-icon"><Edit2 size={18} color="#64748b" /></button>
                            </div>

                            {/* Role Row (Read Only) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Shield size={18} color="var(--text-muted)" />
                                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{userRole} Account</span>
                            </div>
                        </div>

                        {/* 3. Logout Button */}
                        <button
                            onClick={handleLogout}
                            onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', background: '#ef4444', border: '2px solid #ef4444', borderRadius: 10, height: 46, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <LogOut size={18} /> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;