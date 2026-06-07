import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Shield, ArrowLeft, LogOut, Edit2, Upload, Trash2, Check, X, Camera } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';
import { getAuthData, clearAuthData } from '../utils/authStorage';

const updateStorage = (key, value) => {
    if (localStorage.getItem('isAdminLoggedIn')) localStorage.setItem(key, value);
    else if (sessionStorage.getItem('isAdminLoggedIn')) sessionStorage.setItem(key, value);
};

const removeStorage = (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
};

const UserProfile = () => {
    const navigate = useNavigate();

    const [userName, setUserName] = useState(getAuthData('userName') || 'User');
    const [userEmail, setUserEmail] = useState(getAuthData('userEmail') || 'Not provided');
    const [userPic, setUserPic] = useState(getAuthData('userPicture'));
    const [showPicOptions, setShowPicOptions] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fileInputRef = useRef(null);
    const userRole = getAuthData('userRole') || 'user';

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(userName);

    const profileImageExists = userPic && userPic !== 'null' && userPic !== 'undefined' && userPic.includes('/uploads/');

    // Watch for dark mode changes
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const menuBackground = isDarkMode ? '#1f2937' : '#ffffff';
    const menuBorder = isDarkMode ? '1px solid #374151' : '1px solid #e2e8f0';
    const menuTextColor = isDarkMode ? '#f8fafc' : '#111827';
    const menuSubTextColor = isDarkMode ? '#9ca3af' : '#64748b';
    const menuHeaderBg = isDarkMode ? '#111827' : '#f9fafb';
    const menuHeaderBorder = isDarkMode ? '#1f2937' : '#f3f4f6';
    const menuHoverBg = isDarkMode ? '#111827' : '#f8fafc';
    const editIconBg = isDarkMode ? '#4b5563' : '#ffffff';
    const editIconColor = isDarkMode ? '#e5e7eb' : '#2563eb';
    const editIconBorder = isDarkMode ? '1px solid #6b7280' : '1px solid rgba(37,99,235,0.25)';

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

    const triggerFileSelect = () => {
        setShowPicOptions(false);
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleDeleteImage = async () => {
        if (!profileImageExists) return;

        try {
            const res = await axios.post('/api/users/delete-pic', { email: userEmail });
            if (res.data.success) {
                removeStorage('userPicture');

                window.dispatchEvent(new Event("storage"));

                setUserPic(null);
                setShowPicOptions(false);
                setShowDeleteConfirm(false);
                setImage(null);
                toast.success('Profile picture removed');
            } else {
                toast.error(res.data.message || 'Could not delete image');
            }
        } catch (e) {
            console.error('Delete profile pic error:', e);
            toast.error('Delete failed');
        }
    };

    const handleConfirmDelete = () => {
        handleDeleteImage();
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

            // 1. Update the local storage
            updateStorage('userPicture', newUrl);

            // 2. SHOUT to the Layout.jsx that things have changed
            window.dispatchEvent(new Event("storage"));

            // 3. Update the local state to show the change in UserProfile
            setUserPic(newUrl);
            setImage(null); // Close the cropper modal
            toast.success('Profile updated!', { id: toastId });

            // --- REMOVED: window.location.reload() ---
            // We don't need the refresh anymore!

        } catch (e) {
            console.error(e);
            toast.error('Upload failed', { id: toastId });
        }
    };

    const handleLogout = async () => {
        try { await axios.post('/api/auth/logout'); } catch { /* cookie cleared regardless */ }
        clearAuthData();
        window.location.href = '/';
    };

    const goBack = () => {
        navigate(userRole === 'admin' ? '/admin-dashboard' : '/user-dashboard');
    };

    const saveName = () => {
        setUserName(tempName);
        setIsEditingName(false);
        updateStorage('userName', tempName);
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-wrapper">
                {/* Header Back Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 30, paddingTop: 10 }}>
                    <button onClick={goBack} className="btn-icon" style={{ padding: 8 }}>
                        <ArrowLeft size={20} />
                    </button>
                </div>

                <div className="form-container">
                    <div style={{ maxWidth: 450, margin: '0 auto' }}>

                        {/* Details Modal/Card */}
                        <div className="floating-card" style={{ padding: '32px 24px', textAlign: 'left', marginBottom: '24px', position: 'relative' }}>
                            {/* Header inside Card */}
                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: 'var(--text-primary)' }}>My Profile</h2>
                            </div>

                            {/* 1. Avatar Section moved inside Card */}
                            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 30px auto' }}>
                                {userPic && userPic !== 'null' && userPic !== 'undefined' ? (
                                    <img
                                        src={userPic}
                                        alt="Profile"
                                        style={{
                                            width: '100%', height: '100%',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: `3px solid ${isDarkMode ? '#4b5563' : '#e2e8f0'}`,
                                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)'
                                        }}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            width: '100%', height: '100%',
                                            borderRadius: '50%',
                                            backgroundColor: '#2563eb',
                                            color: '#ffffff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 36, fontWeight: 'bold',
                                            border: `3px solid ${isDarkMode ? '#4b5563' : '#e2e8f0'}`,
                                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)'
                                        }}
                                    >
                                        {userName.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                {/* Avatar Edit Icon */}
                                <div style={{ position: 'absolute', bottom: -5, right: -5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 40 }}>
                                    {showPicOptions && (
                                        <div
                                            onClick={() => setShowPicOptions(false)}
                                            style={{ position: 'fixed', inset: 0, zIndex: 10, cursor: 'default' }}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => profileImageExists ? setShowPicOptions(prev => !prev) : triggerFileSelect()}
                                        style={{
                                            background: isDarkMode ? '#374151' : '#ffffff',
                                            color: isDarkMode ? '#e5e7eb' : '#2563eb',
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            border: isDarkMode ? '1px solid #4b5563' : '1px solid #e2e8f0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                            transition: 'transform 0.2s ease',
                                            zIndex: 20,
                                            position: 'relative',
                                            outline: 'none',
                                            WebkitAppearance: 'none',
                                            appearance: 'none'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        {profileImageExists ? <Edit2 size={14} /> : <Camera size={14} />}
                                    </button>
                                    {showPicOptions && (
                                        <div 
                                            className="absolute transition-opacity duration-200 bg-[var(--bg-card)] border border-[var(--border)] shadow-md rounded-xl ml-2 overflow-hidden" 
                                            style={{ top: '50%', left: '100%', transform: 'translateY(-50%)', width: 190, zIndex: 30 }}
                                            role="menu"
                                        >
                                            <div className="p-2 flex flex-col gap-1">
                                                <button
                                                    type="button"
                                                    onClick={triggerFileSelect}
                                                    className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium transition-colors focus:outline-none flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                                                >
                                                    <Upload size={14} className="text-blue-500 dark:text-blue-400" />
                                                    Upload image
                                                </button>
                                                {profileImageExists && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowDeleteConfirm(true)}
                                                        className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium transition-colors focus:outline-none flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete current image
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={onFileChange}
                                    />
                                </div>
                            </div>

                            {/* Name Row */}
                            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                                <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        {isEditingName ? (
                                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                                <input 
                                                    type="text" 
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                                    value={tempName} 
                                                    onChange={e => setTempName(e.target.value)} 
                                                    autoFocus 
                                                />
                                                <button onClick={saveName} className="btn-icon" style={{ color: '#16a34a', background: '#dcfce7' }}><Check size={18} /></button>
                                                <button onClick={() => setIsEditingName(false)} className="btn-icon" style={{ color: '#ef4444', background: '#fee2e2' }}><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{userName}</span>
                                        )}
                                    </div>
                                    {!isEditingName && (
                                        <button onClick={() => setIsEditingName(true)} className="btn-icon" style={{ marginLeft: 16 }}><Edit2 size={18} color="#64748b" /></button>
                                    )}
                                </div>
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
            {/* --- DELETE CONFIRMATION MODAL --- */}
            {showDeleteConfirm && (
                <div className="modal-overlay" style={{ zIndex: 3000 }}>
                    <div className="modal-card" style={{ maxWidth: 400, height: 'fit-content' }}>
                        <div style={{ padding: '24px', textAlign: 'center' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <Trash2 size={48} color="#ef4444" style={{ margin: '0 auto' }} />
                            </div>
                            <h3 style={{ margin: '16px 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Delete profile picture?</h3>
                            <p style={{ margin: '8px 0 24px', fontSize: 14, color: 'var(--text-muted)' }}>This action cannot be undone. Your profile will display your initial instead.</p>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                                <button onClick={handleConfirmDelete} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', backgroundColor: '#ef4444', color: '#ffffff', borderColor: '#dc2626', marginTop: 0 }}>Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;