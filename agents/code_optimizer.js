/**
 * Code Optimizer Agent
 * 
 * This agent cleans, organizes, and optimizes code for better performance
 * and maintainability.
 */

const CodeOptimizer = {
  name: 'Code Optimizer',
  description: 'Optimizes code for performance, readability, and maintainability',
  
  async analyzeCode(code) {
    const issues = []
    const optimizations = []
    
    // Check for unused variables
    const unusedVarPattern = /const\s+(\w+)\s*=.*(?!.*\1)/g
    if (unusedVarPattern.test(code)) {
      issues.push('Detected potentially unused variables')
      optimizations.push('Remove unused variables to reduce bundle size')
    }
    
    // Check for console.log statements
    if (code.includes('console.log')) {
      issues.push('Console.log statements found')
      optimizations.push('Remove or replace console.log with proper logging service')
    }
    
    // Check for any/unknown TypeScript types
    if (code.includes(': any') || code.includes(': unknown')) {
      issues.push('Weak TypeScript typing detected')
      optimizations.push('Replace any/unknown with specific types for better type safety')
    }
    
    // Check for async/await optimization
    if (code.includes('async') && !code.includes('try') && !code.includes('catch')) {
      issues.push('Async functions without error handling')
      optimizations.push('Add try-catch blocks to handle potential errors in async functions')
    }
    
    // Check for React optimization opportunities
    if (code.includes('useState') || code.includes('useEffect')) {
      if (!code.includes('useCallback') && !code.includes('useMemo')) {
        optimizations.push('Consider using useCallback/useMemo for performance optimization')
      }
    }
    
    return {
      issues,
      optimizations,
      codeQuality: Math.max(0, 100 - (issues.length * 10)),
    }
  },
  
  async optimizeImports(code) {
    const lines = code.split('\\n')
    const imports = lines.filter(line => line.startsWith('import'))
    
    // Sort imports alphabetically
    imports.sort()
    
    // Group imports by source
    const grouped = {
      react: [],
      next: [],
      external: [],
      internal: [],
    }
    
    imports.forEach(imp => {
      if (imp.includes('react')) {
        grouped.react.push(imp)
      } else if (imp.includes('next')) {
        grouped.next.push(imp)
      } else if (imp.includes('@/') || imp.includes('./')) {
        grouped.internal.push(imp)
      } else {
        grouped.external.push(imp)
      }
    })
    
    return {
      original: imports,
      optimized: [
        ...grouped.react,
        ...grouped.next,
        ...grouped.external,
        ...grouped.internal,
      ],
    }
  },
  
  async generateOptimizationReport(files) {
    const reports = []
    
    for (const file of files) {
      const analysis = await this.analyzeCode(file.content)
      const importOptimization = await this.optimizeImports(file.content)
      
      reports.push({
        file: file.path,
        analysis,
        importOptimization,
        recommendations: [
          ...analysis.optimizations,
          importOptimization.optimized.length !== importOptimization.original.length 
            ? 'Organize imports for better readability' 
            : null,
        ].filter(Boolean),
      })
    }
    
    return {
      agent: this.name,
      reports,
      overallQuality: reports.reduce((acc, r) => acc + r.analysis.codeQuality, 0) / reports.length,
    }
  },
}

module.exports = CodeOptimizer