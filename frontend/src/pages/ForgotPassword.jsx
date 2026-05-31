import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Sun, Moon, ArrowLeft, Mail } from 'lucide-react';

const ForgotPassword = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      
      if (res.data.success) {
        setMessage(res.data.message || 'If an account exists, a reset link has been sent.');
      } else {
        // Handle specific errors like Google Account Only
        setError(res.data.message || 'An error occurred.');
      }
    } catch (err) {
      if (err.response?.data?.isGoogleAccount) {
        alert(err.response.data.message);
        navigate('/');
      } else {
        setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
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

        <h1 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', fontSize: '2rem' }}>
          Forgot Password
        </h1>
        <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '14px' }}>
          Enter your email and we'll send you a link to reset your password.
        </p>

        {message && (
          <div style={{ padding: '12px', background: '#d1fae5', color: '#065f46', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #a7f3d0' }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="email" 
              placeholder="Email Address" 
              className="custom-input" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ paddingLeft: '40px', textAlign: 'left', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} 
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading || message}>
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ marginTop: '25px' }}>
          <button onClick={() => navigate('/')} className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={16} /> Back to Login
          </button>
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;
