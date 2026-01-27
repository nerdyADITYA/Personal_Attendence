export function calculateStatus({ punchIn, punchOut, workDuration, day }) {
const toTime = (t) => {
if (!t) return null;
const [h, m, s] = t.split(":").map(Number);
return h * 3600 + m * 60 + s;
};


const G2 = toTime(punchIn);
const I2 = toTime(workDuration);
const J2 = toTime(workDuration);


if (G2 > toTime("10:00:00")) {
if (I2 >= toTime("08:30:00")) return "LP";
else return "LA";
} else {
if (I2 >= toTime("08:30:00")) return "OP";
else {
if (day === "Sun") return "OFF";
else {
if (J2 > toTime("04:00:00")) return "OA";
else return "A";
}
}
}
}