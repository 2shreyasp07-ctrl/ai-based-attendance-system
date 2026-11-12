import { Student, FaceMatchResult } from '../types/attendance';

// Declare faceapi on window
declare global {
  interface Window {
    faceapi: any;
  }
}

const PRIMARY_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const FALLBACK_MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

let modelsLoaded = false;
let isModelLoading = false;

export async function loadFaceApiModels(
  onProgress?: (stage: string) => void
): Promise<{ success: boolean; error?: string }> {
  if (modelsLoaded) {
    onProgress?.('AI Models ready');
    return { success: true };
  }

  if (isModelLoading) {
    // Wait for ongoing load
    while (isModelLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { success: modelsLoaded };
  }

  isModelLoading = true;

  // Ensure window.faceapi is loaded
  if (typeof window === 'undefined') {
    isModelLoading = false;
    return { success: false, error: 'Window is not defined' };
  }

  // If faceapi script is not yet on window, wait up to 8 seconds
  let retries = 0;
  while (!window.faceapi && retries < 40) {
    await new Promise((r) => setTimeout(r, 200));
    retries++;
  }

  if (!window.faceapi) {
    isModelLoading = false;
    return {
      success: false,
      error: 'Face-api library script could not be loaded from CDN. Please check network connectivity.',
    };
  }

  const urlsToTry = [PRIMARY_MODEL_URL, FALLBACK_MODEL_URL];

  for (const modelUrl of urlsToTry) {
    try {
      onProgress?.('Loading Tiny Face Detector...');
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);

      onProgress?.('Loading 68-point Facial Landmarks...');
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);

      onProgress?.('Loading Face Recognition Neural Network...');
      await window.faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);

      modelsLoaded = true;
      isModelLoading = false;
      onProgress?.('AI Models loaded successfully');
      return { success: true };
    } catch (err) {
      console.warn(`Failed loading models from ${modelUrl}:`, err);
    }
  }

  isModelLoading = false;
  return {
    success: false,
    error: 'Failed to load face detection neural weights from CDN mirrors.',
  };
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Creates face detector options with default input size 320 for real-time speed
 */
export function getDetectorOptions(inputSize = 320, scoreThreshold = 0.5) {
  if (!window.faceapi) return null;
  return new window.faceapi.TinyFaceDetectorOptions({
    inputSize,
    scoreThreshold,
  });
}

/**
 * Detect a single face with landmarks and 128-d descriptor (used in Student Registration)
 */
export async function detectSingleFaceDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<{
  descriptor: number[] | null;
  box: { x: number; y: number; width: number; height: number } | null;
  landmarks: any | null;
  detectionScore: number;
}> {
  if (!window.faceapi || !modelsLoaded) {
    throw new Error('Face recognition models are not loaded.');
  }

  const options = getDetectorOptions(320, 0.45);
  const result = await window.faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) {
    return { descriptor: null, box: null, landmarks: null, detectionScore: 0 };
  }

  return {
    descriptor: Array.from(result.descriptor),
    box: {
      x: result.detection.box.x,
      y: result.detection.box.y,
      width: result.detection.box.width,
      height: result.detection.box.height,
    },
    landmarks: result.landmarks,
    detectionScore: result.detection.score,
  };
}

/**
 * Builds a FaceMatcher instance from registered students
 */
export function buildFaceMatcher(students: Student[], distanceThreshold = 0.5): any {
  if (!window.faceapi || students.length === 0) return null;

  const labeledDescriptors: any[] = [];

  for (const student of students) {
    if (student.descriptors && student.descriptors.length > 0) {
      const descriptorsAsFloat32 = student.descriptors.map(
        (desc) => new Float32Array(desc)
      );
      labeledDescriptors.push(
        new window.faceapi.LabeledFaceDescriptors(student.id, descriptorsAsFloat32)
      );
    }
  }

  if (labeledDescriptors.length === 0) return null;

  return new window.faceapi.FaceMatcher(labeledDescriptors, distanceThreshold);
}

/**
 * Eye Aspect Ratio (EAR) calculation for liveness/blink detection
 * Landmarks 36-41 is left eye, 42-47 is right eye
 */
function calculateEAR(eyePoints: Array<{ x: number; y: number }>): number {
  if (!eyePoints || eyePoints.length < 6) return 0.3;

  const distance = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

  // Vertical eye landmarks
  const v1 = distance(eyePoints[1], eyePoints[5]);
  const v2 = distance(eyePoints[2], eyePoints[4]);

  // Horizontal eye landmark
  const h = distance(eyePoints[0], eyePoints[3]);

  if (h === 0) return 0.3;
  return (v1 + v2) / (2.0 * h);
}

export function detectBlinkLiveness(landmarks: any): { isBlinking: boolean; avgEar: number } {
  if (!landmarks) return { isBlinking: false, avgEar: 0.3 };

  try {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEar = (leftEAR + rightEAR) / 2;

    // EAR drops below ~0.21 during a blink
    const isBlinking = avgEar < 0.21;
    return { isBlinking, avgEar };
  } catch {
    return { isBlinking: false, avgEar: 0.3 };
  }
}

/**
 * Process a video frame for live attendance: detect all faces, match them against registered students
 */
export async function detectAndMatchFaces(
  video: HTMLVideoElement,
  faceMatcher: any | null,
  students: Student[],
  todayMarkedStudentIds: Set<string>,
  distanceThreshold = 0.5
): Promise<FaceMatchResult[]> {
  if (!window.faceapi || !modelsLoaded) return [];

  const options = getDetectorOptions(320, 0.45);
  const detections = await window.faceapi
    .detectAllFaces(video, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  const studentMap = new Map<string, Student>(students.map((s) => [s.id, s]));
  const results: FaceMatchResult[] = [];

  for (const det of detections) {
    const box = {
      x: det.detection.box.x,
      y: det.detection.box.y,
      width: det.detection.box.width,
      height: det.detection.box.height,
    };

    let label = 'Unknown';
    let rollNumber: string | undefined = undefined;
    let distance = 1.0;
    let confidence = 0.0;
    let isRecognized = false;
    let isAlreadyMarkedToday = false;

    if (faceMatcher) {
      const bestMatch = faceMatcher.findBestMatch(det.descriptor);
      distance = bestMatch.distance;

      // In faceapi, bestMatch.label is the id or 'unknown'
      if (bestMatch.label !== 'unknown' && bestMatch.distance <= distanceThreshold) {
        const student = studentMap.get(bestMatch.label);
        if (student) {
          label = student.name;
          rollNumber = student.rollNumber;
          isRecognized = true;
          isAlreadyMarkedToday = todayMarkedStudentIds.has(student.id);
          // Calculate confidence score (inverse of distance normalized)
          confidence = Math.max(0, Math.min(1, 1 - bestMatch.distance));
        }
      }
    }

    const { isBlinking } = detectBlinkLiveness(det.landmarks);

    results.push({
      box,
      label,
      rollNumber,
      distance,
      confidence,
      isRecognized,
      isAlreadyMarkedToday,
      livenessVerified: !isBlinking, // Eye is open
    });
  }

  return results;
}

/**
 * Snapshot a square thumbnail from a video element, cropped around the face if coordinates provided
 */
export function captureThumbnailFromVideo(
  video: HTMLVideoElement,
  box?: { x: number; y: number; width: number; height: number }
): string {
  const canvas = document.createElement('canvas');
  const size = 160;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (box && box.width > 20 && box.height > 20) {
    // Add 25% padding around detected face
    const padX = box.width * 0.25;
    const padY = box.height * 0.25;
    const sourceX = Math.max(0, box.x - padX);
    const sourceY = Math.max(0, box.y - padY);
    const sourceW = Math.min(video.videoWidth - sourceX, box.width + padX * 2);
    const sourceH = Math.min(video.videoHeight - sourceY, box.height + padY * 2);

    ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, size, size);
  } else {
    // Center crop video square
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minDim) / 2;
    const startY = (video.videoHeight - minDim) / 2;
    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, size, size);
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}
