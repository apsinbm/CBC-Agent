/**
 * Bot Identity Tests
 * Ensures the chatbot correctly identifies as Alonso after rename
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Bot Identity - Danni → Alonso Rename', () => {
  it('should have no remaining Danni references in key files', () => {
    const filesToCheck = [
      'app/page.tsx',
      'app/api/handoff/route.ts', 
      'prompts/system_cbc_agent.md',
      'data/cbc_knowledge.md',
      'README.md'
    ];
    
    for (const filePath of filesToCheck) {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const danniMatches = content.match(/\bdanni\b/gi) || [];
        
        expect(danniMatches).toHaveLength(0, 
          `Found ${danniMatches.length} 'Danni' references in ${filePath}: ${danniMatches.join(', ')}`
        );
      }
    }
  });
  
  it('should have Alonso references in UI components', () => {
    const pageContent = fs.readFileSync(
      path.join(process.cwd(), 'app/page.tsx'), 
      'utf8'
    );
    
    expect(pageContent).toContain('Alonso');
    expect(pageContent).toContain('Guest Assistant Alonso');
  });
  
  it('should have Alonso persona in system prompt', () => {
    const promptContent = fs.readFileSync(
      path.join(process.cwd(), 'prompts/system_cbc_agent.md'), 
      'utf8'
    );
    
    expect(promptContent).toContain('You are Alonso');
    expect(promptContent).toContain('Amazon parrot');
  });
  
  it('should identify bot correctly in handoff emails', () => {
    const handoffContent = fs.readFileSync(
      path.join(process.cwd(), 'app/api/handoff/route.ts'), 
      'utf8'
    );
    
    expect(handoffContent).toContain("'Alonso'");
    expect(handoffContent).not.toContain("'Danni'");
  });
});