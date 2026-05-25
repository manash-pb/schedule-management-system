import React, { useState, useEffect, useRef } from 'react';

const CustomTimeInput = ({ value, onChange, compact = false }) => {
    const parseTime = (val) => {
        if (!val) return { h: 12, m: 0, p: 'AM' };
        let [h, m] = val.split(':').map(Number);
        const p = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { h, m, p };
    };

    const { h, m, p } = parseTime(value);
    const [displayH, setDisplayH] = useState(String(h).padStart(2, '0'));
    const [displayM, setDisplayM] = useState(String(m).padStart(2, '0'));
    const mRef = useRef(null);
    const ampmRef = useRef(null);

    useEffect(() => {
        setDisplayH(String(h).padStart(2, '0'));
        setDisplayM(String(m).padStart(2, '0'));
    }, [h, m]);

    const update = (newH, newM, newP) => {
        let finalH = newP === 'PM' ? (newH % 12) + 12 : newH % 12;
        onChange(`${String(finalH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
    };

    const handleArrow = (type, direction) => {
        if (type === 'h') update(direction === 'up' ? (h === 12 ? 1 : h + 1) : (h === 1 ? 12 : h - 1), m, p);
        else if (type === 'm') update(h, direction === 'up' ? (m === 59 ? 0 : m + 1) : (m === 0 ? 59 : m - 1), p);
        else if (type === 'p') update(h, m, p === 'AM' ? 'PM' : 'AM');
    };

    const commitH = (raw) => {
        let num = parseInt(raw);
        if (isNaN(num) || num < 1) num = 1;
        if (num > 12) num = 12;
        setDisplayH(String(num).padStart(2, '0'));
        update(num, m, p);
    };

    const commitM = (raw) => {
        let num = parseInt(raw);
        if (isNaN(num)) num = 0;
        if (num > 59) num = 59;
        setDisplayM(String(num).padStart(2, '0'));
        update(h, num, p);
    };

    const handleHInput = (e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(-2);
        setDisplayH(raw);
        if (raw.length === 2 || (raw.length === 1 && parseInt(raw) > 1)) {
            let num = parseInt(raw);
            if (isNaN(num) || num < 1) num = 1;
            if (num > 12) num = 12;
            update(num, m, p);
            mRef.current?.focus();
            mRef.current?.select();
        }
    };

    const handleMInput = (e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(-2);
        setDisplayM(raw);
        if (raw.length === 2 || (raw.length === 1 && parseInt(raw) > 5)) {
            let num = parseInt(raw);
            if (isNaN(num)) num = 0;
            if (num > 59) num = 59;
            update(h, num, p);
            ampmRef.current?.focus();
        }
    };

    return (
        <div className="hybrid-time-picker">
            <div className="time-column">
                <button type="button" onClick={() => handleArrow('h', 'up')} className="arrow-btn">▲</button>
                <input
                    type="text"
                    className="time-type-input"
                    value={displayH}
                    inputMode="numeric"
                    maxLength={2}
                    style={{ caretColor: 'currentColor' }}
                    onFocus={e => e.target.select()}
                    onChange={handleHInput}
                    onBlur={(e) => commitH(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); handleArrow('h', 'up'); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); handleArrow('h', 'down'); }
                    }}
                />
                <button type="button" onClick={() => handleArrow('h', 'down')} className="arrow-btn">▼</button>
                <span className="input-label-sm">HRS</span>
            </div>

            <span className="time-separator" style={{
                display: 'inline-block',
                transform: compact ? 'translateY(-5px)' : 'translateY(-8px)',
                marginTop: 0
            }}>:</span>

            <div className="time-column">
                <button type="button" onClick={() => handleArrow('m', 'up')} className="arrow-btn">▲</button>
                <input
                    ref={mRef}
                    type="text"
                    className="time-type-input"
                    value={displayM}
                    inputMode="numeric"
                    maxLength={2}
                    style={{ caretColor: 'currentColor' }}
                    onFocus={e => e.target.select()}
                    onChange={handleMInput}
                    onBlur={(e) => commitM(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); handleArrow('m', 'up'); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); handleArrow('m', 'down'); }
                    }}
                />
                <button type="button" onClick={() => handleArrow('m', 'down')} className="arrow-btn">▼</button>
                <span className="input-label-sm">MIN</span>
            </div>

            <div className="time-column" style={{ marginLeft: 4 }}>
                <button type="button" onClick={() => handleArrow('p', 'up')} className="arrow-btn">▲</button>
                <input
                    ref={ampmRef}
                    type="text"
                    className="time-type-input"
                    value={p}
                    readOnly
                    onClick={() => update(h, m, p === 'AM' ? 'PM' : 'AM')}
                    onKeyDown={e => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            update(h, m, p === 'AM' ? 'PM' : 'AM');
                        }
                    }}
                    style={{ cursor: 'pointer', caretColor: 'transparent', width: '36px' }}
                />
                <button type="button" onClick={() => handleArrow('p', 'down')} className="arrow-btn">▼</button>
                <span className="input-label-sm" style={{ visibility: 'hidden' }}>AM</span>
            </div>
        </div>
    );
};

export default CustomTimeInput;
