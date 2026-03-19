
# Shree Label ERP: Comprehensive User Manual

This document provides a complete guide to the Shree Label ERP system, covering everything from initial setup to the final dispatch of finished goods.

---

## PART 1 — FULL MENU STRUCTURE

### 📊 Dashboard
*   **Overview**: High-level real-time metrics for New Orders, Production Efficiency, Inventory Value, and Sales Revenue.

### 💰 Sales & Estimating
*   **Estimates**: Advanced flexo layout calculator to determine material consumption and suggested selling prices.
*   **Sales Orders**: The formal order book. Link estimates to confirmed customer purchase orders.
*   **Create Job**: The starting point for every manufacturing request. Captures technical requirements and artwork.

### 🎨 Design & Planning
*   **Job Planning**: Technical parameter entry (Plate IDs, Repeat Lengths) for jobs approved by administration.
*   **Artwork**: A centralized gallery for label designs with version control and approval status tracking.

### 🛒 Purchase
*   **Purchase Orders**: Procurement module for ordering raw substrates and consumables from vendors.
*   **GRN (Jumbo Entry)**: Substrate intake module capturing 19 technical columns for pharmaceutical-grade traceability.

### 📦 Inventory
*   **Stock Dashboard**: Analytical intelligence showing inventory valuation, gsm distribution, and low-stock alerts.
*   **Stock Registry**: The master list of all material (Jumbo Rolls, Slitted Rolls, and Finished Goods).
*   **Slitting (Conversion)**: Interactive tool to divide Jumbo rolls into specific job-assigned widths.
*   **Finished Goods**: Inventory of printed and packed labels ready for delivery.
*   **Die Management**: Tracking the lifecycle and usage of cutting dies.

### 🏭 Production
*   **Job Cards**: Floor instructions for press operators.
*   **BOM**: Technical specification sheets pulling from approved estimates.
*   **Work Orders**: Daily scheduling of tasks to specific machines.
*   **Live Floor**: Real-time monitoring of machine speeds and output.

### 🛡️ Quality & Logistics
*   **Quality Control**: Inspection logging. **Passing a job here automatically creates Finished Goods stock.**
*   **Dispatch**: Generation of Delivery Challans and shipping manifests.
*   **Billing**: GST-compliant invoicing linked to dispatched orders.

### ⚙️ Administration
*   **Master Data**: Global directory for Materials, Machines, Customers, and Suppliers.
*   **Stock Import**: Bulk Excel upload utility for legacy stock migration.
*   **Job Approvals**: Critical gatekeeping queue for management to review Sales Jobs.
*   **System Logic**: Configuration for Pricing Dividers, Roll Numbering, and Job ID formats.
*   **User Management**: Employee directory and role assignments.
*   **Maintenance**: Database migration and reset utilities.

---

## PART 2 — ROLE BASED FLOW

| Role | Primary Menus | Key Actions | Restrictions |
| :--- | :--- | :--- | :--- |
| **Admin** | Full Access | Approve Jobs, Set Pricing, Manage Users | None. |
| **Sales** | Sales, Artwork | Create Jobs, Upload Art, Track Orders | Cannot edit Jobs after Admin Approval. |
| **Design** | Planning, Artwork | Enter Technical Specs, Upload Proofs | 30-minute time lock on technical edits. |
| **Operator** | Slitting, Production | Execute Conversion, Start Press, Log Waste | Cannot view financial data or modify Master Data. |
| **QC** | Quality Control | Verify Job Quality, Pass/Fail Reports | Cannot modify production schedules. |

---

## PART 3 — END-TO-END PROCESS FLOW

1.  **Sales Initiation**: Sales creates a Job. The system atomically generates a **Unique Job ID** (e.g., JOB-2026-0001).
2.  **Gatekeeping**: Admin reviews the Job in the **Approval Queue**. Upon approval, financial data is locked.
3.  **Technical Plan**: The Job appears on the **Planning Board**. Design enters Plate Nos and Repeat Lengths.
4.  **Material Allocation**: The **Slitting Module** suggests the best-matching Jumbo roll based on material type.
5.  **Conversion**: Slitting marks the Jumbo as `Consumed` and creates **Assigned Child Rolls** for the specific job.
6.  **Floor Execution**: Operator starts the Job Card. The child roll status moves to `In Production`.
7.  **Final Verification**: QC inspects the output. On "Pass", the system generates **Finished Good** inventory.
8.  **Shipping**: Logistics creates a Dispatch Note, reducing the Finished Goods stock and triggering Billing.

---

## PART 4 — DATA DISPLAY LOCATION

*   **If you run a Slitting Run** → The new child rolls appear in the **Stock Registry**.
*   **If Admin approves a Job** → It appears on the **Technical Planning Board**.
*   **If a roll falls below 10% length** → A warning appears in the **Dashboard Alerts**.
*   **If QC passes a job** → The labels appear in the **Finished Goods Store**.

---

## PART 5 — COLLECTION IMPACT MAP

*   `jobs`: Updated by Sales, Admin (Approval), and Design (Technical Specs).
*   `paper_stock`: Updated by Purchase (GRN), Stock Import, and Operator (Slitting Consumption).
*   `inventoryItems`: Created by QC (Finished Goods).
*   `counters`: Incremented atomically during Job and Roll creation.

---

## PART 6 — CURRENT SYSTEM STATUS

*   ✅ **Production Ready**: Sales, Estimates, GRN (19-column), Slitting, Stock Analytics, Migration.
*   ⚠️ **Standard Flow**: Job Cards, Invoicing, Dispatch (Functional but UI-only logic in some areas).
*   🛠️ **Under Maintenance**: Advanced GPS Vehicle Tracking (External API dependent).

---

## PART 7 — USER TEST GUIDE (First Time Users)

1.  **Step 1**: Log in using **Guest Access**.
2.  **Step 2**: Go to **Purchase > GRN** and add a test Jumbo roll (Material: Chromo).
3.  **Step 3**: Go to **Sales > Create Job**. Submit a new label request for "Client A".
4.  **Step 4**: Go to **Administration > Job Approvals**. Find your job and click **Approve**.
5.  **Step 5**: Go to **Design > Job Planning**. Click the Edit icon and enter any Plate Number.
6.  **Step 6**: Go to **Inventory > Slitting**. Select your job, match it to the Jumbo roll, and execute.
7.  **Step 7**: Go to **Inventory > Stock Registry**. Confirm your child rolls are now status "ASSIGNED".

---
*Documentation Version: 2.2 (Data Architecture Sync)*
