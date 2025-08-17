'use client';

import { useEffect } from 'react';

export default function PerformanceMonitor() {
  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') return;

    // Web Vitals monitoring
    const reportWebVitals = (metric: any) => {
      const body = JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });

      // Send to analytics endpoint if configured
      if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
        fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }).catch(console.error);
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Web Vital:', metric);
      }
    };

    // Track Core Web Vitals
    if (typeof window !== 'undefined' && 'web-vital' in window) {
      // @ts-ignore
      window['web-vital']?.onCLS?.(reportWebVitals);
      // @ts-ignore
      window['web-vital']?.onFID?.(reportWebVitals);
      // @ts-ignore
      window['web-vital']?.onLCP?.(reportWebVitals);
      // @ts-ignore
      window['web-vital']?.onTTFB?.(reportWebVitals);
      // @ts-ignore
      window['web-vital']?.onFCP?.(reportWebVitals);
    }

    // Performance Observer for resource timing
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            // Track slow resources
            if (entry.duration > 1000) {
              console.warn('Slow resource:', entry.name, entry.duration);
            }
          });
        });
        observer.observe({ entryTypes: ['resource', 'navigation'] });

        return () => observer.disconnect();
      } catch (e) {
        // Silently fail if not supported
      }
    }

    // Track JavaScript errors
    const errorHandler = (event: ErrorEvent) => {
      const errorInfo = {
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      };

      // Send to error tracking if configured
      if (process.env.NEXT_PUBLIC_ERROR_ENDPOINT) {
        fetch(process.env.NEXT_PUBLIC_ERROR_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorInfo),
        }).catch(() => {});
      }
    };

    window.addEventListener('error', errorHandler);

    // Cleanup
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  return null; // This component doesn't render anything
}