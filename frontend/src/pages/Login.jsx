import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ExternalLink, ShieldCheck, User, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { setAuthData, getAuthData } from '../utils/authStorage';
import CalendarScheduleSvg from '../assets/calendar-schedule.svg';
import moonSvg from '../assets/moon.svg';
import sunSvg from '../assets/sun.svg';

const Login = () => {
  const [activeTab, setActiveTab] = useState('user');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const loggedIn = getAuthData('isAdminLoggedIn') === 'true';
    if (loggedIn) {
      const role = getAuthData('userRole');
      window.location.href = role === 'admin' ? '/admin-dashboard' : '/user-dashboard';
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    const userRole = urlParams.get('role');
    const userEmail = urlParams.get('email');
    const userName = urlParams.get('name');
    const userPicture = urlParams.get('picture');
    const token = urlParams.get('token');
    const rememberPref = urlParams.get('remember') === '1';

    if (loginStatus === 'success' && userRole) {
      setAuthData({
        isAdminLoggedIn: 'true',
        userRole,
        token: token || undefined,
        userEmail: userEmail || undefined,
        userName: userName || undefined,
        userPicture: (userPicture && userPicture !== 'null' && userPicture !== 'undefined') ? userPicture : undefined
      }, rememberPref);

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
    const payloadRole = isSignUpMode ? 'user' : activeTab;

    try {
      const res = await axios.post(endpoint, {
        name: isSignUpMode ? manualName : undefined,
        email: manualEmail,
        password: manualPassword,
        role: payloadRole,
        rememberMe
      });

      if (res.data.success) {
        const finalRole = res.data.role || payloadRole;
        const picture = res.data.profile_picture;
        const cleanPicture = (picture && picture !== 'null' && picture !== 'undefined') ? picture : undefined;

        setAuthData({
          isAdminLoggedIn: 'true',
          userRole: finalRole,
          token: res.data.token || undefined,
          userEmail: res.data.email || manualEmail,
          userName: res.data.name || manualName || 'User',
          userPicture: cleanPicture
        }, rememberMe);

        window.location.href = finalRole === 'admin' ? '/admin-dashboard' : '/user-dashboard';
      }
    } catch (error) {
      alert(isSignUpMode ? 'Sign up failed. Please try again.' : 'Incorrect email or password.');
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.get('login') === 'success';
  const isAlreadyLoggedIn = getAuthData('isAdminLoggedIn') === 'true';

  if (isOAuthCallback || isAlreadyLoggedIn) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">

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

      {/* Main Login Card */}
      <div className="w-[90%] max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 transition-colors duration-300">

        <div className="flex justify-center mb-6">
          <img src={CalendarScheduleSvg} alt="Calendar Schedule" style={{ width: '56px', height: '56px' }} />
        </div>

        {/* Role Tabs */}
        {!isSignUpMode && (
          <div className="flex p-1 mb-8 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'user' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('user')}
            >
              <User size={18} /> User
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('admin')}
            >
              <ShieldCheck size={18} /> Admin
            </button>
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            {isSignUpMode ? 'Create Account' : `Welcome Back${activeTab === 'admin' ? ', Admin' : ''}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isSignUpMode ? 'Sign up to get started' : 'Securely manage your schedule'}
          </p>
        </div>

        <form onSubmit={handleManualLogin} className="flex flex-col gap-4">
          {isSignUpMode && (
            <input
              autoComplete="name"
              type="text"
              placeholder="Full Name"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          )}

          <input
            autoComplete="email"
            type="email"
            placeholder="Email Address"
            value={manualEmail}
            onChange={e => setManualEmail(e.target.value.toLowerCase())}
            required
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />

          <div className="relative">
            <input
              autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={manualPassword}
              onChange={e => setManualPassword(e.target.value)}
              required
              className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex items-center justify-between px-1 mt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                Remember Me
              </span>
            </label>

            {!isSignUpMode && (
              <button
                type="button"
                onClick={() => navigate('/forgot-password', { state: { email: manualEmail } })}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                Forgot Password?
              </button>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all"
          >
            {isSignUpMode ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <a
          href={`/auth/google?role=${isSignUpMode ? 'user' : activeTab}&remember=${rememberMe}`}
          className="flex items-center justify-center gap-3 w-full py-3 px-4 mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </a>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          {isSignUpMode ? "Already have an account? " : "Don't have an account? "}
          <button
            onClick={() => {
              setIsSignUpMode(!isSignUpMode);
              if (isSignUpMode) setActiveTab('user');
            }}
            className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-500 transition-colors"
          >
            {isSignUpMode ? 'Login Here' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;