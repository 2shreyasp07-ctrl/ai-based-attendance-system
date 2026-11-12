import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Percent,
  Calendar,
  Camera,
  UserPlus,
  ArrowRight,
  Clock,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { Student, AttendanceRecord, ActiveTab } from '../types/attendance';
import { getCurrentDateFormatted, markAttendance, parseDateString } from '../services/storageService';

interface DashboardViewProps {
  students: Student[];
  records: AttendanceRecord[];
  onNavigate: (tab: ActiveTab) => void;
  onRefreshRecords: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  records,
  onNavigate,
  onRefreshRecords,
}) => {
  const { date: todayDate, day: todayDay } = getCurrentDateFormatted();
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  // Compute metrics for the selected date
  const recordsForDate = records.filter((r) => r.date === selectedDate);
  const presentStudentIds = new Set(recordsForDate.map((r) => r.studentId));

  const totalCount = students.length;
  const presentCount = presentStudentIds.size;
  const absentCount = Math.max(0, totalCount - presentCount);
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // List absent students for the selected date
  const absentStudents = students.filter((s) => !presentStudentIds.has(s.id));

  // Past 7 days attendance trend data
  const trendDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const { date, day } = getCurrentDateFormatted(d);
    const dayRecords = records.filter((r) => r.date === date);
    const uniquePresent = new Set(dayRecords.map((r) => r.studentId)).size;
    const rate = totalCount > 0 ? Math.round((uniquePresent / totalCount) * 100) : 0;
    return {
      date,
      day: day.substring(0, 3),
      count: uniquePresent,
      rate,
      isToday: date === todayDate,
    };
  });

  const maxTrendCount = Math.max(...trendDays.map((t) => t.count), totalCount || 1);

  const handleManualMark = (student: Student) => {
    markAttendance(student, 'Manual', 1.0, 0);
    onRefreshRecords();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Attendance Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Overview for {todayDay}, {todayDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <input
              type="text"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="bg-transparent border-0 outline-none w-24 font-mono tabular-nums text-slate-900 dark:text-white text-xs"
            />
          </div>
          {selectedDate !== todayDate && (
            <button
              onClick={() => setSelectedDate(todayDate)}
              className="px-2.5 py-1.5 text-xs text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg transition-colors font-medium"
            >
              Reset to Today
            </button>
          )}
          <button
            onClick={() => onNavigate('attendance')}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>Open Camera</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Enrolled</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
              {totalCount}
            </span>
            <span className="text-xs text-slate-400">Registered Students</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Present</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              {presentCount}
            </span>
            <span className="text-xs text-slate-400">{selectedDate === todayDate ? 'Marked Today' : selectedDate}</span>
          </div>
        </div>

        {/* Absent Today */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Absent</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {absentCount}
            </span>
            <span className="text-xs text-slate-400">Unmarked</span>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Attendance Rate</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-teal-600 dark:text-teal-400 font-mono tabular-nums">
              {attendanceRate}%
            </span>
            <span className="text-xs text-slate-400">{presentCount}/{totalCount} Present</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: 7-Day Chart & Quick Action Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Attendance Trend Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Weekly Attendance Trend</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Past 7 days attendance volume and percentage
              </p>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Avg: {Math.round(trendDays.reduce((acc, cur) => acc + cur.rate, 0) / 7)}%
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-52 flex items-end justify-between gap-2 sm:gap-4 pt-6 px-2 border-b border-slate-100 dark:border-slate-800">
            {trendDays.map((item, idx) => {
              const heightPercent = maxTrendCount > 0 ? (item.count / maxTrendCount) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 opacity-80 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                  <div className="w-full max-w-[42px] bg-slate-100 dark:bg-slate-800/80 rounded-t-lg h-36 flex items-end p-1">
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        item.isToday
                          ? 'bg-teal-500 dark:bg-teal-400 shadow-sm shadow-teal-500/30'
                          : 'bg-sky-600/80 dark:bg-sky-500/70 hover:bg-sky-500'
                      }`}
                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className={`text-xs font-medium ${item.isToday ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                      {item.day}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                      {item.date.split('/')[0]}/{item.date.split('/')[1]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-4 px-2">
            <span>7-day span</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-600 dark:bg-sky-500 inline-block" /> Previous days
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 dark:bg-teal-400 inline-block" /> Today
              </span>
            </div>
          </div>
        </div>

        {/* Quick Launch Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center mb-4">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">Face Recognition Scanner</h3>
            <p className="text-xs text-slate-300 leading-relaxed mt-2">
              Start live attendance scanning. Faces are identified in real-time, matching student profiles with instant attendance logging and duplicate prevention.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => onNavigate('attendance')}
              className="w-full flex items-center justify-between px-4 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-500/20"
            >
              <span>Launch Live Attendance</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('register')}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-xl transition-colors"
            >
              <span className="flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5 text-teal-300" />
                Register New Student
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Section: Absent Students vs Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Absent Students List for Selected Date */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-500" />
                <span>Absent Students ({absentStudents.length})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Students not yet marked on {selectedDate}
              </p>
            </div>
          </div>

          {absentStudents.length === 0 ? (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">All Students Accounted For</p>
              <p className="text-xs text-slate-400 mt-1">100% attendance recorded for this date.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto pr-1">
              {absentStudents.map((student) => (
                <div key={student.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <img
                      src={student.thumbnail}
                      alt={student.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{student.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono tabular-nums">{student.rollNumber}</span>
                        <span>·</span>
                        <span>{student.classDivision || 'General'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleManualMark(student)}
                    className="px-2.5 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-md transition-colors whitespace-nowrap"
                  >
                    Mark Present
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Attendance Records */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-500" />
                <span>Recent Activity</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Latest marked entries across all sessions
              </p>
            </div>
            <button
              onClick={() => onNavigate('records')}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
            >
              View Full History
            </button>
          </div>

          {records.length === 0 ? (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">No attendance records yet.</p>
              <p className="text-xs text-slate-400 mt-1">Use Take Attendance or mark a student present.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto pr-1">
              {records.slice(0, 6).map((rec) => (
                <div key={rec.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{rec.studentName}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums">{rec.rollNumber}</span>
                      <span>·</span>
                      <span>{rec.classDivision || 'General'}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">{rec.time}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {rec.status}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {rec.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
