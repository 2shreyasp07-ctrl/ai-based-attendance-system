import React from 'react';
import { Loader2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ModelLoadingBannerProps {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  stage: string;
  error?: string;
  onRetry: () => void;
}

export const ModelLoadingBanner: React.FC<ModelLoadingBannerProps> = ({
  status,
  stage,
  error,
  onRetry,
}) => {
  if (status === 'loaded') return null;

  if (status === 'error') {
    return (
      <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Failed to Load AI Detection Models</p>
              <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">
                {error || 'CDN connection failed. Check your internet connection.'}
              </p>
            </div>
          </div>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 text-teal-900 dark:text-teal-100">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-teal-600 dark:text-teal-400 animate-spin shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Loading AI Models...</span>
              <span className="text-xs text-teal-700 dark:text-teal-300 font-mono">
                {stage || 'Initializing neural networks'}
              </span>
            </div>
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
              TinyFaceDetector · 68-Point Landmarks · FaceRecognitionNet
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-teal-700 dark:text-teal-300">
          <CheckCircle2 className="w-4 h-4 text-teal-500" />
          <span>Local Inference Ready</span>
        </div>
      </div>
    </div>
  );
};
