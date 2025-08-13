/**
 * Weather Service Prometheus Metrics
 * Exports metrics for monitoring and alerting
 */

/**
 * Simple metrics collector for Prometheus-style output
 */
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.histograms = new Map();
  }

  /**
   * Increment counter metric
   */
  incrementCounter(name, labels = {}, value = 1) {
    const key = this.getMetricKey(name, labels);
    const current = this.metrics.get(key) || { type: 'counter', value: 0, labels };
    current.value += value;
    this.metrics.set(key, current);
  }

  /**
   * Set gauge metric
   */
  setGauge(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, { type: 'gauge', value, labels });
  }

  /**
   * Record histogram metric (for latency)
   */
  recordHistogram(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    let histogram = this.histograms.get(key);
    
    if (!histogram) {
      histogram = {
        type: 'histogram',
        labels,
        buckets: new Map([
          [50, 0], [100, 0], [250, 0], [500, 0], 
          [1000, 0], [2500, 0], [5000, 0], [10000, 0], ['+Inf', 0]
        ]),
        sum: 0,
        count: 0
      };
      this.histograms.set(key, histogram);
    }
    
    // Update buckets
    for (const [bucket, _] of histogram.buckets) {
      if (bucket === '+Inf' || value <= parseInt(bucket)) {
        histogram.buckets.set(bucket, histogram.buckets.get(bucket) + 1);
      }
    }
    
    histogram.sum += value;
    histogram.count += 1;
  }

  /**
   * Generate metric key from name and labels
   */
  getMetricKey(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Export all metrics in Prometheus format
   */
  exportMetrics() {
    const lines = [];

    // Export counters and gauges
    const metricsByName = new Map();
    for (const [key, metric] of this.metrics) {
      const nameMatch = key.match(/^([^{]+)/);
      const name = nameMatch ? nameMatch[1] : key;
      
      if (!metricsByName.has(name)) {
        metricsByName.set(name, { type: metric.type, entries: [] });
      }
      metricsByName.get(name).entries.push({ key, ...metric });
    }

    for (const [name, data] of metricsByName) {
      lines.push(`# TYPE ${name} ${data.type}`);
      for (const entry of data.entries) {
        lines.push(`${entry.key} ${entry.value}`);
      }
      lines.push('');
    }

    // Export histograms
    for (const [key, histogram] of this.histograms) {
      const nameMatch = key.match(/^([^{]+)/);
      const baseName = nameMatch ? nameMatch[1] : key;
      
      lines.push(`# TYPE ${baseName} histogram`);
      
      // Bucket metrics
      for (const [bucket, count] of histogram.buckets) {
        const bucketLabels = { ...histogram.labels, le: bucket };
        const bucketKey = this.getMetricKey(`${baseName}_bucket`, bucketLabels);
        lines.push(`${bucketKey} ${count}`);
      }
      
      // Sum and count
      const sumKey = this.getMetricKey(`${baseName}_sum`, histogram.labels);
      const countKey = this.getMetricKey(`${baseName}_count`, histogram.labels);
      lines.push(`${sumKey} ${histogram.sum}`);
      lines.push(`${countKey} ${histogram.count}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics (for testing)
   */
  reset() {
    this.metrics.clear();
    this.histograms.clear();
  }

  /**
   * Get metric summary
   */
  getSummary() {
    return {
      counters: this.metrics.size,
      histograms: this.histograms.size,
      total_metrics: this.metrics.size + this.histograms.size
    };
  }
}

// Global metrics collector
const metricsCollector = new MetricsCollector();

/**
 * Weather-specific metrics helpers
 */
export class WeatherMetrics {
  /**
   * Record weather request
   */
  static recordRequest(provider, status, duration, isStale = false) {
    metricsCollector.incrementCounter('weather_requests_total', { 
      provider, 
      status: String(status),
      stale: String(isStale)
    });
    
    metricsCollector.recordHistogram('weather_latency_ms', duration, { 
      provider 
    });
  }

  /**
   * Record cache hit
   */
  static recordCacheHit(type) {
    metricsCollector.incrementCounter('weather_cache_hits_total', { 
      type // 'fresh' or 'stale'
    });
  }

  /**
   * Record circuit breaker state
   */
  static recordCircuitBreakerState(provider, state) {
    metricsCollector.setGauge('weather_circuit_breaker_state', 
      state === 'OPEN' ? 1 : 0, 
      { provider }
    );
    
    if (state === 'OPEN') {
      metricsCollector.incrementCounter('weather_circuit_opens_total', { provider });
    }
  }

  /**
   * Record provider error
   */
  static recordError(provider, errorType) {
    metricsCollector.incrementCounter('weather_errors_total', { 
      provider, 
      error_type: errorType 
    });
  }

  /**
   * Record provider health check
   */
  static recordHealthCheck(provider, healthy, duration) {
    metricsCollector.setGauge('weather_provider_healthy', 
      healthy ? 1 : 0, 
      { provider }
    );
    
    metricsCollector.recordHistogram('weather_health_check_duration_ms', 
      duration, 
      { provider }
    );
  }

  /**
   * Set cache size
   */
  static setCacheSize(size) {
    metricsCollector.setGauge('weather_cache_size', size);
  }

  /**
   * Export all weather metrics in Prometheus format
   */
  static exportPrometheusMetrics() {
    return metricsCollector.exportMetrics();
  }

  /**
   * Get metrics summary
   */
  static getMetricsSummary() {
    const summary = metricsCollector.getSummary();
    
    // Add current timestamp
    summary.exported_at = new Date().toISOString();
    
    return summary;
  }

  /**
   * Reset all metrics (for testing)
   */
  static resetMetrics() {
    metricsCollector.reset();
  }
}

export default WeatherMetrics;