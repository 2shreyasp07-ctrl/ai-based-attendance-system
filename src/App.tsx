/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ActiveTab, Student, AttendanceRecord, ModelLoadProgress } from './types/attendance';
import { Navbar } from './components/Navbar';
import { ModelLoadingBanner } from './components/ModelLoadingBanner';
import { DashboardView } from './components/DashboardView';
import { AttendanceScannerView } from './components/AttendanceScannerView';
import { RegisterStudentView } from './components/RegisterStudentView';
import { RecordsView } from './components/RecordsView';
import { PrivacyModal } from './components/PrivacyModal';
import {
  getStoredStudents,
  getStoredAttendanceRecords,
  seedSampleStudentsIfEmpty,
} from './services/storageService';
import { loadFaceApiModels } from './services/faceApiService';
import { ShieldCheck, Lock } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('smart_attendance_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);

  const [modelProgress, setModelProgress] = useState<ModelLoadProgress>({
    status: 'loading',
    stage: 'Connecting to face-api CDN...',
  });

  // Apply dark class to <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('smart_attendance_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('smart_attendance_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Refresh students & records from localStorage
  const refreshData = useCallback(() => {
    setStudents(getStoredStudents());
    setRecords(getStoredAttendanceRecords());
  }, []);

  // Initialize data and load AI models
  const initModels = useCallback(async () => {
    setModelProgress({
      status: 'loading',
      stage: 'Downloading neural network weights...',
    });

    const res = await loadFaceApiModels((stage) => {
      setModelProgress((prev) => ({
        ...prev,
        stage,
      }));
    });

    if (res.success) {
      setModelProgress({
        status: 'loaded',
        stage: 'AI Models Ready',
      });
    } else {
      setModelProgress({
        status: 'error',
        stage: 'Failed',
        error: res.error,
      });
    }
  }, []);

  useEffect(() => {
    // Seed initial cohort so user immediately has working attendance data & test profiles
    seedSampleStudentsIfEmpty();
    refreshData();
    initModels();
  }, [refreshData, initModels]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 3-Zone Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Model Loading Status Banner (if loading or failed) */}
        <ModelLoadingBanner
          status={modelProgress.status}
          stage={modelProgress.stage}
          error={modelProgress.error}
          onRetry={initModels}
        />

        {/* Active Tab View */}
        {activeTab === 'dashboard' && (
          <DashboardView
            students={students}
            records={records}
            onNavigate={setActiveTab}
            onRefreshRecords={refreshData}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceScannerView
            students={students}
            records={records}
            onRefreshRecords={refreshData}
            onNavigateToRegister={() => setActiveTab('register')}
          />
        )}

        {activeTab === 'register' && (
          <RegisterStudentView
            students={students}
            onRefreshStudents={refreshData}
          />
        )}

        {activeTab === 'records' && (
          <RecordsView
            students={students}
            records={records}
            onRefreshRecords={refreshData}
          />
        )}
      </main>

      {/* Privacy Modal */}
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />

      {/* Quiet Footer with Device Storage Note */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-5 text-xs text-slate-500 dark:text-slate-400 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>
              Face recognition models & biometric descriptors are processed and stored exclusively on this device.
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              Privacy Policy
            </button>
            <span aria-hidden="true">·</span>
            <span>Local Storage Engine</span>
            <span aria-hidden="true">·</span>
            <span>face-api.js v1.7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
