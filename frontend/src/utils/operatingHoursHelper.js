export function formatTime12h(timeStr, isHi = false) {
    if (!timeStr) return "";
    const [hStr, mStr] = String(timeStr).split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? (isHi ? (h >= 19 ? "रात" : "शाम") : "PM") : (isHi ? "सुबह" : "AM");
    const displayH = h % 12 || 12;
    return isHi ? `${ampm} ${displayH}:${m}` : `${displayH}:${m} ${ampm}`;
}

export function formatOperatingDays(days = [], isHi = false) {
    if (!days || !Array.isArray(days) || days.length === 0) {
        return isHi ? "सोम – शनि" : "Mon – Sat";
    }
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const hiMap = {
        Monday: "सोम",
        Tuesday: "मंगल",
        Wednesday: "बुध",
        Thursday: "गुरु",
        Friday: "शुक्र",
        Saturday: "शनि",
        Sunday: "रवि",
    };
    const enMap = {
        Monday: "Mon",
        Tuesday: "Tue",
        Wednesday: "Wed",
        Thursday: "Thu",
        Friday: "Fri",
        Saturday: "Sat",
        Sunday: "Sun",
    };

    if (days.length === 7) {
        return isHi ? "सोम – रवि (सभी दिन)" : "Mon – Sun (All 7 Days)";
    }

    const sorted = dayOrder.filter((d) => days.includes(d));
    if (sorted.length >= 3) {
        const firstIdx = dayOrder.indexOf(sorted[0]);
        const lastIdx = dayOrder.indexOf(sorted[sorted.length - 1]);
        if (lastIdx - firstIdx + 1 === sorted.length) {
            const first = isHi ? hiMap[sorted[0]] : enMap[sorted[0]];
            const last = isHi ? hiMap[sorted[sorted.length - 1]] : enMap[sorted[sorted.length - 1]];
            return `${first} – ${last}`;
        }
    }
    return sorted.map((d) => (isHi ? hiMap[d] : enMap[d])).join(", ");
}

export function generateOperatingHoursText(days, startTime, endTime, isHi = false) {
    const daysStr = formatOperatingDays(days, isHi);
    const startStr = formatTime12h(startTime || "08:00", isHi);
    const endStr = formatTime12h(endTime || "20:00", isHi);
    return `${daysStr}: ${startStr} – ${endStr}`;
}
