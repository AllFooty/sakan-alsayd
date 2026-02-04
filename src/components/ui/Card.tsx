'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
    const baseStyles = 'rounded-2xl overflow-hidden';

    const variants = {
      default: 'bg-white',
      elevated: 'bg-white shadow-lg shadow-navy/5',
      outlined: 'bg-white border border-border',
    };

    const hoverStyles = hover
      ? 'transition-all duration-300 hover:shadow-xl hover:shadow-navy/10 hover:-translate-y-1'
      : '';

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], hoverStyles, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...props} />
  )
);

CardHeader.displayName = 'CardHeader';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);

CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);

CardFooter.displayName = 'CardFooter';

const CardImage = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { aspectRatio?: string }>(
  ({ className, aspectRatio = 'aspect-video', children, ...props }, ref) => (
    <div ref={ref} className={cn('relative overflow-hidden', aspectRatio, className)} {...props}>
      {children}
    </div>
  )
);

CardImage.displayName = 'CardImage';

export { Card, CardHeader, CardContent, CardFooter, CardImage };
