import React, { useState } from "react";
import { useAttendance } from "../context/AttendanceContext";
import Modal from "./Modal";

export default function PunchControls() {
    const { punchIn, punchOut, punchInTime, punchOutTime } = useAttendance();
    const [showModal, setShowModal] = useState(false);
    const [remainingTime, setRemainingTime] = useState("");

    const handlePunchIn = () => {
        punchIn();
    };

    const handlePunchOutClick = () => {
        const now = new Date();
        // Check if 9.5 hours have passed
        // 9.5 hours = 9.5 * 60 * 60 * 1000 ms
        const timeDiff = now - punchInTime;
        const requiredTime = 9.5 * 60 * 60 * 1000;

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

    // If already punched out today, maybe show "Done for the day" or just disable buttons?
    // The user said: "once i punch in i'll close it and then open it again when i will punch out"
    // So we assume simple flow.

    if (isPunchedOutToday) {
        return <div className="status-message">Attendance Marked for Today!</div>;
    }

    return (
        <>
            {punchInTime && (
                <div className="status-info" style={{
                    marginBottom: '20px',
                    fontSize: '1.2rem',
                    color: 'var(--neon-green)',
                    textShadow: '0 0 10px rgba(0, 255, 157, 0.3)'
                }}>
                    Punched In at: {punchInTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
            )}

            <div className="controls">
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