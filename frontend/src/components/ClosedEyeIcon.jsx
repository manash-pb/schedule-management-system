import React from 'react';

const ClosedEyeIcon = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 8 Q12 16 20 8" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        <line x1="7.5" y1="11.5" x2="6.5" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1="10.5" y1="13" x2="10" y2="15.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1="13.5" y1="13" x2="14" y2="15.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1="16.5" y1="11.5" x2="17.5" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

export default ClosedEyeIcon;
