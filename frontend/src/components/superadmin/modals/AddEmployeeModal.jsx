import React from "react";
import { IconUsers, IconCheckCircle, IconCopy, IconX } from "../SuperAdminIcons";
import {
    modalOverlayStyle,
    modalContentStyle,
    modalCloseIconBtnStyle,
    modalCancelBtnStyle,
    modalSubmitBtnStyle,
    fieldLabelStyle,
    fieldInputStyle
} from "../superAdminStyles";

export default function AddEmployeeModal({
    isOpen,
    onClose,
    newEmployeeForm,
    setNewEmployeeForm,
    onSubmit,
    hospitalDepts = [],
    createdCredentials,
    onCloseCredentials,
    onNotify,
    isHi = false
}) {
    if (!isOpen && !createdCredentials) return null;

    if (createdCredentials) {
        return (
            <div style={modalOverlayStyle} onClick={onCloseCredentials}>
                <div 
                    className="hide-modal-scrollbar"
                    style={{ ...modalContentStyle, scrollbarWidth: "none", msOverflowStyle: "none" }} 
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ margin: 0, fontSize: "18px", color: "#0F172A", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                            <IconCheckCircle size={18} color="#16A34A" />
                            <span>{isHi ? "कर्मचारी क्रेडेंशियल तैयार हैं" : "Employee Account Provisioned"}</span>
                        </h3>
                        <button type="button" onClick={onCloseCredentials} style={modalCloseIconBtnStyle}>
                            <IconX size={15} />
                        </button>
                    </div>

                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                            <div>
                                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Name</span>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>{createdCredentials.name}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Role</span>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase" }}>{createdCredentials.role}</div>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                            <div>
                                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Assigned Employee ID</span>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: "#1E40AF" }}>{createdCredentials.employee_id || "N/A"}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Login Email</span>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>{createdCredentials.email}</div>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                            <div>
                                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Temporary Password</span>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: "#DC2626", fontFamily: "monospace" }}>{createdCredentials.password}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Hospital</span>
                                <div style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>{createdCredentials.hospital_name}</div>
                            </div>
                        </div>

                        {(createdCredentials.specialization || createdCredentials.room_number) && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                {createdCredentials.specialization && (
                                    <div>
                                        <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Specialization</span>
                                        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0284C7" }}>{createdCredentials.specialization}</div>
                                    </div>
                                )}
                                {createdCredentials.room_number && (
                                    <div>
                                        <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>OPD Cabin</span>
                                        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#D97706" }}>{createdCredentials.room_number}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={() => {
                                const text = `Hospital: ${createdCredentials.hospital_name}\nRole: ${createdCredentials.role.toUpperCase()}\nName: ${createdCredentials.name}\nAssigned ID: ${createdCredentials.employee_id}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
                                navigator.clipboard.writeText(text);
                                if (onNotify) onNotify(isHi ? "क्रेडेंशियल कॉपी हो गए!" : "Credentials copied to clipboard!");
                            }}
                            style={{ ...modalSubmitBtnStyle, background: "#0284C7", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                            <IconCopy size={14} />
                            <span>{isHi ? "क्रेडेंशियल कॉपी करें" : "Copy Credentials"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={onCloseCredentials}
                            style={modalCancelBtnStyle}
                        >
                            {isHi ? "बंद करें" : "Done"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div 
                className="hide-modal-scrollbar"
                style={{ 
                    ...modalContentStyle, 
                    maxWidth: "800px", 
                    width: "100%", 
                    padding: "22px 28px",
                    maxHeight: "94vh",
                    overflowY: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none"
                }} 
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "18px", color: "#0F172A", fontWeight: 800, display: "flex", alignItems: "center", gap: "9px" }}>
                        <IconUsers size={20} color="#0284C7" />
                        <span>{isHi ? "नया डॉक्टर / कर्मचारी जोड़ें" : "Add Doctor / Employee"}</span>
                    </h3>
                    <button type="button" onClick={onClose} style={modalCloseIconBtnStyle}>
                        <IconX size={16} />
                    </button>
                </div>

                <div style={{ marginBottom: "12px", padding: "8px 14px", borderRadius: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE", fontSize: "12px", color: "#1E40AF", lineHeight: 1.4 }}>
                    <strong>Staff Desk Provisioning:</strong> Enter the Login Email ID and Password for this doctor or staff member. They will use these exact credentials to sign in to their clinical desk.
                </div>

                <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
                    {/* Row 1: Name and Employee ID */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px 16px" }}>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "पूरा नाम" : "Doctor / Staff Full Name"} *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Dr. Priya Sharma / Rahul Verma"
                                value={newEmployeeForm.name || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, name: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "कर्मचारी आईडी" : "Employee / Badge ID"}</label>
                            <input
                                type="text"
                                placeholder="e.g. DOC-101"
                                value={newEmployeeForm.employee_id || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, employee_id: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                    </div>

                    {/* Row 2: Role, Department, Phone */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: "10px 16px" }}>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "भूमिका (Role)" : "Role"} *</label>
                            <select
                                value={newEmployeeForm.role || "doctor"}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, role: e.target.value })}
                                style={fieldInputStyle}
                            >
                                <option value="doctor">DOCTOR</option>
                                <option value="admin">HOSPITAL ADMIN</option>
                                <option value="staff">STAFF</option>
                                <option value="receptionist">RECEPTIONIST</option>
                            </select>
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "विभाग (Department)" : "Department"} *</label>
                            <select
                                value={newEmployeeForm.department || "consultation"}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, department: e.target.value })}
                                style={fieldInputStyle}
                            >
                                {hospitalDepts.map((d) => (
                                    <option key={d.dept_code} value={d.dept_code}>
                                        {d.name}
                                    </option>
                                ))}
                                <option value="all">All Departments (Admin)</option>
                            </select>
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "फ़ोन नंबर" : "Phone Number"}</label>
                            <input
                                type="text"
                                placeholder="+91 98765 43210"
                                value={newEmployeeForm.phone || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, phone: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                    </div>

                    {/* Row 3: Login Email and Password */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "10px 16px" }}>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "लॉगिन ईमेल आईडी" : "Login Email ID"} *</label>
                            <input
                                type="email"
                                required
                                placeholder="doctor@hospital.com"
                                value={newEmployeeForm.email || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, email: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "लॉगिन पासवर्ड" : "Desk Login Password"} *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. pass123"
                                value={newEmployeeForm.password || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, password: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                    </div>

                    {/* Professional & Clinical Details Section Banner */}
                    <div style={{
                        margin: "2px 0",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        background: "rgba(2, 132, 199, 0.06)",
                        border: "1px dashed rgba(2, 132, 199, 0.3)",
                    }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {isHi ? "चिकित्सा एवं व्यावसायिक जानकारी" : "Clinical & Professional Details"}
                        </span>
                    </div>

                    {/* Row 4: Qualification, Specialization, License */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: "10px 16px" }}>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "योग्यता / डिग्री" : "Medical Qualification"}</label>
                            <input
                                type="text"
                                placeholder="e.g. MBBS, MD, MS"
                                value={newEmployeeForm.qualification || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, qualification: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "विशेषज्ञता / पद" : "Specialization / Sub-specialty"}</label>
                            <input
                                type="text"
                                placeholder="e.g. Senior Cardiologist"
                                value={newEmployeeForm.specialization || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, specialization: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "चिकित्सा लाइसेंस / पंजीकरण संख्या" : "Medical License / Reg No."}</label>
                            <input
                                type="text"
                                placeholder="e.g. MCI/NMC-49210"
                                value={newEmployeeForm.license_number || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, license_number: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                    </div>

                    {/* Row 5: Cabin, Experience, Gender */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 16px" }}>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "ओपीडी केबिन / कमरा संख्या" : "OPD Cabin / Room No."}</label>
                            <input
                                type="text"
                                placeholder="e.g. Cabin 104, Room 3"
                                value={newEmployeeForm.room_number || ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, room_number: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "अनुभव (वर्ष)" : "Experience (Years)"}</label>
                            <input
                                type="number"
                                min="0"
                                max="60"
                                placeholder="e.g. 8"
                                value={newEmployeeForm.experience_years !== undefined ? newEmployeeForm.experience_years : ""}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, experience_years: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "लिंग" : "Gender"}</label>
                            <select
                                value={newEmployeeForm.gender || "other"}
                                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, gender: e.target.value })}
                                style={fieldInputStyle}
                            >
                                <option value="male">{isHi ? "पुरुष (Male)" : "Male"}</option>
                                <option value="female">{isHi ? "महिला (Female)" : "Female"}</option>
                                <option value="other">{isHi ? "अन्य (Other / Unspecified)" : "Other / Unspecified"}</option>
                            </select>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                        <button type="button" onClick={onClose} style={modalCancelBtnStyle}>
                            {isHi ? "रद्द करें" : "Cancel"}
                        </button>
                        <button type="submit" style={modalSubmitBtnStyle}>
                            {isHi ? "कर्मचारी जोड़ें" : "Add Employee"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
