export const getData = () => {
return JSON.parse(localStorage.getItem("attendance") || "{}");
};


export const saveData = (data) => {
localStorage.setItem("attendance", JSON.stringify(data, null, 2));
};