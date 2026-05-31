import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, ArrowLeft, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import CalendarScheduleSvg from '../assets/calendar-schedule.svg';
import moonSvg from '../assets/moon.svg';
import sunSvg from '../assets/sun.svg';

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
        const msg = res.data.message || 'If an account exists, a reset link has been sent.';
        setMessage(msg);
        toast.success(msg);
      } else {
        const errMsg = res.data.message || 'An error occurred.';
        setError(errMsg);
        toast.error(errMsg);
      }
    } catch (err) {
      if (err.response?.data?.isGoogleAccount) {
        alert(err.response.data.message);
        navigate('/');
      } else {
        const errMsg = err.response?.data?.message || 'Something went wrong. Please try again.';
        setError(errMsg);
        toast.error(errMsg);
      }
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

        <div className="flex justify-center mb-6">
          <img src={CalendarScheduleSvg} alt="Calendar Schedule" style={{ width: '56px', height: '56px' }} />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            Forgot Password
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />

          <button type="submit" className="flex justify-center items-center gap-2 w-full py-3 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed" disabled={isLoading || message}>
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

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

export default ForgotPassword;
