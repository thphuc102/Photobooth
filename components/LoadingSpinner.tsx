import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', message }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className={`${sizeClasses[size]} border-[var(--color-primary)] border-t-transparent rounded-full animate-spin`}></div>
      {message && <p className="text-sm text-gray-400">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;

export const SkeletonLoader: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-gray-700 rounded ${className}`}></div>
);
