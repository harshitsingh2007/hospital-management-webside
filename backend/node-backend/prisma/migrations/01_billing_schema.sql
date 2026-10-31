-- ============================================================================
-- Central Billing, Cashier & Service Tariffs Schema Migration
-- ============================================================================

-- 1. SERVICE TARIFFS (Master Price List per Hospital)
CREATE TABLE IF NOT EXISTS service_tariffs (
    id SERIAL PRIMARY KEY,
    hospital_id INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    department_code VARCHAR(100) NOT NULL DEFAULT 'general',
    service_code VARCHAR(100) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Consultation', -- Consultation, Lab, Radiology, Pharmacy, Procedure, Room, Other
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_service_tariffs_hosp_code UNIQUE (hospital_id, service_code)
);

CREATE INDEX IF NOT EXISTS idx_tariffs_hosp_dept ON service_tariffs(hospital_id, department_code);
CREATE INDEX IF NOT EXISTS idx_tariffs_hosp_cat ON service_tariffs(hospital_id, category);

-- 2. HOSPITAL BILLING COUNTERS (Concurrency-Safe Sequential Number Generator)
CREATE TABLE IF NOT EXISTS hospital_billing_counters (
    id SERIAL PRIMARY KEY,
    hospital_id INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    year INT NOT NULL,
    last_bill_seq INT NOT NULL DEFAULT 0,
    last_receipt_seq INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hosp_billing_counter_year UNIQUE (hospital_id, year)
);

-- 3. BILLS (Invoices)
CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    bill_number VARCHAR(100) NOT NULL,
    hospital_id INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    patient_id INT NULL REFERENCES patients(id) ON DELETE SET NULL,
    ticket_id VARCHAR(100) NULL,
    visit_id INT NULL REFERENCES visit_history(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- Draft, Pending, Partially Paid, Paid, Cancelled, Refunded
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_reason VARCHAR(255) NULL DEFAULT '',
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_by INT NULL REFERENCES employees(id) ON DELETE SET NULL,
    approved_by INT NULL REFERENCES employees(id) ON DELETE SET NULL,
    notes TEXT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bills_hosp_bill_number UNIQUE (hospital_id, bill_number)
);

CREATE INDEX IF NOT EXISTS idx_bills_hosp_status ON bills(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_hosp_ticket ON bills(hospital_id, ticket_id);
CREATE INDEX IF NOT EXISTS idx_bills_hosp_created ON bills(hospital_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills(patient_id);

-- 4. BILL ITEMS (Line Items per Invoice)
CREATE TABLE IF NOT EXISTS bill_items (
    id SERIAL PRIMARY KEY,
    bill_id INT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    tariff_id INT NULL REFERENCES service_tariffs(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    department_code VARCHAR(100) NULL DEFAULT '',
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    source VARCHAR(50) NOT NULL DEFAULT 'manual', -- manual, prescription, lab, radiology, pharmacy
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);

-- 5. PAYMENTS (Receipts & Multi-Mode Split Payments)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    bill_id INT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    receipt_number VARCHAR(100) NOT NULL,
    mode VARCHAR(50) NOT NULL DEFAULT 'Cash', -- Cash, UPI, Card, Net Banking, Cheque, Insurance-TPA
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reference_no VARCHAR(100) NULL DEFAULT '',
    received_by INT NULL REFERENCES employees(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'Success', -- Success, Failed, Reversed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_receipt_no ON payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_received_at ON payments(received_at);

-- 6. REFUNDS
CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    bill_id INT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    payment_id INT NULL REFERENCES payments(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(255) NOT NULL,
    approved_by INT NULL REFERENCES employees(id) ON DELETE SET NULL,
    created_by INT NULL REFERENCES employees(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_bill_id ON refunds(bill_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);

-- 7. CASH SHIFTS (Day-end Cashier Closing Reconciliation)
CREATE TABLE IF NOT EXISTS cash_shifts (
    id SERIAL PRIMARY KEY,
    hospital_id INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    cashier_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ NULL,
    opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    counted_cash NUMERIC(12,2) NULL,
    difference NUMERIC(12,2) NULL DEFAULT 0.00,
    notes TEXT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_hosp_cashier ON cash_shifts(hospital_id, cashier_id, closed_at);

