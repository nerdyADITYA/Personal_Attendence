import React from "react";
import Clock from "./components/Clock";
import PunchControls from "./components/PunchControls";
import ExportButton from "./components/ExportButton";
import { AttendanceProvider } from "./context/AttendanceContext";
import "./App.css";


function App() {
    const today = new Date();


    return (
        <AttendanceProvider>
            <div className="app">
                <h1>Personal Attendance</h1>
                <div className="date">{today.toDateString()}</div>
                <Clock />
                <PunchControls />
                <ExportButton />
            </div>
        </AttendanceProvider>
    );
}


export default App;