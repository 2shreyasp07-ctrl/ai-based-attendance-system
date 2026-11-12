import { Student, AttendanceRecord } from '../types/attendance';

const STORAGE_KEYS = {
  STUDENTS: 'smart_attendance_students',
  RECORDS: 'smart_attendance_records',
  SETTINGS: 'smart_attendance_settings',
};

export function getCurrentDateFormatted(d: Date = new Date()): {
  date: string; // DD/MM/YYYY
  time: string; // HH:MM:SS 12-hour AM/PM
  day: string; // e.g., Thursday
} {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = dayNames[d.getDay()];

  const dayOfMonth = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const date = `${dayOfMonth}/${month}/${year}`;

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const strHours = String(hours).padStart(2, '0');
  const time = `${strHours}:${minutes}:${seconds} ${ampm}`;

  return { date, time, day };
}

export function parseDateString(dateStr: string): Date | null {
  // Parses "DD/MM/YYYY"
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

// Students API
export function getStoredStudents(): Student[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load students from localStorage:', err);
    return [];
  }
}

export function saveStoredStudents(students: Student[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  } catch (err) {
    console.error('Failed to save students to localStorage:', err);
  }
}

export function addOrUpdateStudent(student: Student): { success: boolean; error?: string } {
  const students = getStoredStudents();
  // Check roll number uniqueness for other students
  const existingWithRoll = students.find(
    (s) => s.rollNumber.trim().toLowerCase() === student.rollNumber.trim().toLowerCase() && s.id !== student.id
  );
  if (existingWithRoll) {
    return {
      success: false,
      error: `Roll Number "${student.rollNumber}" is already assigned to ${existingWithRoll.name}.`,
    };
  }

  const index = students.findIndex((s) => s.id === student.id);
  if (index >= 0) {
    students[index] = student;
  } else {
    students.unshift(student);
  }

  saveStoredStudents(students);
  return { success: true };
}

export function deleteStoredStudent(studentId: string): void {
  const students = getStoredStudents().filter((s) => s.id !== studentId);
  saveStoredStudents(students);
}

// Attendance Records API
export function getStoredAttendanceRecords(): AttendanceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) return [];
    const parsed: AttendanceRecord[] = JSON.parse(raw);
    // Sort newest first
    return parsed.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error('Failed to load attendance records:', err);
    return [];
  }
}

export function saveStoredAttendanceRecords(records: AttendanceRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save attendance records:', err);
  }
}

export function markAttendance(
  student: Student,
  method: 'Face Recognition' | 'Manual' = 'Face Recognition',
  confidence = 0.95,
  distance = 0.25
): { success: boolean; isAlreadyMarked: boolean; record?: AttendanceRecord } {
  const { date, time, day } = getCurrentDateFormatted();
  const records = getStoredAttendanceRecords();

  // Check if student is already marked today
  const alreadyMarked = records.find(
    (r) => r.studentId === student.id && r.date === date
  );

  if (alreadyMarked) {
    return { success: false, isAlreadyMarked: true, record: alreadyMarked };
  }

  const newRecord: AttendanceRecord = {
    id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    studentId: student.id,
    studentName: student.name,
    rollNumber: student.rollNumber,
    classDivision: student.classDivision || 'General',
    time,
    day,
    date,
    timestamp: Date.now(),
    status: 'Present',
    confidence,
    distance,
    verificationMethod: method,
  };

  records.unshift(newRecord);
  saveStoredAttendanceRecords(records);

  return { success: true, isAlreadyMarked: false, record: newRecord };
}

export function clearAllAttendanceRecords(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.RECORDS);
}

// CSV Export Generator
export function exportRecordsToCSV(records: AttendanceRecord[]): void {
  if (!records || records.length === 0) return;

  const headers = ['Record ID', 'Roll Number', 'Student Name', 'Class/Division', 'Date (DD/MM/YYYY)', 'Day', 'Time', 'Status', 'Verification Method', 'Confidence'];
  const rows = records.map((r) => [
    `"${r.id}"`,
    `"${r.rollNumber}"`,
    `"${r.studentName}"`,
    `"${r.classDivision || 'General'}"`,
    `"${r.date}"`,
    `"${r.day}"`,
    `"${r.time}"`,
    `"${r.status}"`,
    `"${r.verificationMethod}"`,
    `"${r.confidence ? Math.round(r.confidence * 100) + '%' : 'N/A'}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const { date } = getCurrentDateFormatted();
  const safeDate = date.replace(/\//g, '-');
  link.setAttribute('download', `Attendance_Report_${safeDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Seed Demo Students for instant test and evaluation
export function seedSampleStudentsIfEmpty(): void {
  const current = getStoredStudents();
  if (current.length > 0) return;

  // Create an initial cohort with sample avatar SVG data URLs
  const sampleData: Array<{ name: string; roll: string; dept: string; bg: string }> = [
    { name: 'Alex Johnson', roll: 'CS-2024-001', dept: 'Computer Science A', bg: '#0284c7' },
    { name: 'Sophia Chen', roll: 'CS-2024-002', dept: 'Computer Science A', bg: '#0d9488' },
    { name: 'Marcus Davis', roll: 'CS-2024-003', dept: 'Computer Science B', bg: '#6366f1' },
    { name: 'Priya Sharma', roll: 'CS-2024-004', dept: 'Computer Science A', bg: '#ec4899' },
    { name: 'Liam Wilson', roll: 'CS-2024-005', dept: 'Computer Science B', bg: '#f59e0b' },
  ];

  const seeded: Student[] = sampleData.map((item, i) => {
    // Generate clean SVG avatar thumbnail
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="16" fill="${item.bg}"/>
      <circle cx="60" cy="45" r="22" fill="#ffffff" fill-opacity="0.9"/>
      <path d="M25 105 C25 80, 40 70, 60 70 C80 70, 95 80, 95 105 Z" fill="#ffffff" fill-opacity="0.9"/>
      <text x="60" y="115" text-anchor="middle" fill="#ffffff" font-size="10" font-family="sans-serif" font-weight="bold">${item.roll}</text>
    </svg>`;
    const thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    // Generate simulated 128-float unit vectors for descriptors
    const descriptors: number[][] = [];
    for (let s = 0; s < 3; s++) {
      const vec: number[] = [];
      let norm = 0;
      for (let d = 0; d < 128; d++) {
        const val = Math.sin(i * 10 + s * 3 + d * 0.1);
        vec.push(val);
        norm += val * val;
      }
      const sqrtNorm = Math.sqrt(norm);
      descriptors.push(vec.map((v) => v / sqrtNorm));
    }

    return {
      id: `std_${Date.now()}_${i}`,
      name: item.name,
      rollNumber: item.roll,
      classDivision: item.dept,
      thumbnail,
      descriptors,
      registeredAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    };
  });

  saveStoredStudents(seeded);

  // Also pre-seed a couple of yesterday / today records to make dashboard live on launch
  const { date, time, day } = getCurrentDateFormatted();
  const initialRecords: AttendanceRecord[] = [
    {
      id: 'att_init_1',
      studentId: seeded[0].id,
      studentName: seeded[0].name,
      rollNumber: seeded[0].rollNumber,
      classDivision: seeded[0].classDivision,
      time: '08:55:12 AM',
      day,
      date,
      timestamp: Date.now() - 3600000 * 2,
      status: 'Present',
      confidence: 0.96,
      distance: 0.18,
      verificationMethod: 'Face Recognition',
    },
    {
      id: 'att_init_2',
      studentId: seeded[1].id,
      studentName: seeded[1].name,
      rollNumber: seeded[1].rollNumber,
      classDivision: seeded[1].classDivision,
      time: '09:04:30 AM',
      day,
      date,
      timestamp: Date.now() - 3600000 * 1.5,
      status: 'Present',
      confidence: 0.94,
      distance: 0.22,
      verificationMethod: 'Face Recognition',
    },
  ];
  saveStoredAttendanceRecords(initialRecords);
}
