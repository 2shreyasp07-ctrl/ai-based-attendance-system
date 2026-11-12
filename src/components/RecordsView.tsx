import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  Calendar,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { Student, AttendanceRecord } from '../types/attendance';
import {
  exportRecordsToCSV,
  clearAllAttendanceRecords,
  getCurrentDateFormatted,
} from '../services/storageService';

interface RecordsViewProps {
  students: Student[];
  records: AttendanceRecord[];
  onRefreshRecords: () => void;
}

export const RecordsView: React.FC<RecordsViewProps> = ({
  students,
  records,
  onRefreshRecords,
}) => {
  const { date: todayDate } = getCurrentDateFormatted();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('all'); // 'all', 'today', or specific DD/MM/YYYY
  const [filterClass, setFilterClass] = useState<string>('all');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);

  // Map student thumbnail for records
  const studentMap = new Map<string, Student>(students.map((s) => [s.id, s]));

  // Get distinct dates for filtering
  const distinctDates = Array.from(new Set(records.map((r) => r.date)));
  const distinctClasses = Array.from(
    new Set(records.map((r) => r.classDivision || 'General'))
  );

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate =
      filterDate === 'all'
        ? true
        : filterDate === 'today'
        ? r.date === todayDate
        : r.date === filterDate;

    const matchesClass =
      filterClass === 'all' ? true : (r.classDivision || 'General') === filterClass;

    return matchesSearch && matchesDate && matchesClass;
  });

  const handleExportCSV = () => {
    exportRecordsToCSV(filteredRecords);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmClearAll = () => {
    clearAllAttendanceRecords();
    setShowClearConfirmModal(false);
    onRefreshRecords();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Printable Sheet Header (hidden on screen, visible when printing) */}
      <div className="hidden print-header">
        <h1 className="text-2xl font-bold">Smart AI Attendance System - Official Report</h1>
        <p className="text-sm text-gray-600">
          Generated on {new Date().toLocaleString()} · Filter: {filterDate === 'all' ? 'All Dates' : filterDate}
        </p>
      </div>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <span>Attendance Records & Ledger</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Full audit log of student check-ins, timestamps, and verification methods
          </p>
        </div>

        {/* Action Buttons: Export CSV, Print, Clear All */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
            title="Download records as CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
            title="Print printable attendance sheet"
          >
            <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Print Sheet</span>
          </button>

          <button
            onClick={() => setShowClearConfirmModal(true)}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
            title="Clear all records"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 no-print shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student or roll..."
              className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 w-52 sm:w-64"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs focus:outline-none"
            >
              <option value="all">All Dates ({records.length})</option>
              <option value="today">Today only ({todayDate})</option>
              {distinctDates
                .filter((d) => d !== todayDate)
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          </div>

          {/* Class Filter */}
          {distinctClasses.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs focus:outline-none"
              >
                <option value="all">All Classes</option>
                {distinctClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          Showing <strong>{filteredRecords.length}</strong> of {records.length} records
        </div>
      </div>

      {/* Main Records Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <UserCheck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No matching attendance records
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your date or search filters, or mark new attendance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs print-table">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Day</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecords.map((r) => {
                  const student = studentMap.get(r.studentId);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {student?.thumbnail ? (
                            <img
                              src={student.thumbnail}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {r.studentName.charAt(0)}
                            </div>
                          )}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {r.studentName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {r.rollNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {r.classDivision || 'General'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {r.date}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{r.day}</td>
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                        {r.time}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-slate-600 dark:text-slate-300">
                          {r.verificationMethod}
                          {r.confidence && r.verificationMethod === 'Face Recognition' && (
                            <span className="font-mono text-slate-400 ml-1">
                              ({Math.round(r.confidence * 100)}%)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Clear All Attendance Records?
                </h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete all <strong>{records.length}</strong> attendance records? Registered student face profiles will remain intact.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearAll}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
              >
                Clear All Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
