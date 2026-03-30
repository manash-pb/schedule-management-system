import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Calendar, Trash2, PlusCircle, ExternalLink, UserPlus, X, FileSpreadsheet, ArrowLeft, Download, LogOut } from 'lucide-react';
import './App.css';

// --- CIRCULAR 12-HOUR TIME PICKER ---
const CustomTimeInput = ({ value, onChange }) => {
  const [localH, setLocalH] = useState("12");
  const [localM, setLocalM] = useState("00");
  const [localA, setLocalA] = useState("PM");

  useEffect(() => {
    if (!value) {
      setLocalH("12");
      setLocalM("00");
      setLocalA("PM");
    }
  }, [value]);

  const updateParent = (h, m, a) => {
    let h24 = parseInt(h, 10);
    if (isNaN(h24) || h24 === 0) h24 = 12; 
    
    if (a === 'PM' && h24 !== 12) h24 += 12;
    if (a === 'AM' && h24 === 12) h24 = 0;

    let cleanM = parseInt(m, 10);
    if (isNaN(cleanM)) cleanM = 0;
    if (cleanM > 59) cleanM = 59; 

    const outH = h24.toString().padStart(2, '0');
    const outM = cleanM.toString().padStart(2, '0');
    onChange(`${outH}:${outM}`);
  };

  const handleHourChange = (e) => {
    let val = e.target.value;
    if (val === '') { setLocalH(''); return; }
    let h = parseInt(val, 10);
    if (h > 12) h = 1; 
    else if (h === 0 && localH === '1') h = 12; 
    else if (h === 0) { setLocalH('0'); return; } 
    else if (h < 0) h = 12; 
    setLocalH(h.toString());
    updateParent(h, localM, localA);
  };

  const handleMinuteChange = (e) => {
    let val = e.target.value;
    if (val === '') { setLocalM(''); return; }
    let m = parseInt(val, 10);
    if (m > 59) m = 0; 
    else if (m < 0) m = 59; 
    setLocalM(m.toString());
    updateParent(localH, m, localA);
  };

  const handleHourKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      let h = parseInt(localH, 10) || 12;
      h = e.key === 'ArrowUp' ? (h >= 12 ? 1 : h + 1) : (h <= 1 ? 12 : h - 1);
      setLocalH(h.toString());
      updateParent(h, localM, localA);
    }
  };

  const handleMinuteKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      let m = parseInt(localM, 10) || 0;
      m = e.key === 'ArrowUp' ? (m >= 59 ? 0 : m + 1) : (m <= 0 ? 59 : m - 1);
      const formattedM = m.toString().padStart(2, '0');
      setLocalM(formattedM);
      updateParent(localH, formattedM, localA);
    }
  };

  const handleBlur = () => {
    let h = parseInt(localH, 10);
    if (isNaN(h) || h < 1 || h > 12) h = 12; 
    let m = parseInt(localM, 10);
    if (isNaN(m) || m < 0 || m > 59) m = 0;
    const finalH = h.toString().padStart(2, '0'); 
    const finalM = m.toString().padStart(2, '0');
    setLocalH(finalH);
    setLocalM(finalM);
    updateParent(finalH, finalM, localA);
  };

  const compactInputStyle = {
    padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none',
    fontFamily: 'inherit', backgroundColor: 'white', fontSize: '14px', width: '55px', textAlign: 'center'
  };

  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
      <input type="number" style={compactInputStyle} value={localH} onChange={handleHourChange} onKeyDown={handleHourKeyDown} onBlur={handleBlur} onClick={e => e.target.select()} />
      <span style={{ fontWeight: 'bold', color: '#475569' }}>:</span>
      <input type="number" style={compactInputStyle} value={localM} onChange={handleMinuteChange} onKeyDown={handleMinuteKeyDown} onBlur={handleBlur} onClick={e => e.target.select()} />
      <select style={{...compactInputStyle, width: '65px', cursor: 'pointer', padding: '6px 2px'}} value={localA} onChange={e => { setLocalA(e.target.value); updateParent(localH, localM, e.target.value); }}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isAdminLoggedIn') === 'true');
  const [isSignUpMode, setIsSignUpMode] = useState(false); // NEW: Toggle state
  
  const [manualName, setManualName] = useState(''); // NEW: Name state
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    const userRole = urlParams.get('role');

    if (loginStatus === 'success') {
      localStorage.setItem('isAdminLoggedIn', 'true');
      localStorage.setItem('userRole', userRole);
      setIsLoggedIn(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({ title: '', description: '', venue: '', event_date: '', start_time: '', end_time: '' });
  const [attendees, setAttendees] = useState([]);
  const [currentAttendee, setCurrentAttendee] = useState({ name: '', email: '' });
  const [previewEvent, setPreviewEvent] = useState(null);

  const handleManualLogin = async (e) => {
    e.preventDefault();
    const endpoint = isSignUpMode ? '/api/auth/signup' : '/api/auth/manual';
    
    try {
      const res = await axios.post(endpoint, { 
        name: isSignUpMode ? manualName : undefined, // Only send name if signing up
        email: manualEmail,
        password: manualPassword 
      });
      
      if (res.data.success) {
        localStorage.setItem('isAdminLoggedIn', 'true');
        localStorage.setItem('userRole', res.data.role);
        setIsLoggedIn(true);
      }
    } catch (error) {
      alert(isSignUpMode ? 'Sign up failed.' : 'Incorrect email or password.');
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      const now = new Date(); 
      const upcomingEvents = res.data.filter(event => {
        const dateObj = new Date(event.event_date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const endDateTime = new Date(`${yyyy}-${mm}-${dd}T${event.end_time}`);
        return endDateTime > now;
      });
      setEvents(upcomingEvents);
    } catch (error) { console.error("Failed to fetch events:", error); }
  };

  useEffect(() => {
    if (isLoggedIn) fetchEvents();
  }, [isLoggedIn]);

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hourString, minute] = timeString.split(':');
    let hour = parseInt(hourString, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleAddAttendee = () => {
    if (currentAttendee.email) {
      setAttendees([...attendees, currentAttendee]);
      setCurrentAttendee({ name: '', email: '' });
    }
  };

  const handleRemoveAttendee = (indexToRemove) => {
    setAttendees(attendees.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, attendees: attendees };
    try {
      await axios.post('/api/events', payload);
      alert('Event scheduled and invites sent!');
      setFormData({ title: '', description: '', venue: '', event_date: '', start_time: '', end_time: '' });
      setAttendees([]);
      fetchEvents();
    } catch (error) {
      console.error('Error scheduling event:', error);
      alert('Failed to schedule event.');
    }
  };

  const deleteEvent = async (id) => {
    if (window.confirm("Delete this event and notify attendees?")) {
      await axios.delete(`/api/events/${id}`);
      fetchEvents();
      if (previewEvent && previewEvent.event_id === id) setPreviewEvent(null);
    }
  };

  const downloadExcel = (eventToDownload) => {
    const excelData = [
      ["Event Title:", eventToDownload.title],
      ["Date:", formatDate(eventToDownload.event_date)],
      ["Time:", `${formatTime(eventToDownload.start_time)} - ${formatTime(eventToDownload.end_time)}`],
      [], 
      ["Attendee Name", "Email Address"] 
    ];
    if (eventToDownload.attendees && eventToDownload.attendees.length > 0) {
      eventToDownload.attendees.forEach(a => excelData.push([a.name || 'Guest', a.email]));
    } else {
      excelData.push(["No attendees invited", ""]);
    }
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    worksheet['!cols'] = [{ wch: 30 }, { wch: 35 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendees");
    XLSX.writeFile(workbook, `${eventToDownload.title.replace(/\s+/g, '_')}_Attendees.xlsx`);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
  };

  // --- VIEW 1: SIGN UP PAGE ---
  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', width: '100vw', margin: 0, fontFamily: 'sans-serif' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: '#2563eb' }}>
            <Calendar size={48} />
          </div>
          
          {/* Headline logic */}
          <h1 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>
            {isSignUpMode ? 'Sign Up' : 'Sign In'}
          </h1>
          <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '14px', lineHeight: '1.5' }}>
            {isSignUpMode ? 'Create your account to start scheduling.' : 'Securely manage your schedule.'}
          </p>

          <form onSubmit={handleManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '10px' }}>
            
            {/* NEW: Only shows Name input if we are in Sign Up mode */}
            {isSignUpMode && (
              <input 
                type="text" 
                placeholder="Full Name" 
                className="custom-input" 
                value={manualName} 
                onChange={e => setManualName(e.target.value)} 
                required 
                style={{ textAlign: 'center' }}
              />
            )}

            <input 
              type="email" 
              placeholder="Email Address" 
              className="custom-input" 
              value={manualEmail} 
              onChange={e => setManualEmail(e.target.value)} 
              required 
              style={{ textAlign: 'center' }}
            />
            
            <input 
              type="password" 
              placeholder="Password" 
              className="custom-input" 
              value={manualPassword} 
              onChange={e => setManualPassword(e.target.value)} 
              required 
              style={{ textAlign: 'center' }}
            />
            
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {isSignUpMode ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {/* Toggle Link */}
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '15px' }}>
            {isSignUpMode ? "Already have an account? " : "New User? "}
            <span 
              onClick={() => setIsSignUpMode(!isSignUpMode)}
              style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
            >
              {isSignUpMode ? 'Login Here' : 'Sign Up Here'}
            </span>
          </p>

          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#94a3b8' }}>
            <hr style={{ flex: 1, borderTop: '1px solid #e2e8f0' }} />
            <span style={{ padding: '0 10px', fontSize: '12px', fontWeight: 'bold' }}>OR</span>
            <hr style={{ flex: 1, borderTop: '1px solid #e2e8f0' }} />
          </div>
          
          <a 
            href="http://localhost:3000/auth/google"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}
          >
            <ExternalLink size={18} /> Sign In with Google
          </a>
        </div>
      </div>
    );
  }

  // --- VIEW 3: THE DASHBOARD ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '40px', gap: '20px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', width: '100vw', boxSizing: 'border-box', margin: 0 }}>
      
      {/* Header with Logout Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <button onClick={handleLogout} className="btn-secondary" style={{ color: '#ef4444', backgroundColor: '#fee2e2' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
        {/* Form Section */}
        <div style={{ flex: '1 1 320px', background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: 'fit-content' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, marginBottom: '20px' }}>
            <PlusCircle /> Create Event
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="Event Title" className="custom-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
            <input type="text" placeholder="Venue or Zoom Link" className="custom-input" value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})} required />
            <input type="date" className="custom-input" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} required />
            
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Start Time</label>
                <CustomTimeInput 
                  value={formData.start_time}
                  onChange={(newTime) => setFormData(prev => ({ ...prev, start_time: newTime }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>End Time</label>
                <CustomTimeInput 
                  value={formData.end_time} 
                  onChange={(newTime) => setFormData(prev => ({ ...prev, end_time: newTime }))} 
                />
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#475569' }}>Invite Attendees</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Name" className="custom-input" value={currentAttendee.name} onChange={e => setCurrentAttendee({...currentAttendee, name: e.target.value})} style={{flex: '1 1 100px'}} />
                <input type="email" placeholder="Email" className="custom-input" value={currentAttendee.email} onChange={e => setCurrentAttendee({...currentAttendee, email: e.target.value})} style={{flex: '2 1 150px'}} />
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={handleAddAttendee}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px' }}
                >
                  <UserPlus size={16} /> Add
                </button>
              </div>

              {/* --- ADDED THIS SECTION: VISUAL LIST OF ATTENDEES --- */}
              {attendees.length > 0 && (
                <div style={{ backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '6px', fontSize: '14px', marginTop: '10px' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#475569', fontSize: '12px' }}>Invited List:</p>
                  {attendees.map((person, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', backgroundColor: 'white', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <span style={{ wordBreak: 'break-all', paddingRight: '10px' }}>👤 {person.name || 'Guest'} ({person.email})</span>
                      <button type="button" onClick={() => handleRemoveAttendee(index)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
              Schedule & Send Invites
            </button>
          </form>
        </div>

        {/* List Section */}
        <div style={{ flex: '2 1 400px', width: '100%' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}><Calendar /> Upcoming Schedule</h2>
          {events.length === 0 ? <p style={{ color: '#64748b' }}>No upcoming events found.</p> : null}
          
          {events.map((event, index) => (
            <div key={event.event_id || index} className="event-card">
              <div style={{ width: '100%' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>{event.title}</h3>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                  📅 {formatDate(event.event_date)} | 🕒 {formatTime(event.start_time)} - {formatTime(event.end_time)}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b', wordBreak: 'break-all' }}>
                  📍 {event.venue && event.venue.startsWith('http') ? (
                    <a href={event.venue} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>Join Meeting Link</a>
                  ) : (
                    event.venue
                  )}
                </p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => setPreviewEvent(event)} className="btn-icon excel" title="Preview Data">
                  <FileSpreadsheet />
                </button>
                <button onClick={() => deleteEvent(event.event_id)} className="btn-icon delete" title="Delete Event">
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;