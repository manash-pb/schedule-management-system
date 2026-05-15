import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Shield, ArrowLeft, LogOut, Edit2, Camera, Check, X } from 'lucide-react';
// 1. New Imports for Cropping
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage'; // Make sure you created this file!

const UserProfile = () => {
    const navigate = useNavigate();

    const [userName, setUserName] = useState(localStorage.getItem('userName') || 'User');
    const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || 'Not provided');
    const [userPic, setUserPic] = useState(localStorage.getItem('userPicture'));
    const userRole = localStorage.getItem('userRole') || 'user';

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(userName);

    // --- 2. New States for Cropping ---
    const [image, setImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // --- 3. Updated Logic Functions ---

    // Triggered when you select a file
    const onFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () => setImage(reader.result));
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const onCropComplete = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    // Triggered when you click "Apply & Upload"
    const handleFinalUpload = async () => {
        const toastId = toast.loading('Processing image...');
        try {
            const croppedImageBlob = await getCroppedImg(image, croppedAreaPixels);
            const file = new File([croppedImageBlob], "profile.jpg", { type: "image/jpeg" });

            const formData = new FormData();
            formData.append('profilePic', file);
            formData.append('email', userEmail);

            toast.loading('Uploading to server...', { id: toastId });
            const res = await axios.post('/api/users/upload-pic', formData);

            const newUrl = res.data.imageUrl;
            setUserPic(newUrl);
            localStorage.setItem('userPicture', newUrl);
            setImage(null); // Close the cropper
            toast.success('Profile updated!', { id: toastId });

            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            console.error(e);
            toast.error('Upload failed', { id: toastId });
        }
    };

    const handleLogout = async () => {
        try { await axios.post('/api/auth/logout'); } catch { /* cookie cleared regardless */ }
        localStorage.removeItem('isAdminLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userPicture');
        localStorage.removeItem('authToken');
        window.location.href = '/';
    };

    const goBack = () => {
        navigate(userRole === 'admin' ? '/admin-dashboard' : '/user-dashboard');
    };

    const saveName = () => {
        setUserName(tempName);
        setIsEditingName(false);
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
                            {userPic && userPic !== 'null' && userPic !== 'undefined' ? (
                                <img
                                    src={userPic}
                                    alt="Profile"
                                    style={{
                                        width: '100%', height: '100%',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1.5px solid var(--bg-card)',
                                        boxShadow: '0 0 0 1.5px #2563eb, 0 0 0 3px var(--bg-card), 0 4px 10px rgba(0, 0, 0, 0.12)'
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '100%', height: '100%',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--bg-muted)',
                                        color: '#2563eb',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 36, fontWeight: 'bold',
                                        border: '1.5px solid var(--bg-card)',
                                        boxShadow: '0 0 0 1.5px #2563eb, 0 0 0 3px var(--bg-card), 0 4px 10px rgba(0, 0, 0, 0.12)'
                                    }}
                                >
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                            )}

                            {/* Avatar Edit Icon */}
                            <label
                                style={{
                                    position: 'absolute',
                                    bottom: -2, right: -4,
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    padding: '5px',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    border: '2px solid var(--bg-card)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                    transition: 'transform 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <Camera size={14} />
                                {/* Change handleImageUpload to onFileChange here */}
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
                            </label>
                        </div>

                        {/* 2. Details Modal/Card */}
                        <div className="floating-card" style={{ padding: '24px', textAlign: 'left', marginBottom: '24px' }}>

                            {/* Name Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                                <div style={{ flex: 1 }}>
                                    <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</span>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</span>
                                    <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{userEmail}</span>
                                </div>
                            </div>

                            {/* Role Row (Read Only) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Shield size={18} color="#94a3b8" />
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b', textTransform: 'capitalize' }}>{userRole} Account</span>
                            </div>
                        </div>

                        {/* 3. Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="btn-secondary"
                            style={{
                                width: '100%',
                                justifyContent: 'center',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                borderColor: '#dc2626',
                                height: 46
                            }}
                        >
                            <LogOut size={18} /> Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* --- 4. THE CROPPING MODAL (Circular Crop) --- */}
            {image && (
                <div className="modal-overlay" style={{ zIndex: 3000 }}>
                    <div className="modal-card" style={{ maxWidth: 500, height: 'fit-content' }}>
                        <div style={{ position: 'relative', width: '100%', height: 350, background: '#000', borderRadius: 12, overflow: 'hidden' }}>
                            <Cropper
                                image={image}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                zoomSpeed={0.2}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>

                        {/* Zoom Slider */}
                        <div style={{ padding: '20px 0', textAlign: 'center' }}>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                onChange={(e) => setZoom(e.target.value)}
                                style={{ width: '100%' }}
                            />
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Scroll or use slider to zoom</p>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setImage(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                            <button onClick={handleFinalUpload} className="btn-primary" style={{ flex: 1, marginTop: 0 }}>Apply & Upload</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;