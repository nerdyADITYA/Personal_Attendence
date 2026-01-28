
import React from "react";
import * as XLSX from 'xlsx';
import { useAttendance } from "../context/AttendanceContext";

const ExportButton = () => {
    // The history from context is now ALREADY filtered by the backend for the current user.
    // So no changes needed to the logic here! It will export exactly what is in 'history'.
    const { history } = useAttendance();

    const exportMonth = () => {
        // 1. Prepare data for Excel
        // We can filter or format fields here if needed.
        // Currently history has: id, date, day, punchIn, punchOut, duration, status, timestamp

        const dataToExport = history.map(record => ({
            Date: record.date,
            Day: record.day,
            "Punch In": record.punchIn,
            "Punch Out": record.punchOut,
            Duration: record.duration,
            Status: record.status
        }));

        // 2. Create Workbook and Worksheet
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

        // 3. Generate File Name
        const fileName = `attendance_export_${new Date().toISOString().split('T')[0]}.xlsx`;

        // 4. Write and Download
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="export-container">
            <button className="btn-export" onClick={exportMonth}>
                Export to Excel
            </button>
        </div>
    );
}

export default ExportButton;