import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Calendar, Trash2, PlusCircle, ExternalLink, UserPlus, X, FileSpreadsheet } from 'lucide-react';
import './App.css';

// --- BULLETPROOF 12-HOUR TIME PICKER (1-12 Hour Range) ---
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
    // If the box is empty or 0, treat it as 12 for backend math
    if (isNaN(h24) || h24 === 0) h24 = 12; 
    
    if (a === 'PM' && h24 !== 12) h24 += 12;
    if (a === 'AM' && h24 === 12) h24 = 0;

    let cleanM = parseInt(m, 10) || 0;
    if (cleanM > 59) cleanM = 59; 

    const outH = h24.toString().padStart(2, '0');
    const outM = cleanM.toString().padStart(2, '0');
    onChange(`${outH}:${outM}`);
  };

  // --- STRICT HOUR ENFORCEMENT (1-12) ---
  const handleHourChange = (e) => {
    let val = e.target.value;
    
    // Allow empty string to clear the box, or '0' so they can type '09'
    if (val === '' || val === '0') {
      setLocalH(val);
      return;
    }
    
    let h = parseInt(val, 10);
    if (h < 1) h = 1; 
    if (h > 12) h = 12;
    
    setLocalH(h.toString());
    updateParent(h, localM, localA);
  };

  // --- STRICT MINUTE ENFORCEMENT (0-59) ---
  const handleMinuteChange = (e) => {
    let val = e.target.value;
    if (val === '') {
      setLocalM('');
      return;
    }

    let m = parseInt(val, 10);
    if (m < 0) m = 0;
    if (m > 59) m = 59;
    
    setLocalM(m.toString());
    updateParent(localH, m, localA);
  };

  // Arrow Key Logic (Loops 12 -> 1 and 1 -> 12)
  const handleHourKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      let h = parseInt(localH, 10) || 12;
      if (h === 0) h = 12; // Safety catch if they try to arrow from '0'
      
      // The math now strictly uses 1 and 12 boundaries
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

  // When clicking away, pad with zeros. If Hour is left as '0', snap it to '12'
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
    padding: '6px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: 'white',
    fontSize: '14px',
    width: '55px', 
    textAlign: 'center'
  };

  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
      <input 
        type="number" 
        min="1" // Updated minimum to 1
        max="12"
        style={compactInputStyle} 
        value={localH} 
        onChange={handleHourChange}
        onKeyDown={handleHourKeyDown} 
        onBlur={handleBlur}
        onClick={e => e.target.select()}
      />
      
      <span style={{ fontWeight: 'bold', color: '#475569' }}>:</span>
      
      <input 
        type="number" 
        min="0" 
        max="59"
        style={compactInputStyle} 
        value={localM} 
        onChange={handleMinuteChange}
        onKeyDown={handleMinuteKeyDown} 
        onBlur={handleBlur}
        onClick={e => e.target.select()} 
      />
      
      <select 
        style={{...compactInputStyle, width: '65px', cursor: 'pointer', padding: '6px 2px'}} 
        value={localA} 
        onChange={e => {
          setLocalA(e.target.value);
          updateParent(localH, localM, e.target.value);
        }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

function App() {
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    title: '', description: '', venue: '', event_date: '', start_time: '', end_time: ''
  });
  const [attendees, setAttendees] = useState([]);
  const [currentAttendee, setCurrentAttendee] = useState({ name: '', email: '' });

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEvents(res.data);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  // --- NEW: Time Converter Function ---
  const formatTime = (timeString) => {
    if (!timeString) return '';
    // Splits "14:30:00" into ["14", "30", "00"]
    const [hourString, minute] = timeString.split(':');
    let hour = parseInt(hourString, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    
    hour = hour % 12;
    hour = hour ? hour : 12; // If hour is 0 (midnight), change it to 12
    
    return `${hour}:${minute} ${ampm}`;
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
      alert('Failed to schedule event. Check backend logs!');
    }
  };

  const deleteEvent = async (id) => {
    if (window.confirm("Delete this event and notify attendees?")) {
      await axios.delete(`/api/events/${id}`);
      fetchEvents();
    }
  };

  const downloadExcel = (event) => {
    const data = event.attendees.map(a => ({
        "Attendee Name": a.name || 'Guest',
        "Email Address": a.email,
        "Event Title": event.title,
        "Date": new Date(event.event_date).toLocaleDateString(),
        // Uses the new converter for Excel too!
        "Time": `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendees");
    const fileName = `${event.title.replace(/\s+/g, '_')}_Attendees.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', padding: '40px', gap: '40px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', width: '100vw', boxSizing: 'border-box', margin: 0 }}>
      
      {/* Form Section */}
      <div style={{ flex: '1 1 320px', background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: 'fit-content' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}><PlusCircle /> Create Event</h2>
        
        <a href="http://localhost:3000/auth/google" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '14px', marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}>
          Connect Google Calendar <ExternalLink size={14} />
        </a>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="text" placeholder="Event Title" className="custom-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          <input type="text" placeholder="Venue or Webinar Link" className="custom-input" value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})} required />
          <input type="date" className="custom-input" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} required />
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Start Time</label>
              <CustomTimeInput 
                value={formData.start_time} 
                onChange={(newTime) => setFormData({...formData, start_time: newTime})} 
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>End Time</label>
              <CustomTimeInput 
                value={formData.end_time} 
                onChange={(newTime) => setFormData({...formData, end_time: newTime})} 
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#475569' }}>Invite Attendees</label>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Name" className="custom-input" value={currentAttendee.name} onChange={e => setCurrentAttendee({...currentAttendee, name: e.target.value})} style={{flex: '1 1 100px'}} />
              <input type="email" placeholder="Email" className="custom-input" value={currentAttendee.email} onChange={e => setCurrentAttendee({...currentAttendee, email: e.target.value})} style={{flex: '2 1 150px'}} />
              <button type="button" className="btn-secondary" onClick={handleAddAttendee}>
                <UserPlus size={16} /> Add
              </button>
            </div>

            {attendees.length > 0 && (
              <div style={{ backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '6px', fontSize: '14px' }}>
                {attendees.map((person, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span style={{ wordBreak: 'break-all', paddingRight: '10px' }}>👤 {person.name || 'Guest'} ({person.email})</span>
                    <button type="button" onClick={() => handleRemoveAttendee(index)} className="btn-icon delete"><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary">
            Schedule & Send Invites
          </button>
        </form>
      </div>

      {/* List Section */}
      <div style={{ flex: '2 1 400px', width: '100%' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}><Calendar /> Upcoming Schedule</h2>
        {events.length === 0 ? <p style={{ color: '#64748b' }}>No upcoming events found.</p> : null}
        
        {events.map(event => (
          <div key={event.event_id} className="event-card">
            <div style={{ width: '100%' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>{event.title}</h3>
              {/* Uses the formatTime function right here! */}
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                📅 {new Date(event.event_date).toLocaleDateString()} | 🕒 {formatTime(event.start_time)} - {formatTime(event.end_time)}
              </p>
              
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b', wordBreak: 'break-all' }}>
                📍 {event.venue.startsWith('http') ? (
                  <a href={event.venue} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    Join Meeting Link
                  </a>
                ) : (
                  event.venue
                )}
              </p>
              
              {event.attendees && event.attendees.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: '#475569' }}>
                  <strong>Invited: </strong> 
                  {event.attendees.map(a => `${a.name} (${a.email})`).join(', ')}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => downloadExcel(event)} className="btn-icon excel" title="Download Attendee List">
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
  );
}

export default App;