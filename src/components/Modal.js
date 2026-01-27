export default function Modal({ show, onConfirm, onCancel, remainingTime }) {
    if (!show) return null;


    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel">
                <h3 className="modal-title">Early Punch Out</h3>
                <p className="modal-text">You haven't completed 9.5 hours.</p>
                <p className="modal-text" style={{ color: 'var(--neon-blue)', fontWeight: 'bold' }}>
                    Time Remaining: {remainingTime}
                </p>
                <p className="modal-subtext">Are you sure you want to punch out?</p>
                <div className="modal-actions">
                    <button className="btn-modal confirm" onClick={onConfirm}>Yes, I'm sure</button>
                    <button className="btn-modal cancel" onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}