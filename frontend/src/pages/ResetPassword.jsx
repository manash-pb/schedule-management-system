import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import moonSvg from '../assets/moon.svg';
import sunSvg from '../assets/sun.svg';
import { Lock, Sun, Moon, ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

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
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await axios.post('/api/auth/reset-password', { token, newPassword });

      if (res.data.success) {
        const msg = 'Password has been successfully reset. You can now log in.';
        setMessage(msg);
        toast.success(msg);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const errMsg = res.data.message || 'An error occurred.';
        setError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Something went wrong. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">

      <Toaster position="top-center" reverseOrder={false} />
      {/* Theme Toggle */}
      <div className="fixed top-6 right-6">
        <button
          onClick={() => setDarkMode(d => !d)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-950 hover:bg-blue-900 dark:bg-sky-500 dark:hover:bg-sky-400 border border-blue-900 dark:border-sky-400 rounded-full shadow-sm transition-all text-white"
        >
          <div className="relative w-[22px] h-[22px] flex items-center justify-center">
            <img 
              src={sunSvg} 
              alt="Sun" 
              className={`absolute transition-all duration-500 w-[22px] h-[22px] ${darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} 
            />
            <img 
              src={moonSvg} 
              alt="Moon" 
              className={`absolute transition-all duration-500 w-[18px] h-[18px] ${!darkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'}`} 
            />
          </div>
          <span className="font-medium text-sm w-10 text-left">
            {darkMode ? 'Light' : 'Dark'}
          </span>
        </button>
      </div>

      <div className="w-[90%] max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 transition-colors duration-300">

        {isVerifying ? (
          <>
            <div className="flex justify-center mb-6 text-gray-400 dark:text-gray-500">
              <Loader2 size={48} className="animate-spin" />
            </div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Verifying Link</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Please wait a moment...</p>
            </div>
          </>
        ) : !isValidToken ? (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400 shadow-sm">
                <ShieldAlert size={36} strokeWidth={1.5} />
              </div>
            </div>

            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                Reset Link Expired
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
                This password reset link is no longer valid. It may have already been used or has expired.
              </p>
            </div>


            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all"
            >
              Request New Reset Link
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-6 text-blue-600 dark:text-blue-500">
              <ShieldCheck size={56} strokeWidth={1.5} />
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                Create New Password
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter a strong new password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading || !!message}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="relative w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading || !!message}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                className="flex justify-center items-center gap-2 w-full py-3 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isLoading || !!message}
              >
                {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                {message ? 'Password Reset Successful' : (isLoading ? 'Resetting...' : 'Reset Password')}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Remember your password?
          <button
            onClick={() => navigate('/')}
            className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 transition-colors ml-1"
          >
            Return to login
          </button>
        </p>

      </div>
    </div>
  );
};

export default ResetPassword;
