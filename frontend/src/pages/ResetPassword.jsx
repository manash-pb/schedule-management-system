import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Sun, Moon, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid or missing reset token.');
        setIsVerifying(false);
        return;
      }
      try {
        const res = await axios.get(`/api/auth/verify-reset-token/${token}`);
        if (res.data.valid) {
          setIsValidToken(true);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid or expired token.');
      } finally {
        setIsVerifying(false);
      }
    };
    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await axios.post('/api/auth/reset-password', { token, newPassword });

      if (res.data.success) {
        setMessage('Password has been successfully reset. You can now log in.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(res.data.message || 'An error occurred.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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

        {isVerifying ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: 'var(--text-muted)' }}>
              <Lock size={48} />
            </div>
            <h1 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', fontSize: '2rem' }}>Verifying Link</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Please wait a moment...</p>
          </>
        ) : !isValidToken ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '24px'
              }}
            >
              <div
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background:
                    'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                  border: '1px solid rgba(239,68,68,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  boxShadow: '0 10px 30px rgba(239,68,68,0.15)'
                }}
              >
                <Lock size={42} />
              </div>
            </div>

            <h1
              style={{
                margin: '0 0 12px',
                color: 'var(--text-primary)',
                fontSize: '2rem',
                fontWeight: 700
              }}
            >
              Reset Link Expired
            </h1>

            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '15px',
                lineHeight: '1.7',
                marginBottom: '24px',
                maxWidth: '380px',
                marginInline: 'auto'
              }}
            >
              This password reset link is no longer valid.
              It may have already been used or has expired.
            </p>

            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '24px',
                color: '#ef4444',
                fontSize: '14px'
              }}
            >
              For security reasons, password reset links can only be used once.
            </div>

            <button
              onClick={() => navigate('/forgot-password')}
              className="btn-primary"
              style={{
                width: '100%'
              }}
            >
              Request New Reset Link
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: '#10b981' }}>
              <Lock size={48} />
            </div>

            <h1 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', fontSize: '2rem' }}>
              Create New Password
            </h1>
            <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '14px' }}>
              Enter a strong new password for your account.
            </p>

            {message && (
              <div style={{ padding: '12px', background: '#d1fae5', color: '#065f46', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #a7f3d0' }}>
                {message}
              </div>
            )}

            {error && !message && (
              <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}

            {!message && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New Password"
                    className="custom-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    style={{ textAlign: 'center', paddingRight: '42px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm New Password"
                    className="custom-input"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    style={{ textAlign: 'center', paddingRight: '42px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading}>
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}
          </>
        )
        }

        <div style={{ marginTop: '25px' }}>
          <button onClick={() => navigate('/')} className="btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={16} /> Back to Login
          </button>
        </div>

      </div >
    </div >
  );
};

export default ResetPassword;
