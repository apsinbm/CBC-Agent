/**
 * UI/UX Reviewer Agent
 * 
 * This agent reviews the user interface and user experience of the application
 * to ensure it's clean, responsive, and mobile-friendly.
 */

const UIUXReviewer = {
  name: 'UI/UX Reviewer',
  description: 'Reviews UI components for responsiveness, accessibility, and user experience',
  
  async review(componentPath) {
    const checks = {
      responsive: false,
      mobileOptimized: false,
      accessible: false,
      colorContrast: false,
      loadingStates: false,
      errorHandling: false,
    }
    
    const recommendations = []
    
    // Check for responsive design patterns
    if (componentPath.includes('flex') || componentPath.includes('grid')) {
      checks.responsive = true
    } else {
      recommendations.push('Consider using flexbox or grid for responsive layouts')
    }
    
    // Check for mobile optimization
    if (componentPath.includes('sm:') || componentPath.includes('md:') || componentPath.includes('lg:')) {
      checks.mobileOptimized = true
    } else {
      recommendations.push('Add responsive breakpoints using Tailwind prefixes (sm:, md:, lg:)')
    }
    
    // Check for accessibility
    if (componentPath.includes('aria-') || componentPath.includes('role=')) {
      checks.accessible = true
    } else {
      recommendations.push('Add ARIA labels and roles for better accessibility')
    }
    
    // Check for loading states
    if (componentPath.includes('loading') || componentPath.includes('skeleton')) {
      checks.loadingStates = true
    } else {
      recommendations.push('Implement loading states for better UX during data fetching')
    }
    
    return {
      checks,
      recommendations,
      score: Object.values(checks).filter(Boolean).length / Object.keys(checks).length * 100,
    }
  },
  
  async generateReport(components) {
    const reports = []
    
    for (const component of components) {
      const review = await this.review(component)
      reports.push({
        component,
        ...review,
      })
    }
    
    return {
      agent: this.name,
      reports,
      overallScore: reports.reduce((acc, r) => acc + r.score, 0) / reports.length,
    }
  },
}

module.exports = UIUXReviewer