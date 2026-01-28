import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';

const AttendanceContext = createContext();

export const useAttendance = () => useContext(AttendanceContext);

export const AttendanceProvider = ({ children }) => {
    const [punchInTime, setPunchInTime] = useState(null);
    const [punchOutTime, setPunchOutTime] = useState(null);
    const [history, setHistory] = useState([]);
    const { token } = useAuth(); // Get token

    // Load state from server only when token is available
    useEffect(() => {
        if (!token) return;

        fetch('/api/attendance', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (res.status === 401 || res.status === 403) throw new Error("Unauthorized");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setHistory(data);
                    const activeRecord = data.find(r => r.punchOut === null);
                    if (activeRecord) {
                        try {
                            let dateObj;
                            if (activeRecord.date && activeRecord.punchIn) {
                                const dateParts = activeRecord.date.split('/');
                                if (dateParts.length === 3) {
                                    const [day, month, year] = dateParts;
                                    const timeStr = activeRecord.punchIn;
                                    dateObj = new Date(`${year}-${month}-${day} ${timeStr}`);
                                } else {
                                    dateObj = new Date(activeRecord.date + ' ' + activeRecord.punchIn);
                                }
                            } else if (activeRecord.timestamp) {
                                dateObj = new Date(activeRecord.timestamp);
                            }

                            if (dateObj && !isNaN(dateObj.getTime())) {
                                setPunchInTime(dateObj);
                            }
                        } catch (e) {
                            console.error("Error parsing date:", e);
                        }
                    }
                }
            })
            .catch(err => console.error("Failed to load history:", err));
    }, [token]);

    const punchIn = () => {
        if (!token) return;

        const now = new Date();
        setPunchInTime(now);
        setPunchOutTime(null);

        // Persist Punch In immediately
        const newRecord = {
            id: Date.now(),
            date: now.toLocaleDateString(),
            day: now.toLocaleDateString('en-US', { weekday: 'short' }),
            punchIn: now.toLocaleTimeString(),
            punchOut: null, // Pending
            duration: null,
            status: 'Working',
            timestamp: now.toISOString() // Defines the punch-in absolute time
        };

        setHistory(prev => [newRecord, ...prev]);

        fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newRecord)
        }).catch(err => console.error("Failed to save punch-in:", err));
    };

    const punchOut = () => {
        if (!punchInTime || !token) return;

        const now = new Date();
        setPunchOutTime(now);

        const durationMs = now - punchInTime;
        const durationHours = durationMs / (1000 * 60 * 60);

        // Formula Implementation
        const punchInHour = punchInTime.getHours();
        const punchInMinute = punchInTime.getMinutes();
        const isLatePunchIn = (punchInHour > 10) || (punchInHour === 10 && punchInMinute > 0);
        const isDurationOver8_5 = durationHours >= 8.5;
        const isDurationOver4 = durationHours > 4;
        const dayOfWeek = punchInTime.toLocaleDateString('en-US', { weekday: 'short' });

        let status = "A";

        if (isLatePunchIn) {
            if (isDurationOver8_5) {
                status = "LP";
            } else {
                status = "LA";
            }
        } else {
            if (isDurationOver8_5) {
                status = "OP";
            } else {
                if (dayOfWeek === "Sun") {
                    status = "OFF";
                } else if (isDurationOver4) {
                    status = "OA";
                } else {
                    status = "A";
                }
            }
        }

        // Find the pending record to update
        const pendingRecord = history.find(r => r.punchOut === null) || {};

        const updatedRecord = {
            ...pendingRecord,
            id: pendingRecord.id || Date.now(),
            date: pendingRecord.date || punchInTime.toLocaleDateString(),
            day: dayOfWeek,
            punchIn: pendingRecord.punchIn || punchInTime.toLocaleTimeString(),
            timestamp: pendingRecord.timestamp || punchInTime.toISOString(),

            // Updated fields
            punchOut: now.toLocaleTimeString(),
            duration: durationHours.toFixed(2),
            status: status,
        };

        // Optimistic Update
        setHistory(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        setPunchInTime(null);

        // Save to Server
        fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedRecord)
        }).catch(err => console.error("Failed to save record:", err));
    };

    const value = {
        punchInTime,
        punchOutTime,
        history,
        punchIn,
        punchOut
    };

    return (
        <AttendanceContext.Provider value={value}>
            {children}
        </AttendanceContext.Provider>
    );
};
