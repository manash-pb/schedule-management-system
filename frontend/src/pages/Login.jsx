import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, ExternalLink } from 'lucide-react';

const Login = () => {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const navigate = useNavigate();

  // Check if we just returned from Google Login
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    const userRole = urlParams.get('role');

    if (loginStatus === 'success') {
      localStorage.setItem('isAdminLoggedIn', 'true');
      localStorage.setItem('userRole', userRole);
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleManualLogin = async (e) => {
    e.preventDefault();
    const endpoint = isSignUpMode ? '/api/auth/signup' : '/api/auth/manual';
    try {
      const res = await axios.post(endpoint, { 
        name: isSignUpMode ? manualName : undefined,
        email: manualEmail,
        password: manualPassword 
      });
      if (res.data.success) {
        localStorage.setItem('isAdminLoggedIn', 'true');
        localStorage.setItem('userRole', res.data.role);
        navigate('/dashboard');
      }
    } catch (error) {
      alert(isSignUpMode ? 'Sign up failed.' : 'Incorrect email or password.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: '#2563eb' }}><Calendar size={48} /></div>
        <h1 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>{isSignUpMode ? 'Sign Up' : 'Sign In'}</h1>
        <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '14px' }}>{isSignUpMode ? 'Create your account.' : 'Securely manage your schedule.'}</p>

        <form onSubmit={handleManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isSignUpMode && <input type="text" placeholder="Full Name" className="custom-input" value={manualName} onChange={e => setManualName(e.target.value)} required style={{ textAlign: 'center' }} />}
          <input type="email" placeholder="Email Address" className="custom-input" value={manualEmail} onChange={e => setManualEmail(e.target.value)} required style={{ textAlign: 'center' }} />
          <input type="password" placeholder="Password" className="custom-input" value={manualPassword} onChange={e => setManualPassword(e.target.value)} required style={{ textAlign: 'center' }} />
          <button type="submit" className="btn-primary" style={{ width: '100%' }}>{isSignUpMode ? 'Create Account' : 'Sign In'}</button>
        </form>

        <p style={{ fontSize: '14px', color: '#64748b', marginTop: '15px' }}>
          {isSignUpMode ? "Already have an account? " : "New User? "}
          <span onClick={() => setIsSignUpMode(!isSignUpMode)} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 'bold' }}>{isSignUpMode ? 'Login Here' : 'Sign Up Here'}</span>
        </p>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#94a3b8' }}><hr style={{ flex: 1 }} /> OR <hr style={{ flex: 1 }} /></div>
        <a href="http://localhost:3000/auth/google" className="google-btn" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <ExternalLink size={18} /> Sign In with Google
        </a>
      </div>
    </div>
  );
};

export default Login;