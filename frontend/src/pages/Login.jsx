import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, ExternalLink, ShieldCheck, User, Sun, Moon, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [activeTab, setActiveTab] = useState('user');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    const userRole = urlParams.get('role');
    const userEmail = urlParams.get('email');
    const userName = urlParams.get('name');
    const userPicture = urlParams.get('picture'); // 1. Grab the picture from the URL

    if (loginStatus === 'success' && userRole) {
      localStorage.setItem('isAdminLoggedIn', 'true');
      localStorage.setItem('userRole', userRole);
      if (userEmail) localStorage.setItem('userEmail', userEmail);
      if (userName) localStorage.setItem('userName', userName);
      if (userPicture) localStorage.setItem('userPicture', userPicture);

      if (userRole === 'admin') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/user-dashboard';
      }
    }
  }, []);

  const handleManualLogin = async (e) => {
    e.preventDefault();
    const endpoint = isSignUpMode ? '/api/auth/signup' : '/api/auth/manual';

    // Force 'user' role for sign-ups. Otherwise, use the selected tab.
    const payloadRole = isSignUpMode ? 'user' : activeTab;

    try {
      const res = await axios.post(endpoint, {
        name: isSignUpMode ? manualName : undefined,
        email: manualEmail,
        password: manualPassword,
        role: payloadRole
      });

      if (res.data.success) {
        const finalRole = res.data.role || payloadRole;

        localStorage.setItem('isAdminLoggedIn', 'true');
        localStorage.setItem('userRole', finalRole);
        localStorage.setItem('userEmail', res.data.email || manualEmail);
        localStorage.setItem('userName', res.data.name || manualName || 'User');

        // --- NEW: Handle Profile Picture cleanly ---
        if (res.data.profile_picture && res.data.profile_picture !== 'null' && res.data.profile_picture !== 'undefined') {
          localStorage.setItem('userPicture', res.data.profile_picture);
        } else {
          localStorage.removeItem('userPicture'); // Forces the first initial to display
        }

        if (finalRole === 'admin') {
          window.location.href = '/admin-dashboard';
        } else {
          window.location.href = '/user-dashboard';
        }
      }

    } catch (error) {
      alert(isSignUpMode ? 'Sign up failed.' : 'Incorrect email or password.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <button onClick={() => setDarkMode(d => !d)} className="btn-secondary" style={{ minWidth: '100px', justifyContent: 'center' }}>
          <div className="relative w-4 h-4 flex items-center justify-center">
            <Sun size={16} className={`absolute transition-all duration-500 ${darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} />
            <Moon size={16} className={`absolute transition-all duration-500 ${!darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'}`} />
          </div>
          <span style={{ minWidth: '38px', textAlign: 'left' }}>
            {darkMode ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>
      <div className="login-container" style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '520px', width: '90%', border: '1px solid var(--border)' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: '#2563eb' }}>
          <Calendar size={48} />
        </div>

        {/* --- ROLE TABS (Hidden during Sign Up) --- */}
        {!isSignUpMode && (
          <div className="tab-container">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'user' ? 'active' : ''}`}
              onClick={() => setActiveTab('user')}
              style={{ fontSize: '16px' }}
            >
              <User size={18} /> User
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
              style={{ fontSize: '16px' }}
            >
              <ShieldCheck size={18} /> Admin
            </button>
          </div>
        )}

        <h1 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', fontSize: '2rem' }}>
          {isSignUpMode ? 'Sign Up' : `${activeTab === 'admin' ? 'Admin' : 'User'} Sign In`}
        </h1>
        <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '14px' }}>
          {isSignUpMode ? 'Create your user account.' : 'Securely manage your schedule.'}
        </p>

        <form onSubmit={handleManualLogin} autoComplete="on" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isSignUpMode && (
            <input autoComplete="name" type="text" placeholder="Full Name" className="custom-input" value={manualName} onChange={e => setManualName(e.target.value)} required style={{ textAlign: 'center', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
          )}
          <input autoComplete="email" type="email" placeholder="Email Address" className="custom-input" value={manualEmail} onChange={e => setManualEmail(e.target.value)} required style={{ textAlign: 'center', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="custom-input"
              value={manualPassword}
              onChange={e => setManualPassword(e.target.value)}
              required
              style={{ textAlign: 'center', paddingRight: '42px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
            {isSignUpMode ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ fontSize: '14px', color: '#64748b', marginTop: '15px' }}>
          {isSignUpMode ? "Already have an account? " : "New here? "}
          <span onClick={() => {
            setIsSignUpMode(!isSignUpMode);
            if (isSignUpMode) setActiveTab('user'); // Reset to User tab when returning to Login
          }} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 'bold' }}>
            {isSignUpMode ? 'Login Here' : 'Sign Up Here'}
          </span>
        </p>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#94a3b8' }}>
          <hr style={{ flex: 1, borderColor: '#e2e8f0' }} /> <span style={{ padding: '0 10px', fontSize: '12px', fontWeight: '600' }}>OR</span> <hr style={{ flex: 1, borderColor: '#e2e8f0' }} />
        </div>

        {/* Pass 'user' automatically if signing up, otherwise pass the active tab */}
        <a href={`http://localhost:3000/auth/google?role=${isSignUpMode ? 'user' : activeTab}`} className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
          <ExternalLink size={18} color="#2563eb" /> Sign In with Google
        </a>
      </div>
    </div>
  );
};

export default Login;