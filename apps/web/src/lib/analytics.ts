// Frontend Analytics Configuration
// Integrates Vercel Analytics for performance monitoring

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp?: number;
}

class Analytics {
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
  }

  // Track page view
  trackPageView(path: string, title?: string) {
    if (!this.enabled) return;

    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va?.('pageview', {
        path,
        title,
      });
    }
  }

  // Track custom event
  trackEvent(name: string, properties?: Record<string, any>) {
    if (!this.enabled) return;

    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va?.(name, properties);
    }

    // Also send to custom endpoint if configured
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      this.sendToEndpoint(name, properties);
    }
  }

  // Track user action
  trackAction(action: string, resource: string, properties?: Record<string, any>) {
    if (!this.enabled) return;

    this.trackEvent(`${resource}:${action}`, {
      action,
      resource,
      ...properties,
      timestamp: new Date().toISOString(),
    });
  }

  // Track error
  trackError(error: Error, context?: Record<string, any>) {
    if (!this.enabled) return;

    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  // Track performance metric
  trackMetric(name: string, value: number, unit?: string) {
    if (!this.enabled) return;

    this.trackEvent(`metric:${name}`, {
      value,
      unit,
      timestamp: new Date().toISOString(),
    });
  }

  // Send to custom analytics endpoint
  private async sendToEndpoint(name: string, properties?: Record<string, any>) {
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    if (!endpoint) {
      return;
    }

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          properties,
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
    } catch (error) {
      console.error('Failed to send analytics event:', error);
    }
  }

  // Set user context
  setUser(userId: string, email?: string, role?: string) {
    if (!this.enabled) return;

    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va?.('set', {
        userId,
        email,
        role,
      });
    }
  }

  // Clear user context
  clearUser() {
    if (!this.enabled) return;

    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va?.('clear');
    }
  }
}

export const analytics = new Analytics();
