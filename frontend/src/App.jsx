import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
// 1. ADDED ArrowLeft and Download icons
import { Calendar, Trash2, PlusCircle, ExternalLink, UserPlus, X, FileSpreadsheet, ArrowLeft, Download } from 'lucide-react';
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
      if (h === 0) h = 12; 
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
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({ title: '', description: '', venue: '', event_date: '', start_time: '', end_time: '' });
  const [attendees, setAttendees] = useState([]);
  const [currentAttendee, setCurrentAttendee] = useState({ name: '', email: '' });
  
  // 2. NEW STATE: Keeps track of which event is currently being previewed
  const [previewEvent, setPreviewEvent] = useState(null);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      const now = new Date(); // Gets the exact current date and time

      // Filter out any events where the end time has already passed
      const upcomingEvents = res.data.filter(event => {
        // 1. Extract the year, month, and day safely from the database date
        const dateObj = new Date(event.event_date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');

        // 2. Combine it with the exact end_time (e.g., "14:30") to create a full Date object
        const endDateTime = new Date(`${yyyy}-${mm}-${dd}T${event.end_time}`);

        // 3. Only keep the event if the end time is strictly greater than right NOW
        return endDateTime > now;
      });

      setEvents(upcomingEvents);
    } catch (error) { 
      console.error("Failed to fetch events:", error); 
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hourString, minute] = timeString.split(':');
    let hour = parseInt(hourString, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; 
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
      alert('Failed to schedule event. Check backend logs!');
    }
  };

  const deleteEvent = async (id) => {
    if (window.confirm("Delete this event and notify attendees?")) {
      await axios.delete(`/api/events/${id}`);
      fetchEvents();
      // If they delete the event while previewing it, close the preview
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

  // 3. NEW VIEW: The Preview Page
  if (previewEvent) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', width: '100vw', boxSizing: 'border-box', margin: 0 }}>
        
        {/* Back Button */}
        <button onClick={() => setPreviewEvent(null)} className="btn-secondary" style={{ width: 'fit-content', marginBottom: '20px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        
        {/* Preview Card */}
        <div style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', maxWidth: '900px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '30px' }}>
            <div>
              <h1 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>{previewEvent.title}</h1>
              <p style={{ margin: '0', color: '#64748b', fontSize: '16px' }}>
                📅 {formatDate(previewEvent.event_date)} | 🕒 {formatTime(previewEvent.start_time)} - {formatTime(previewEvent.end_time)}
              </p>
            </div>
            
            {/* The Actual Download Button */}
            <button onClick={() => downloadExcel(previewEvent)} className="btn-primary" style={{ width: 'auto', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}>
              <Download size={18} /> Download Excel
            </button>
          </div>
          
          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0 0 20px 0' }} />
          
          {/* Attendee Table */}
          <h3 style={{ margin: '0 0 15px 0', color: '#334155' }}>Attendee List Preview</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>Name</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>Email Address</th>
                </tr>
              </thead>
              <tbody>
                {previewEvent.attendees && previewEvent.attendees.length > 0 ? (
                  previewEvent.attendees.map((a, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px', color: '#0f172a' }}>{a.name || 'Guest'}</td>
                      <td style={{ padding: '12px', color: '#0f172a' }}>{a.email}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No attendees have been invited to this event.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. ORIGINAL VIEW: The Dashboard
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
          <input type="text" placeholder="Venue or Zoom Link" className="custom-input" value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})} required />
          <input type="date" className="custom-input" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} required />
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Start Time</label>
              <CustomTimeInput value={formData.start_time} onChange={(newTime) => setFormData({...formData, start_time: newTime})} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>End Time</label>
              <CustomTimeInput value={formData.end_time} onChange={(newTime) => setFormData({...formData, end_time: newTime})} />
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
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b' }}>
                📅 {formatDate(event.event_date)} | 🕒 {formatTime(event.start_time)} - {formatTime(event.end_time)}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#64748b', wordBreak: 'break-all' }}>
                📍 {event.venue.startsWith('http') ? (
                  <a href={event.venue} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>Join Meeting Link</a>
                ) : (
                  event.venue
                )}
              </p>
              
              {event.attendees && event.attendees.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: '#475569' }}>
                  <strong>Invited: </strong> {event.attendees.length} participant(s)
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* This button now triggers the preview instead of downloading immediately! */}
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
  );
}

export default App;