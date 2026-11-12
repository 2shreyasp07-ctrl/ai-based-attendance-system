/**
 * Type definitions for Smart AI Attendance System
 */

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  classDivision?: string;
  thumbnail: string; // Base64 JPEG data URL
  descriptors: number[][]; // 3 to 5 face descriptors (each 128 float numbers)
  registeredAt: string; // ISO string
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classDivision?: string;
  time: string; // HH:MM:SS 12-hour AM/PM format (e.g. "09:42:15 AM")
  day: string; // e.g. "Thursday"
  date: string; // DD/MM/YYYY
  timestamp: number; // Unix epoch ms
  status: 'Present';
  confidence?: number; // Match confidence (0 to 1)
  distance?: number; // Euclidean distance (< 0.5 is a match)
  verificationMethod: 'Face Recognition' | 'Manual';
}

export interface FaceMatchResult {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  rollNumber?: string;
  distance: number;
  confidence: number;
  isRecognized: boolean;
  isAlreadyMarkedToday: boolean;
  markedTime?: string;
  livenessVerified: boolean;
}

export type ActiveTab = 'dashboard' | 'attendance' | 'register' | 'records';

export interface ModelLoadProgress {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  stage: string;
  error?: string;
}
