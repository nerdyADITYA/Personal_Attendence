
import React from "react";
import Clock from "./Clock";
import PunchControls from "./PunchControls";
import ExportButton from "./ExportButton";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
    const today = new Date();
    const { user, logout } = useAuth();

    return (
        <div className="app">
            <div className="header">
                <h1>Personal Attendance</h1>
                <div className="user-info">
                    <span>Welcome, {user?.username}</span>
                    <button onClick={logout} className="logout-btn">Logout</button>
                </div>
            </div>

            <div className="date">{today.toDateString()}</div>
            <Clock />
            <PunchControls />
            <ExportButton />
        </div>
    );
};

export default Dashboard;
