import React, { useState } from "react";
import { useAttendance } from "../context/AttendanceContext";
import Modal from "./Modal";

export default function PunchControls() {
    const { punchIn, punchOut, punchInTime, punchOutTime, history } = useAttendance();
    const [showModal, setShowModal] = useState(false);
    const [remainingTime, setRemainingTime] = useState("");
    const [isHalfDayMode, setIsHalfDayMode] = useState(false);

    // Get current record details
    const currentRecord = history.find(r => r.punchOut === null);
    const isCurrentHalfDay = currentRecord ? currentRecord.isHalfDay : false;

    const handlePunchIn = () => {
        punchIn(isHalfDayMode);
    };

    const handlePunchOutClick = () => {
        const now = new Date();
        // Check if 9.5 hours have passed
        // 9.5 hours = 9.5 * 60 * 60 * 1000 ms
        const timeDiff = now - punchInTime;
        const requiredHours = isCurrentHalfDay ? 4.75 : 9.5;
        const requiredTime = requiredHours * 60 * 60 * 1000;

        if (timeDiff < requiredTime) {
            const remainingMs = requiredTime - timeDiff;
            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            setRemainingTime(`${hours}h ${minutes}m`);
            setShowModal(true);
        } else {
            punchOut();
        }
    };

    const confirmEarlyPunchOut = () => {
        punchOut();
        setShowModal(false);
    };

    const isPunchedIn = !!punchInTime;
    const isPunchedOutToday = !!punchOutTime;

    if (isPunchedOutToday) {
        return <div className="status-message">Attendance Marked for Today!</div>;
    }

    return (
        <>
            {punchInTime && (
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div className="status-info" style={{
                        fontSize: '1.2rem',
                        color: 'var(--neon-green)',
                        textShadow: '0 0 10px rgba(0, 255, 157, 0.3)',
                        marginBottom: '5px'
                    }}>
                        Punched In at: {punchInTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                    {/* Expected Punch Out Display */}
                    <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
                        Expected Punch Out: {
                            new Date(punchInTime.getTime() + (isCurrentHalfDay ? 4.75 : 9.5) * 60 * 60 * 1000)
                                .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        }
                        {isCurrentHalfDay && <span style={{ marginLeft: '10px', color: '#ffcc00' }}>(Half Day)</span>}
                    </div>
                </div>
            )}

            <div className="controls">
                {!isPunchedIn && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isHalfDayMode}
                                onChange={(e) => setIsHalfDayMode(e.target.checked)}
                                style={{ marginRight: '10px', width: '18px', height: '18px' }}
                            />
                            Half Day Mode (Min 4.75h)
                        </label>
                    </div>
                )}
                {!isPunchedIn ? (
                    <button className="btn-punch in" onClick={handlePunchIn}>Punch In</button>
                ) : (
                    <button className="btn-punch out" onClick={handlePunchOutClick}>Punch Out</button>
                )}
            </div>

            <Modal
                show={showModal}
                remainingTime={remainingTime}
                onConfirm={confirmEarlyPunchOut}
                onCancel={() => setShowModal(false)}
            />
        </>
    );
}