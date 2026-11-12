import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Camera,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Sparkles,
  CameraOff,
} from 'lucide-react';
import { Student } from '../types/attendance';
import {
  detectSingleFaceDescriptor,
  captureThumbnailFromVideo,
  areModelsLoaded,
} from '../services/faceApiService';
import { addOrUpdateStudent, deleteStoredStudent } from '../services/storageService';
import { audioSynthesizer } from '../services/audioService';

interface RegisterStudentViewProps {
  students: Student[];
  onRefreshStudents: () => void;
}

interface CapturedSample {
  descriptor: number[];
  thumbnail: string;
  timestamp: number;
}

export const RegisterStudentView: React.FC<RegisterStudentViewProps> = ({
  students,
  onRefreshStudents,
}) => {
  // Form State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [classDivision, setClassDivision] = useState<string>('CS-101');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Camera & Face Capture State
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedSamples, setCapturedSamples] = useState<CapturedSample[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number>(0);

  // Student Roster Filter / Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Start Camera for Registration
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
      console.error('Registration camera error:', err);
      let msg = 'Could not access the webcam.';
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission was denied. Please allow camera permissions in your browser.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsFaceDetected(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Periodic Face Alignment Monitor loop when camera is active
  useEffect(() => {
    if (!isCameraActive || !videoRef.current) return;

    let isMonitoring = true;
    const checkAlignment = async () => {
      if (!isMonitoring || !videoRef.current || !isCameraActive) return;

      if (videoRef.current.readyState >= 2 && areModelsLoaded()) {
        try {
          const res = await detectSingleFaceDescriptor(videoRef.current);
          if (isMonitoring) {
            setIsFaceDetected(res.descriptor !== null);
          }
        } catch {
          // Ignore intermittent frames
        }
      }

      if (isMonitoring) {
        setTimeout(checkAlignment, 400);
      }
    };

    checkAlignment();

    return () => {
      isMonitoring = false;
    };
  }, [isCameraActive]);

  // Capture a Single Face Sample
  const handleCaptureSample = async () => {
    if (!videoRef.current || !isCameraActive) return;

    setIsCapturing(true);
    setFormError(null);

    try {
      const res = await detectSingleFaceDescriptor(videoRef.current);

      if (!res.descriptor || !res.box) {
        setFormError('No face clearly detected. Please face the camera and ensure good lighting.');
        setIsCapturing(false);
        return;
      }

      audioSynthesizer.playCaptureShutter();
      const thumb = captureThumbnailFromVideo(videoRef.current, res.box);

      const newSample: CapturedSample = {
        descriptor: res.descriptor,
        thumbnail: thumb,
        timestamp: Date.now(),
      };

      setCapturedSamples((prev) => [...prev, newSample]);
    } catch (err) {
      console.error('Failed to capture face descriptor:', err);
      setFormError('Failed to extract face features. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Quick auto-capture burst (captures 3 samples with 800ms delays)
  const handleAutoCaptureBurst = async () => {
    if (!videoRef.current || !isCameraActive || isCapturing) return;

    setIsCapturing(true);
    setFormError(null);

    for (let i = capturedSamples.length; i < 4; i++) {
      if (!videoRef.current || !isCameraActive) break;
      try {
        const res = await detectSingleFaceDescriptor(videoRef.current);
        if (res.descriptor && res.box) {
          audioSynthesizer.playCaptureShutter();
          const thumb = captureThumbnailFromVideo(videoRef.current, res.box);
          const sample: CapturedSample = {
            descriptor: res.descriptor,
            thumbnail: thumb,
            timestamp: Date.now(),
          };
          setCapturedSamples((prev) => [...prev, sample]);
        }
      } catch (err) {
        console.error('Burst error:', err);
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsCapturing(false);
  };

  // Remove a single captured sample
  const handleRemoveSample = (index: number) => {
    setCapturedSamples((prev) => prev.filter((_, i) => i !== index));
    if (selectedThumbnailIndex >= index && selectedThumbnailIndex > 0) {
      setSelectedThumbnailIndex((prev) => prev - 1);
    }
  };

  // Submit Registration Form
  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!name.trim()) {
      setFormError('Student full name is required.');
      return;
    }

    if (!rollNumber.trim()) {
      setFormError('Student roll number is required.');
      return;
    }

    if (capturedSamples.length < 3) {
      setFormError(`Please capture at least 3 face samples (currently ${capturedSamples.length}/3).`);
      return;
    }

    const chosenThumbnail =
      capturedSamples[selectedThumbnailIndex]?.thumbnail || capturedSamples[0].thumbnail;

    const studentRecord: Student = {
      id: editingStudentId || `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      rollNumber: rollNumber.trim().toUpperCase(),
      classDivision: classDivision.trim() || 'General',
      thumbnail: chosenThumbnail,
      descriptors: capturedSamples.map((s) => s.descriptor),
      registeredAt: new Date().toISOString(),
    };

    const res = addOrUpdateStudent(studentRecord);

    if (!res.success) {
      setFormError(res.error || 'Failed to save student record.');
      return;
    }

    // Success!
    setFormSuccess(
      editingStudentId
        ? `Student record for "${studentRecord.name}" successfully updated!`
        : `Student "${studentRecord.name}" (${studentRecord.rollNumber}) registered with ${capturedSamples.length} face samples!`
    );

    // Reset Form
    setName('');
    setRollNumber('');
    setClassDivision('CS-101');
    setCapturedSamples([]);
    setEditingStudentId(null);
    stopCamera();
    onRefreshStudents();
  };

  // Pre-fill form to Re-register or Edit student
  const handleEditStudent = (student: Student) => {
    setEditingStudentId(student.id);
    setName(student.name);
    setRollNumber(student.rollNumber);
    setClassDivision(student.classDivision || 'CS-101');
    setFormError(null);
    setFormSuccess(null);

    // Reconstruct captured samples from stored descriptors + existing thumbnail
    const restoredSamples: CapturedSample[] = student.descriptors.map((desc, i) => ({
      descriptor: desc,
      thumbnail: student.thumbnail,
      timestamp: Date.now() - i * 1000,
    }));
    setCapturedSamples(restoredSamples);

    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
    startCamera();
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!studentToDelete) return;
    deleteStoredStudent(studentToDelete.id);
    setStudentToDelete(null);
    onRefreshStudents();
  };

  // Filter roster
  const classesList = Array.from(
    new Set(students.map((s) => s.classDivision || 'General'))
  );

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass =
      selectedClassFilter === 'all' || (s.classDivision || 'General') === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Student Registration & Enrollment
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Capture 3 to 5 multi-angle face samples to enroll students into the recognition model
        </p>
      </div>

      {/* Registration Section: 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Details (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{editingStudentId ? 'Edit Student Profile' : 'Student Information'}</span>
            </h2>
            {editingStudentId && (
              <button
                type="button"
                onClick={() => {
                  setEditingStudentId(null);
                  setName('');
                  setRollNumber('');
                  setCapturedSamples([]);
                }}
                className="text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmitRegistration} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Johnathan Smith"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Roll Number (Must be Unique) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                placeholder="e.g. CS-2024-001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Class / Division / Batch
              </label>
              <input
                type="text"
                value={classDivision}
                onChange={(e) => setClassDivision(e.target.value)}
                placeholder="e.g. Grade 10-A, CS-101"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Captured Samples Summary */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Biometric Face Samples:
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    capturedSamples.length >= 3 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-500'
                  }`}
                >
                  {capturedSamples.length} / 5 captured
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden mb-3">
                <div
                  className={`h-2 transition-all duration-300 ${
                    capturedSamples.length >= 3 ? 'bg-teal-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, (capturedSamples.length / 5) * 100)}%` }}
                />
              </div>

              {/* Sample Mini Gallery */}
              {capturedSamples.length > 0 ? (
                <div className="grid grid-cols-5 gap-2">
                  {capturedSamples.map((sample, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedThumbnailIndex(idx)}
                      className={`relative group rounded-lg overflow-hidden aspect-square border-2 cursor-pointer transition-all ${
                        selectedThumbnailIndex === idx
                          ? 'border-teal-500 ring-2 ring-teal-500/20'
                          : 'border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'
                      }`}
                      title={selectedThumbnailIndex === idx ? 'Primary Thumbnail' : 'Click to set as primary'}
                    >
                      <img src={sample.thumbnail} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover" />
                      {selectedThumbnailIndex === idx && (
                        <div className="absolute top-1 left-1 bg-teal-500 text-white rounded-full p-0.5">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSample(idx);
                        }}
                        className="absolute inset-0 bg-rose-950/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete this sample"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No samples captured yet. Use the camera panel on the right to snap 3 to 5 face angles.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={capturedSamples.length < 3}
              className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all ${
                capturedSamples.length >= 3
                  ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-500/20 cursor-pointer'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {editingStudentId ? 'Save Updated Record' : 'Complete & Save Registration'}
            </button>
          </form>
        </div>

        {/* Right Column: Live Camera & Multi-Sample Capture (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-md">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover transform -scale-x-100 ${
                isCameraActive ? 'block' : 'hidden'
              }`}
            />

            {/* Oval Alignment Frame when active */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-52 h-64 rounded-[50%] border-2 transition-colors duration-300 ${
                    isFaceDetected
                      ? 'border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.3)]'
                      : 'border-white/30 border-dashed'
                  }`}
                />
              </div>
            )}

            {/* Top Indicator */}
            {isCameraActive && (
              <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-white/10">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isFaceDetected ? 'bg-teal-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>{isFaceDetected ? 'Face Aligned' : 'Align face in oval'}</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-teal-300 border border-white/10 font-mono">
                  {capturedSamples.length}/5 Captured
                </div>
              </div>
            )}

            {/* Camera Standby View */}
            {!isCameraActive && (
              <div className="p-8 text-center text-slate-400 max-w-sm space-y-4">
                {cameraError ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-rose-950/60 text-rose-400 flex items-center justify-center mx-auto border border-rose-800">
                      <CameraOff className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-rose-300">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Retry Camera
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-teal-400 flex items-center justify-center mx-auto">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white mb-1">Webcam Required for Enrollment</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Position yourself facing the camera. We'll capture 3 to 5 samples (slight head turns) to ensure high recognition accuracy.
                      </p>
                    </div>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      Open Camera
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Capture Actions Toolbar */}
          {isCameraActive && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCaptureSample}
                  disabled={isCapturing || capturedSamples.length >= 5}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCapturing ? 'Capturing...' : 'Capture Sample'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoCaptureBurst}
                  disabled={isCapturing || capturedSamples.length >= 4}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                  title="Automatically take 3 fast consecutive shots"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                  <span>Auto Burst</span>
                </button>
              </div>

              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Close Camera
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Registered Students Roster Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Registered Students Roster ({students.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All enrolled profiles with active biometric descriptors
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or roll..."
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 w-48 sm:w-56"
              />
            </div>

            {/* Class filter */}
            {classesList.length > 1 && (
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none"
              >
                <option value="all">All Classes</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Table of Registered Students */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">No registered students found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Class / Division</th>
                    <th className="py-3 px-4 text-center">Face Samples</th>
                    <th className="py-3 px-4">Enrolled On</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={s.thumbnail}
                            alt={s.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0"
                          />
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {s.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {s.rollNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {s.classDivision || 'General'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-mono text-[11px] font-semibold">
                          <Check className="w-3 h-3" />
                          {s.descriptors.length} samples
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {new Date(s.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditStudent(s)}
                            className="p-1.5 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Re-register face samples"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setStudentToDelete(s)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete student profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Delete Student Profile?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <strong>{studentToDelete.name}</strong> ({studentToDelete.rollNumber})? Their face descriptor models and biometric data will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setStudentToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
