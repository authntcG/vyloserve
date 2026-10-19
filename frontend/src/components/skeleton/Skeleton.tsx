import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    readonly className?: string;
}

export default function Skeleton({ className = '', ...props }: Readonly<SkeletonProps>) {
    return (
        <div
            aria-hidden="true"
            className={`bg-slate-200 dark:bg-slate-700/50 rounded motion-reduce:animate-none animate-pulse ${className}`}
            {...props}
        />
    );
}
