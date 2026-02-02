export function calculateStatus({ durationHours, isHalfDay }) {
    if (durationHours > 10.5) return "OT"; // Overtime
    if (durationHours >= 9.5) return "P";  // Present
    if (isHalfDay && durationHours > 4.75) return "HA"; // Half Day
    return "AB"; // Absent
}