export const unrollEvents = (events) => {
    const unrolled = [];
    events.forEach(e => {
        const startDateStr = e.event_date.slice(0, 10);
        const endDateStr = e.end_date ? e.end_date.slice(0, 10) : startDateStr;
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        const isMultiDay = startDate.getTime() !== endDate.getTime();
        
        let currentDate = new Date(startDateStr);
        let dayCount = 1;
        
        while (currentDate <= endDate) {
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            
            unrolled.push({
                ...e,
                title: isMultiDay ? `${e.title} : Day ${dayCount}` : e.title,
                event_date: `${y}-${m}-${d}`,
                _listKey: `${e.event_id || e.id}_day${dayCount}`
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
    });
    return unrolled;
};

export const toCalendarEvents = (unrolledEvents) => unrolledEvents.map(e => {
    const date = e.event_date.slice(0, 10);
    const [sH, sM] = e.start_time.split(':');
    const [eH, eM] = e.end_time.split(':');
    const start = new Date(date); start.setHours(+sH, +sM, 0, 0);
    const end = new Date(date); end.setHours(+eH, +eM, 0, 0);
    return { title: e.title, start, end, resource: e };
});

export const groupMultiDaySpans = (eventsList) => {
    const grouped = [];
    const spanMap = {};
    
    eventsList.forEach(e => {
        if (e.span_id) {
            if (!spanMap[e.span_id]) {
                spanMap[e.span_id] = [];
            }
            spanMap[e.span_id].push(e);
        } else {
            grouped.push(e);
        }
    });
    
    Object.keys(spanMap).forEach(spanId => {
        const group = spanMap[spanId];
        group.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
        
        const firstEvent = group[0];
        const lastEvent = group[group.length - 1];
        
        let displayTitle = firstEvent.title || 'Event';
        if (spanId.includes('_')) {
            const parts = spanId.split('_');
            if (parts.length > 1) {
                try {
                    displayTitle = decodeURIComponent(parts.slice(1).join('_'));
                } catch (e) {
                    console.error('Failed to decode title from span_id');
                }
            }
        } else {
            // Fallback for older events saved before the span_id update
            displayTitle = displayTitle.replace(/(?:^|\s*[:-]\s*)Day\s*\d+$/i, '').trim();
            if (!displayTitle) displayTitle = 'Multi-Day Event';
        }
        
        grouped.push({
            ...firstEvent,
            title: displayTitle,
            event_date: firstEvent.event_date,
            end_date: lastEvent.event_date,
            isMultiDaySpan: true,
            days: group
        });
    });
    
    return grouped;
};

export const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
};
