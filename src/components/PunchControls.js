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
                <div className="punch-status-container">
                    <div className="punch-status-info">
                        Punched In at: {punchInTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                    {/* Expected Punch Out Display */}
                    <div className="expected-out-display">
                        Expected Punch Out: {
                            new Date(punchInTime.getTime() + (isCurrentHalfDay ? 4.75 : 9.5) * 60 * 60 * 1000)
                                .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        }
                        {isCurrentHalfDay && <span className="half-day-label">(Half Day)</span>}
                    </div>
                </div>
            )}

            <div className="controls">
                {!isPunchedIn && (
                    <div className="checkbox-container">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={isHalfDayMode}
                                onChange={(e) => setIsHalfDayMode(e.target.checked)}
                                className="mode-checkbox"
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
                requiredHours={isCurrentHalfDay ? 4.75 : 9.5} // Pass dynamic hours
                onConfirm={confirmEarlyPunchOut}
                onCancel={() => setShowModal(false)}
            />
        </>
    );
}