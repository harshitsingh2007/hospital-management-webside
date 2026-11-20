import React from "react";
import { IconDesk, IconX, IconAlertTriangle } from "../SuperAdminIcons";
import { getCategoryLabel } from "../../../utils/i18n";
import {
    modalOverlayStyle,
    modalContentStyle,
    modalCloseIconBtnStyle,
    modalCancelBtnStyle,
    modalSubmitBtnStyle,
    fieldLabelStyle,
    fieldInputStyle
} from "../superAdminStyles";

export function AddDeskModal({
    isOpen,
    onClose,
    newDeskForm,
    setNewDeskForm,
    onSubmit,
    hospitalDepts = [],
    hospitalEmployees = [],
    getEmployeeCurrentDesk = () => null,
    language = "en",
    isHi = false
}) {
    if (!isOpen) return null;

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "18px", color: "#0F172A", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                        <IconDesk size={18} color="#0284C7" />
                        <span>{isHi ? "नया सेवा डेस्क जोड़ें" : "Add New Service Desk"}</span>
                    </h3>
                    <button type="button" onClick={onClose} style={modalCloseIconBtnStyle}><IconX size={15} /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                        <label style={fieldLabelStyle}>{isHi ? "विभाग चुनें" : "Assign to Department"} *</label>
                        {hospitalDepts.length === 0 ? (
                            <div style={{ padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", color: "#991B1B", fontSize: "12.5px" }}>
                                {isHi ? "इस अस्पताल में कोई विभाग नहीं मिला। कृपया डेस्क जोड़ने से पहले 'विभाग' टैब में एक नया विभाग बनाएं।" : "No departments found for this hospital. Please create at least one clinical department in the Departments tab before adding a desk."}
                            </div>
                        ) : (
                            <select
                                value={newDeskForm.dept_code}
                                onChange={(e) => setNewDeskForm({ ...newDeskForm, dept_code: e.target.value })}
                                style={fieldInputStyle}
                                required
                            >
                                {hospitalDepts.map((d) => (
                                    <option key={d.dept_code} value={d.dept_code}>
                                        {d.name} ({d.dept_code})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label style={fieldLabelStyle}>{isHi ? "डेस्क नाम / संख्या" : "Desk Name / Number"} *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. OPD Consultation Desk 3"
                            value={newDeskForm.desk_name}
                            onChange={(e) => setNewDeskForm({ ...newDeskForm, desk_name: e.target.value })}
                            style={fieldInputStyle}
                        />
                    </div>

                    <div>
                        <label style={fieldLabelStyle}>{isHi ? "प्रारंभिक स्थिति" : "Initial Status"}</label>
                        <select
                            value={newDeskForm.status}
                            onChange={(e) => setNewDeskForm({ ...newDeskForm, status: e.target.value })}
                            style={fieldInputStyle}
                        >
                            <option value="AVAILABLE">AVAILABLE (Open for queue)</option>
                            <option value="ACTIVE">ACTIVE (Currently serving)</option>
                            <option value="OFFLINE">OFFLINE (Closed)</option>
                        </select>
                    </div>

                    <div>
                        <label style={fieldLabelStyle}>
                            {isHi ? "डॉक्टर या स्टाफ सदस्य सौंपें (वैकल्पिक)" : "Assign Doctor or Staff (Optional)"}
                        </label>
                        <select
                            value={newDeskForm.assigned_employee_id}
                            onChange={(e) => setNewDeskForm({ ...newDeskForm, assigned_employee_id: e.target.value })}
                            style={fieldInputStyle}
                        >
                            <option value="">{isHi ? "कोई नहीं (स्वचालित / ओपन बे)" : "None (Auto-Assigned / Open Bay)"}</option>
                            {hospitalEmployees.some(e => (e.role || "").toLowerCase() === "doctor") && (
                                <optgroup label={isHi ? "🩺 डॉक्टर" : "🩺 Doctors"}>
                                    {hospitalEmployees.filter(e => (e.role || "").toLowerCase() === "doctor").map((doc) => {
                                        const isOnline = (doc.status || "").toLowerCase() === "active";
                                        const currentDesk = getEmployeeCurrentDesk(doc);
                                        return (
                                            <option key={doc.id || doc.employee_id_num} value={doc.id || doc.employee_id_num}>
                                                {isOnline ? "[Online]" : "[Offline]"} {doc.name || doc.username} ({getCategoryLabel(doc.department, language)}) {currentDesk ? `[At ${currentDesk.desk_name}]` : ""}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            )}
                            {hospitalEmployees.some(e => (e.role || "").toLowerCase() !== "doctor") && (
                                <optgroup label={isHi ? "अन्य स्टाफ एवं नर्स" : "Staff & Nurses"}>
                                    {hospitalEmployees.filter(e => (e.role || "").toLowerCase() !== "doctor").map((stf) => {
                                        const isOnline = (stf.status || "").toLowerCase() === "active";
                                        const currentDesk = getEmployeeCurrentDesk(stf);
                                        return (
                                            <option key={stf.id || stf.employee_id_num} value={stf.id || stf.employee_id_num}>
                                                {isOnline ? "[Online]" : "[Offline]"} {stf.name || stf.username} - {(stf.role || "staff").toUpperCase()} ({getCategoryLabel(stf.department, language)}) {currentDesk ? `[At ${currentDesk.desk_name}]` : ""}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                        <button type="button" onClick={onClose} style={modalCancelBtnStyle}>
                            {isHi ? "रद्द करें" : "Cancel"}
                        </button>
                        <button
                            type="submit"
                            disabled={hospitalDepts.length === 0}
                            style={{
                                ...modalSubmitBtnStyle,
                                opacity: hospitalDepts.length === 0 ? 0.6 : 1,
                                cursor: hospitalDepts.length === 0 ? "not-allowed" : "pointer"
                            }}
                        >
                            {isHi ? "डेस्क जोड़ें" : "Add Desk"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function EditDeskModal({
    isOpen,
    onClose,
    editDeskForm,
    setEditDeskForm,
    onSubmit,
    hospitalDepts = [],
    hospitalEmployees = [],
    getEmployeeCurrentDesk = () => null,
    language = "en",
    isHi = false
}) {
    if (!isOpen) return null;

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "18px", color: "#0F172A", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                        <IconDesk size={18} color="#0284C7" />
                        <span>{isHi ? "सेवा डेस्क संपादित करें" : "Edit Service Desk"}</span>
                    </h3>
                    <button type="button" onClick={onClose} style={modalCloseIconBtnStyle}><IconX size={15} /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                        <label style={fieldLabelStyle}>{isHi ? "विभाग बदलें" : "Assign to Department"} *</label>
                        <select
                            value={editDeskForm.dept_code}
                            onChange={(e) => setEditDeskForm({ ...editDeskForm, dept_code: e.target.value })}
                            style={fieldInputStyle}
                            required
                        >
                            {hospitalDepts.map((d) => (
                                <option key={d.dept_code} value={d.dept_code}>
                                    {d.name} ({d.dept_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={fieldLabelStyle}>{isHi ? "डेस्क नाम / संख्या" : "Desk Name / Number"} *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. OPD Consultation Desk 3"
                            value={editDeskForm.desk_name}
                            onChange={(e) => setEditDeskForm({ ...editDeskForm, desk_name: e.target.value })}
                            style={fieldInputStyle}
                        />
                    </div>

                    <div>
                        <label style={fieldLabelStyle}>{isHi ? "संबद्ध डॉक्टर / स्टाफ" : "Assigned Doctor / Staff"}</label>
                        <select
                            value={editDeskForm.assigned_employee_id}
                            onChange={(e) => setEditDeskForm({ ...editDeskForm, assigned_employee_id: e.target.value })}
                            style={fieldInputStyle}
                        >
                            <option value="">{isHi ? "कोई नहीं (स्वचालित/ओपन बे)" : "None (Auto-Assigned / Open Bay)"}</option>
                            {hospitalEmployees.some(e => (e.role || "").toLowerCase() === "doctor") && (
                                <optgroup label={isHi ? "🩺 डॉक्टर" : "🩺 Doctors"}>
                                    {hospitalEmployees.filter(e => (e.role || "").toLowerCase() === "doctor").map((doc) => {
                                        const currentDesk = getEmployeeCurrentDesk(doc);
                                        const isThisDesk = currentDesk && currentDesk.id === editDeskForm.id;
                                        return (
                                            <option key={doc.id || doc.employee_id_num} value={doc.id || doc.employee_id_num}>
                                                {doc.name || doc.username} ({getCategoryLabel(doc.department, language)}) {currentDesk ? (isThisDesk ? `[Currently Assigned Here]` : `[At ${currentDesk.desk_name}]`) : ""}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            )}
                            {hospitalEmployees.some(e => (e.role || "").toLowerCase() !== "doctor") && (
                                <optgroup label={isHi ? "अन्य स्टाफ एवं नर्स" : "Staff & Nurses"}>
                                    {hospitalEmployees.filter(e => (e.role || "").toLowerCase() !== "doctor").map((stf) => {
                                        const currentDesk = getEmployeeCurrentDesk(stf);
                                        const isThisDesk = currentDesk && currentDesk.id === editDeskForm.id;
                                        return (
                                            <option key={stf.id || stf.employee_id_num} value={stf.id || stf.employee_id_num}>
                                                {stf.name || stf.username} - {(stf.role || "staff").toUpperCase()} ({getCategoryLabel(stf.department, language)}) {currentDesk ? (isThisDesk ? `[Currently Assigned Here]` : `[At ${currentDesk.desk_name}]`) : ""}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            )}
                        </select>
                        <span style={{ fontSize: "11px", color: "#64748B", marginTop: "3px", display: "block" }}>
                            {isHi ? "यदि चयनित कर्मचारी किसी अन्य डेस्क पर है, तो वह स्वचालित रूप से इस डेस्क पर स्थानांतरित हो जाएगा।" : "Assigning an employee here will automatically reassign them from any previous desk."}
                        </span>
                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                        <button type="button" onClick={onClose} style={modalCancelBtnStyle}>
                            {isHi ? "रद्द करें" : "Cancel"}
                        </button>
                        <button type="submit" style={modalSubmitBtnStyle}>
                            {isHi ? "परिवर्तन सहेजें" : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function AssignDeskModal({
    isOpen,
    onClose,
    assignDeskTarget,
    setAssignDeskTarget,
    onAssign,
    onSubmit,
    assignSearchQuery,
    setAssignSearchQuery,
    hospitalEmployees = [],
    getEmployeeCurrentDesk = () => null,
    language = "en",
    isHi = false
}) {
    if (!isOpen || !assignDeskTarget?.desk) return null;

    const performAssign = (deskId, empId) => {
        if (typeof onAssign === "function") {
            return onAssign(deskId, empId);
        }
        if (typeof onSubmit === "function") {
            return onSubmit(deskId, empId);
        }
    };

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={{ ...modalContentStyle, maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "18px", color: "#0F172A", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                            <IconDesk size={18} color="#0284C7" />
                            <span>{isHi ? "डेस्क पर डॉक्टर / स्टाफ नियुक्त करें" : "Assign Desk to Doctor / Staff"}</span>
                        </h3>
                        <span style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", display: "block" }}>
                            {assignDeskTarget.desk.desk_name} &bull; {getCategoryLabel(assignDeskTarget.desk.dept_code, language)}
                        </span>
                    </div>
                    <button type="button" onClick={onClose} style={modalCloseIconBtnStyle}><IconX size={15} /></button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {/* Current status banner */}
                    <div style={{
                        padding: "10px 14px",
                        background: assignDeskTarget.desk.assigned_employee_id ? "#F0FDF4" : "#F8FAFC",
                        border: assignDeskTarget.desk.assigned_employee_id ? "1px solid #BBF7D0" : "1px solid #E2E8F0",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <div>
                            <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, display: "block" }}>
                                {isHi ? "वर्तमान स्टेशन स्थिति:" : "Current Station Status:"}
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: assignDeskTarget.desk.assigned_employee_id ? "#16A34A" : "#0F172A" }}>
                                {assignDeskTarget.desk.assigned_employee_id
                                    ? `${assignDeskTarget.desk.assigned_employee_name} (${(assignDeskTarget.desk.assigned_employee_role || "Staff").toUpperCase()})`
                                    : (isHi ? "स्वचालित / खाली बे" : "Auto-Assigned Bay (Unassigned)")}
                            </span>
                        </div>
                        {assignDeskTarget.desk.assigned_employee_id && (
                            <button
                                type="button"
                                onClick={() => performAssign(assignDeskTarget.desk.id, null)}
                                style={{
                                    background: "#FEE2E2",
                                    border: "1px solid #FCA5A5",
                                    borderRadius: "6px",
                                    padding: "4px 10px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: "#DC2626",
                                    cursor: "pointer",
                                }}
                            >
                                {isHi ? "अनअसाइन करें" : "Unassign Desk"}
                            </button>
                        )}
                    </div>

                    {/* Search & Select input */}
                    <div>
                        <label style={fieldLabelStyle}>
                            {isHi ? "डॉक्टर या स्टाफ सदस्य चुनें" : "Select Doctor or Staff Member"}
                        </label>
                        <input
                            type="text"
                            placeholder={isHi ? "नाम, पद या विभाग से खोजें..." : "Quick filter staff by name, role, or department..."}
                            value={assignSearchQuery}
                            onChange={(e) => setAssignSearchQuery(e.target.value)}
                            style={{ ...fieldInputStyle, marginBottom: "8px", fontSize: "12px" }}
                        />

                        <select
                            value={assignDeskTarget.employee_id}
                            onChange={(e) => setAssignDeskTarget({ ...assignDeskTarget, employee_id: e.target.value })}
                            style={{ ...fieldInputStyle, height: "42px" }}
                        >
                            <option value="">{isHi ? "-- कोई नहीं (स्वचालित/ओपन बे रखें) --" : "-- None (Keep as Auto-Assigned Bay) --"}</option>
                            {hospitalEmployees
                                .filter(e => {
                                    if (!assignSearchQuery) return true;
                                    const sq = assignSearchQuery.toLowerCase();
                                    return (e.name || "").toLowerCase().includes(sq) ||
                                        (e.role || "").toLowerCase().includes(sq) ||
                                        (e.department || "").toLowerCase().includes(sq) ||
                                        (e.email || "").toLowerCase().includes(sq);
                                })
                                .sort((a, b) => {
                                    if (a.role === "doctor" && b.role !== "doctor") return -1;
                                    if (a.role !== "doctor" && b.role === "doctor") return 1;
                                    return (a.name || "").localeCompare(b.name || "");
                                })
                                .map((emp) => {
                                    const isDoc = (emp.role || "").toLowerCase() === "doctor";
                                    const isOnline = (emp.status || "").toLowerCase() === "active";
                                    const currentDesk = getEmployeeCurrentDesk(emp);
                                    const isThisDesk = currentDesk && currentDesk.id === assignDeskTarget.desk?.id;
                                    return (
                                        <option key={emp.id || emp.employee_id_num} value={emp.id || emp.employee_id_num}>
                                            {isOnline ? "[Active]" : "[Inactive]"} {isDoc ? "[Doctor]" : "[Staff]"} {emp.name || emp.username} &bull; {(emp.role || "staff").toUpperCase()} &bull; {getCategoryLabel(emp.department, language)} {currentDesk ? (isThisDesk ? "★ (Assigned Here)" : `(Currently at ${currentDesk.desk_name})`) : "✓ (Available)"}
                                        </option>
                                    );
                                })}
                        </select>

                        {(() => {
                            const chosenEmp = hospitalEmployees.find(e => String(e.id || e.employee_id_num) === String(assignDeskTarget.employee_id));
                            if (chosenEmp && (chosenEmp.status || "").toLowerCase() !== "active") {
                                return (
                                    <div style={{ marginTop: "8px", padding: "10px 14px", background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: "10px", fontSize: "12px", color: "#B91C1C", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <IconAlertTriangle size={16} color="#F59E0B" />
                                        <div>
                                            <strong style={{ display: "block", marginBottom: "2px" }}>
                                                {isHi ? "चिकित्सक ऑफ़लाइन / निष्क्रिय हैं" : "Doctor / Staff Member is Offline (Inactive)"}
                                            </strong>
                                            <span>
                                                {isHi
                                                    ? "सिस्टम डॉक्टर उपलब्धता अनिवार्य करता है। ऑफ़लाइन कार्मिक को सक्रिय डेस्क पर नियुक्त नहीं किया जा सकता। बैकएंड इस अनुरोध को अस्वीकार करेगा।"
                                                    : "Backend policy strictly enforces active doctor presence. Assignment of inactive personnel to operational desks will be rejected."}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                        <button
                            type="button"
                            onClick={() => { onClose(); setAssignSearchQuery(""); }}
                            style={modalCancelBtnStyle}
                        >
                            {isHi ? "रद्द करें" : "Cancel"}
                        </button>
                        <button
                            type="button"
                            onClick={() => performAssign(assignDeskTarget.desk.id, assignDeskTarget.employee_id)}
                            style={modalSubmitBtnStyle}
                        >
                            {isHi ? "नियुक्ति सहेजें" : "Save Assignment"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AddDeskModal;
