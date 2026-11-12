import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  AlertTriangle,
  UserCheck,
  Eye,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Student, AttendanceRecord, FaceMatchResult } from '../types/attendance';
import {
  areModelsLoaded,
  buildFaceMatcher,
  detectAndMatchFaces,
} from '../services/faceApiService';
import { markAttendance, getCurrentDateFormatted } from '../services/storageService';
import { audioSynthesizer } from '../services/audioService';

interface AttendanceScannerViewProps {
  students: Student[];
  records: AttendanceRecord[];
  onRefreshRecords: () => void;
  onNavigateToRegister: () => void;
}

export const AttendanceScannerView: React.FC<AttendanceScannerViewProps> = ({
  students,
  records,
  onRefreshRecords,
  onNavigateToRegister,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [distanceThreshold, setDistanceThreshold] = useState<number>(0.5);
  const [livenessCheckEnabled, setLivenessCheckEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Active detections for on-screen badges
  const [activeDetections, setActiveDetections] = useState<FaceMatchResult[]>([]);
  // Last marked toast alert
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info' | 'warning';
    title: string;
    details: string;
  } | null>(null);

  // Today's date & records for today
  const { date: todayDate } = getCurrentDateFormatted();
  const todayRecords = records.filter((r) => r.date === todayDate);
  const todayMarkedIds = new Set(todayRecords.map((r) => r.studentId));

  // Build the FaceMatcher from enrolled students
  const faceMatcherRef = useRef<any>(null);
  useEffect(() => {
    faceMatcherRef.current = buildFaceMatcher(students, distanceThreshold);
  }, [students, distanceThreshold]);

  // Audio mute helper
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  // Clear toast after timeout
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Start webcam
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          setIsCameraActive(true);
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Could not access the webcam. Please ensure camera permissions are granted in your browser settings.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No video camera detected on your system. You can also test attendance using the simulation panel below.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setActiveDetections([]);
    // Clear overlay canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start scanning loop once camera is active
  useEffect(() => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) return;

    isScanningRef.current = true;
    let lastScanTime = 0;
    const scanInterval = 120; // Run detection every 120ms to keep smooth 60fps UI while conserving CPU

    const scanFrame = async (timestamp: number) => {
      if (!isScanningRef.current || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState >= 2 && areModelsLoaded()) {
        if (timestamp - lastScanTime >= scanInterval) {
          lastScanTime = timestamp;

          // Sync canvas dimensions
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }

          try {
            const results = await detectAndMatchFaces(
              video,
              faceMatcherRef.current,
              students,
              todayMarkedIds,
              distanceThreshold
            );

            setActiveDetections(results);
            drawOverlay(canvas, results);

            // Process matches for automatic attendance
            for (const res of results) {
              if (res.isRecognized && res.rollNumber) {
                const student = students.find((s) => s.rollNumber === res.rollNumber);
                if (student) {
                  // If liveness is enabled and eye isn't verified yet, skip
                  if (livenessCheckEnabled && !res.livenessVerified) {
                    continue;
                  }

                  const markResult = markAttendance(
                    student,
                    'Face Recognition',
                    res.confidence,
                    res.distance
                  );

                  if (markResult.success) {
                    // Newly marked!
                    if (soundRef.current) {
                      audioSynthesizer.playSuccessChime();
                    }
                    setToastMessage({
                      type: 'success',
                      title: 'Attendance Marked Present!',
                      details: `${student.name} (${student.rollNumber}) · ${markResult.record?.time}`,
                    });
                    onRefreshRecords();
                  } else if (markResult.isAlreadyMarked) {
                    // Already marked today
                    // Avoid spamming tone repeatedly
                  }
                }
              }
            }
          } catch (err) {
            console.error('Inference error in scan frame:', err);
          }
        }
      }

      if (isScanningRef.current) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
      }
    };
  }, [isCameraActive, students, todayMarkedIds, distanceThreshold, livenessCheckEnabled, onRefreshRecords]);

  // Canvas drawing function for high-tech rounded bounding boxes
  const drawOverlay = (canvas: HTMLCanvasElement, results: FaceMatchResult[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const res of results) {
      const { x, y, width, height } = res.box;

      // Color scheme based on status
      let strokeColor = '#f59e0b'; // amber for unknown
      let fillColor = 'rgba(245, 158, 11, 0.12)';
      let badgeBg = '#f59e0b';
      let title = 'Unknown Face';
      let subtitle = 'Unregistered Person';

      if (res.isRecognized) {
        if (res.isAlreadyMarkedToday) {
          strokeColor = '#0284c7'; // Sky blue for already marked
          fillColor = 'rgba(2, 132, 199, 0.12)';
          badgeBg = '#0284c7';
          title = res.label;
          subtitle = `Roll #${res.rollNumber} · Already Marked Today`;
        } else {
          strokeColor = '#10b981'; // Emerald for newly verified match
          fillColor = 'rgba(16, 185, 129, 0.15)';
          badgeBg = '#10b981';
          title = res.label;
          subtitle = `Roll #${res.rollNumber} · ${(res.confidence * 100).toFixed(0)}% Match`;
        }
      }

      // Draw bounding box with rounded corners
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;

      const radius = 10;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();

      // Corner accent brackets for futuristic precision feel
      const bracketLen = 14;
      ctx.lineWidth = 4;
      ctx.strokeStyle = strokeColor;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x, y + bracketLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + bracketLen, y);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + width - bracketLen, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + bracketLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x, y + height - bracketLen);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + bracketLen, y + height);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + width - bracketLen, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - bracketLen);
      ctx.stroke();

      // Top label badge
      const badgeHeight = 44;
      const badgeY = Math.max(10, y - badgeHeight - 6);
      const textPadding = 12;

      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      const titleWidth = ctx.measureText(title).width;
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      const subWidth = ctx.measureText(subtitle).width;
      const badgeWidth = Math.max(titleWidth, subWidth) + textPadding * 2 + 10;

      // Badge background pill
      ctx.fillStyle = badgeBg;
      ctx.beginPath();
      ctx.roundRect(x, badgeY, badgeWidth, badgeHeight, 8);
      ctx.fill();

      // Badge texts
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(title, x + textPadding, badgeY + 18);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(subtitle, x + textPadding, badgeY + 34);
    }
  };

  // Simulation test match (for users who want to trigger an automated test or don't have camera)
  const handleSimulateAttendance = (student: Student) => {
    const markResult = markAttendance(student, 'Face Recognition', 0.96, 0.19);
    if (markResult.success) {
      if (soundEnabled) audioSynthesizer.playSuccessChime();
      setToastMessage({
        type: 'success',
        title: 'Attendance Marked Present!',
        details: `${student.name} (${student.rollNumber}) · Verified via Face Recognition`,
      });
      onRefreshRecords();
    } else {
      if (soundEnabled) audioSynthesizer.playAlreadyMarkedTone();
      setToastMessage({
        type: 'info',
        title: 'Already Marked Today',
        details: `${student.name} (${student.rollNumber}) has already checked in at ${markResult.record?.time}`,
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 max-w-sm p-4 rounded-xl shadow-lg border backdrop-blur-md animate-in slide-in-from-top-4 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900/90 text-white border-emerald-500 shadow-emerald-500/20'
              : 'bg-slate-900/90 text-white border-slate-700 shadow-slate-900/20'
          }`}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                toastMessage.type === 'success' ? 'text-emerald-400' : 'text-sky-400'
              }`}
            />
            <div>
              <p className="font-bold text-sm">{toastMessage.title}</p>
              <p className="text-xs text-slate-200 mt-0.5">{toastMessage.details}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header bar with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Live Attendance Mode</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              Auto-Detection Active
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time face recognition with duplicate prevention and liveness validation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 border-slate-200 dark:border-slate-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title={soundEnabled ? 'Chime Sound Enabled' : 'Chime Sound Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg border transition-colors ${
              showSettings
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
            title="Adjust Face Matching Threshold"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Camera Start / Stop Button */}
          {isCameraActive ? (
            <button
              onClick={stopCamera}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
            >
              <Square className="w-4 h-4" />
              <span>Stop Camera</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              <span>Start Camera</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Tuning Toolbar */}
      {showSettings && (
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Face Distance Threshold: <span className="font-mono">{distanceThreshold.toFixed(2)}</span>
              </span>
              <span className="text-slate-400">Default: 0.50 (Lower is stricter)</span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.65"
              step="0.02"
              value={distanceThreshold}
              onChange={(e) => setDistanceThreshold(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">Liveness / Blink Check</span>
            </div>
            <button
              onClick={() => setLivenessCheckEnabled(!livenessCheckEnabled)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                livenessCheckEnabled
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {livenessCheckEnabled ? 'Enabled' : 'Bypassed'}
            </button>
          </div>
        </div>
      )}

      {/* Main Split Grid: Left Camera feed (65%), Right Live Attendance list (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera & Detection View */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-md">
            {/* The Video Element */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover transform -scale-x-100 ${
                isCameraActive ? 'block' : 'hidden'
              }`}
            />

            {/* The Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100 ${
                isCameraActive ? 'block' : 'hidden'
              }`}
            />

            {/* Inactive State or Camera Error */}
            {!isCameraActive && (
              <div className="p-8 text-center text-slate-400 max-w-md space-y-4">
                {cameraError ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-rose-950/60 text-rose-400 flex items-center justify-center mx-auto border border-rose-800">
                      <CameraOff className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white mb-1">Webcam Not Available</h3>
                      <p className="text-xs text-rose-300 leading-relaxed">{cameraError}</p>
                    </div>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Again
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-teal-400 flex items-center justify-center mx-auto">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Camera Stream Standby</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Click "Start Camera" to initiate real-time face detection. The system will recognize registered students and log their presence automatically.
                      </p>
                    </div>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-teal-500/20 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Start Camera
                    </button>
                  </>
                )}
              </div>
            )}

            {/* In-Frame Live Overlay Badge */}
            {isCameraActive && (
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-[11px] tracking-wide">
                  {activeDetections.length === 0
                    ? 'Scanning for faces...'
                    : `${activeDetections.length} Face(s) Detected`}
                </span>
              </div>
            )}

            {/* Liveness Hint Overlay */}
            {isCameraActive && livenessCheckEnabled && (
              <div className="absolute bottom-4 left-4 right-4 z-10 p-2.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-teal-400" />
                  <span>Look directly into the camera. Natural blinking confirms liveness.</span>
                </span>
                <span className="text-[10px] text-teal-300 font-mono">Anti-Spoof ON</span>
              </div>
            )}
          </div>

          {/* Quick Simulation / Manual Test Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Instant Face Verification Test (Demo Simulation)</span>
              </span>
              <span className="text-[11px] text-slate-400">Test matching without camera</span>
            </div>
            {students.length === 0 ? (
              <p className="text-xs text-slate-500">
                No students enrolled yet.{' '}
                <button
                  onClick={onNavigateToRegister}
                  className="text-teal-600 dark:text-teal-400 font-semibold underline"
                >
                  Register a student
                </button>{' '}
                to begin.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {students.map((student) => {
                  const isMarked = todayMarkedIds.has(student.id);
                  return (
                    <button
                      key={student.id}
                      onClick={() => handleSimulateAttendance(student)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isMarked
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:text-teal-600'
                      }`}
                    >
                      <img
                        src={student.thumbnail}
                        alt=""
                        className="w-4 h-4 rounded-full object-cover"
                      />
                      <span>{student.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">({student.rollNumber})</span>
                      {isMarked ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Play className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Recently Marked Stream (35%) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Today's Attendance
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {todayDate} · {todayRecords.length} Present
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded">
                {todayRecords.length}/{students.length}
              </span>
            </div>

            {/* List of Marked Students Today */}
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 max-h-[460px] overflow-y-auto pr-1">
              {todayRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Camera className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    No attendance marked yet today.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Start camera or simulate face match to log attendance.
                  </p>
                </div>
              ) : (
                todayRecords.map((rec) => {
                  const student = students.find((s) => s.id === rec.studentId);
                  return (
                    <div
                      key={rec.id}
                      className="py-3 flex items-center justify-between gap-3 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {student?.thumbnail ? (
                          <img
                            src={student.thumbnail}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-teal-500/30 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {rec.studentName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {rec.studentName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono tabular-nums">{rec.rollNumber}</span>
                            <span>·</span>
                            <span>{rec.classDivision}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                          Present
                        </span>
                        <p className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                          {rec.time}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Notice Info */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-3">
            <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong>Duplicate Prevention Active:</strong> Each student is recorded only once per calendar day. Subsequent detections will notify without creating redundant logs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
