# USD/EUR Exchange Rate Web Application - Software Specification

## 1\. Project Overview

### 1.1 Purpose

A web application that allows users to upload CSV files containing USD/EUR exchange rate data and visualize the data through an interactive line chart with time-based filtering and analysis capabilities.

### 1.2 Scope

The application will provide a complete solution for visualizing historical USD/EUR exchange rate data with modern UI/UX, comprehensive data validation, and advanced chart interactions.

## 2\. Technical Requirements

### 2.1 Technology Stack

* **Runtime**: Node.js (Latest LTS)
* **Frontend Framework**: Vite
* **Charting Library**: Chart.js with `chartjs-adapter-date-fns`
* **CSS Framework**: Tailwind CSS
* **File Processing**: Native File API + CSV parsing library

## 3\. Functional Requirements

### 3.1 Data Upload

* **FR-001**: Drag-and-drop CSV file upload area
* **FR-002**: Alternative file selection button
* **FR-003**: Visual feedback during file upload (loading states)
* **FR-004**: Support for CSV files up to 10MB
* **FR-005**: Accept only `.csv` file extensions

### 3.2 Data Validation

* **FR-006**: Validate CSV structure (required columns: `observation\_date`, `DEXUSEU`)
* **FR-007**: Validate date format (YYYY-MM-DD; M/D/YYYY is also accepted)
* **FR-008**: Validate exchange rate values (numeric, positive)
* **FR-009**: Display clear error messages for validation failures
* **FR-010**: Automatically drop rows with missing values
* **FR-011**: Show data processing summary (total rows, dropped rows, valid rows)

### 3.3 Chart Visualization

* **FR-012**: Line chart with date on x-axis and exchange rate on y-axis
* **FR-013**: Default time range: 1 year from most recent date
* **FR-014**: Time range selector with predefined intervals:

  * 1 Year
  * 5 Years
  * 10 Years
  * Max (all data)
* **FR-015**: Interactive tooltip showing exact date and exchange rate
* **FR-016**: Vertical crosshair on hover
* **FR-017**: Zoom functionality (mouse wheel)
* **FR-018**: Pan functionality when zoomed
* **FR-019**: Reset zoom button
* **FR-020**: Fullscreen mode toggle

### 3.4 Chart Labels and Legend

* **FR-021**: X-axis label: "Date"
* **FR-022**: Y-axis label: "USD per EUR"
* **FR-023**: Chart title: "USD/EUR Exchange Rate"
* **FR-024**: Legend showing data series information
* **FR-025**: Responsive axis formatting based on time range

## 4\. User Interface Requirements

### 4.1 Design System

* **UI-001**: Modern, minimal design aesthetic
* **UI-002**: Clean typography (system fonts)
* **UI-003**: Subtle shadows and rounded corners
* **UI-004**: Consistent spacing using 8px grid system
* **UI-005**: Accessible color contrast ratios (WCAG AA)

### 4.2 Color Scheme

```css
:root {
  --primary-color: #2563eb;
  --secondary-color: #64748b;
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
  --background: #ffffff;
  --surface: #f8fafc;
  --border: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
}
```

### 4.3 Layout Structure

* **UI-006**: Header with application title
* **UI-007**: Main content area with upload section and chart container
* **UI-008**: Upload area prominently displayed when no data loaded
* **UI-009**: Chart controls (time range selector, zoom controls, fullscreen)
* **UI-010**: Responsive design for desktop browser windows of different sizes
* **UI-011**: Maximum content width: 1200px, centered

### 4.4 Upload Area Design

* **UI-012**: Dashed border drag-and-drop zone
* **UI-013**: Upload icon and instructional text
* **UI-014**: Visual feedback on drag hover (border color change)
* **UI-015**: File selection button as alternative
* **UI-016**: Progress indicator during file processing

### 4.5 Chart Container

* **UI-017**: Minimum height: 400px
* **UI-018**: Responsive width (100% of container)
* **UI-019**: Chart controls positioned above chart
* **UI-020**: Fullscreen mode: overlay with dark background
* **UI-021**: Loading skeleton while chart renders

## 5\. Non-Functional Requirements

### 5.1 Performance

* **NFR-001**: Initial page load < 2 seconds
* **NFR-002**: Chart rendering < 1 second for datasets up to 10,000 points
* **NFR-003**: Smooth animations (60fps) for zoom/pan operations
* **NFR-004**: File processing < 3 seconds for 10MB CSV files

### 5.2 Usability

* **NFR-005**: Intuitive interface requiring no training
* **NFR-006**: Clear error messages with actionable guidance
* **NFR-007**: Keyboard navigation support
* **NFR-008**: Desktop browsers only; phones and tablets are out of scope

### 5.3 Accessibility

* **NFR-009**: WCAG 2.1 AA compliance
* **NFR-010**: Screen reader compatibility
* **NFR-011**: Keyboard-only navigation
* **NFR-012**: Focus indicators for interactive elements
* **NFR-013**: Alt text for visual elements

### 5.4 Security

* **NFR-014**: Client-side only processing (no data uploaded to servers)
* **NFR-015**: File type validation
* **NFR-016**: Input sanitization for CSV content

## 6\. Data Requirements

### 6.1 Input Data Format

```csv
observation\_date,DEXUSEU
1999-01-04,1.1812
1999-01-05,1.1760
1999-01-06,
1999-01-07,1.1672
```

Dates may also use M/D/YYYY (e.g. `1/4/1999`), as in the FRED `DEXUSEU.csv` export. Empty cells and `.` are treated as missing values.

### 6.2 Data Processing Rules

* **DR-001**: Parse dates using ISO format (YYYY-MM-DD) or US format (M/D/YYYY)
* **DR-002**: Convert exchange rates to floating-point numbers
* **DR-003**: Remove rows where either field is empty/invalid
* **DR-004**: Sort data chronologically by date
* **DR-005**: Handle duplicate dates (keep first occurrence)

### 6.3 Data Validation Rules

* **DR-006**: Date must be valid calendar date
* **DR-007**: Exchange rate must be positive number
* **DR-008**: Minimum dataset size: 10 valid data points
* **DR-009**: Maximum dataset size: 50,000 data points

## 7\. Error Handling

### 7.1 File Upload Errors

* **EH-001**: Invalid file type → "Please upload a CSV file"
* **EH-002**: File too large → "File size must be less than 10MB"
* **EH-003**: Empty file → "The uploaded file is empty"
* **EH-004**: File read error → "Unable to read the file. Please try again"

### 7.2 Data Validation Errors

* **EH-005**: Missing required columns → "CSV must contain 'observation\_date' and 'DEXUSEU' columns"
* **EH-006**: Invalid date format → "Dates must be in YYYY-MM-DD format (M/D/YYYY is also accepted)"
* **EH-007**: Invalid exchange rates → "Exchange rates must be positive numbers"
* **EH-008**: Insufficient data → "At least 10 valid data points required"
* **EH-009**: Too much data → "Maximum 50,000 data points supported"

### 7.3 Chart Errors

* **EH-010**: Chart rendering failure → "Unable to display chart. Please refresh and try again"
* **EH-011**: Zoom/pan errors → Graceful fallback to default view

## 8\. User Stories

### 8.1 Primary User Flow

```
As a financial analyst,
I want to upload USD/EUR exchange rate data,
So that I can visualize trends over different time periods.
```

**Acceptance Criteria:**

* User can drag and drop CSV file onto upload area
* System validates data and shows processing summary
* Chart displays with 1-year default view
* User can change time ranges and interact with chart
* User can zoom, pan, and view in fullscreen

### 8.2 Error Recovery Flow

```
As a user,
I want clear error messages when my data is invalid,
So that I can fix the issues and successfully upload my data.
```

**Acceptance Criteria:**

* Clear, actionable error messages
* Ability to upload new file without page refresh
* Validation summary showing specific issues

## 11\. Testing Requirements

### 11.1 Unit Tests

* File validation functions
* Data processing utilities
* Chart configuration logic

### 11.2 Integration Tests

* End-to-end upload and visualization flow
* Error handling scenarios
* Chart interactions



## 12\. Deployment

### 12.1 Build Configuration

* Vite production build optimization
* Asset minification and compression
* Source map generation for debugging

### 12.2 Static Hosting

* Compatible with any static hosting service
* No server-side requirements
* CDN-friendly asset structure
