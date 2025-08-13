/**
 * FAQ Indexing and Search System
 * 
 * This module provides hybrid search (keyword + semantic) for FAQs.
 * Scoring combines elasticlunr keyword search with simple bag-of-words similarity.
 * 
 * Scoring thresholds (tune via env vars):
 * - FAQ_SCORE_THRESHOLD (0.68): Direct answer threshold
 * - FAQ_LOW_THRESHOLD (0.50): Low confidence threshold
 * 
 * To add better embeddings later: Replace computeSimilarity() with
 * vector embeddings from OpenAI/Cohere/etc.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as elasticlunr from 'elasticlunr';

// FAQ types
export interface FAQ {
  id: string;
  q: string;
  a: string;
  tags: string[];
  updatedAt: string;
  categoryId?: string;
}

export interface FAQCategory {
  id: string;
  title: string;
  faqs: FAQ[];
}

export interface FAQData {
  categories: FAQCategory[];
}

export interface SearchResult {
  faq: FAQ;
  score: number;
  reasons: string[];
}

// Singleton FAQ index
let faqIndex: any = null;
let faqData: Map<string, FAQ> = new Map();
let initialized = false;

/**
 * Load and validate FAQ data from YAML file
 */
function loadFAQData(): FAQData {
  const faqPath = path.join(process.cwd(), 'data', 'faqs.yaml');
  
  if (!fs.existsSync(faqPath)) {
    console.warn('FAQ file not found at:', faqPath);
    return { categories: [] };
  }
  
  try {
    const fileContent = fs.readFileSync(faqPath, 'utf8');
    const data = yaml.load(fileContent) as FAQData;
    
    // Validate structure
    if (!data || !Array.isArray(data.categories)) {
      throw new Error('Invalid FAQ data structure');
    }
    
    // Add category ID to each FAQ for context
    data.categories.forEach(category => {
      if (Array.isArray(category.faqs)) {
        category.faqs.forEach(faq => {
          faq.categoryId = category.id;
        });
      }
    });
    
    return data;
  } catch (error) {
    console.error('Error loading FAQ data:', error);
    return { categories: [] };
  }
}

/**
 * Initialize the search index
 */
export function initializeFAQIndex(): void {
  if (initialized) return;
  
  const data = loadFAQData();
  
  // Create elasticlunr index
  faqIndex = elasticlunr(function() {
    this.addField('q');
    this.addField('a');
    this.addField('tags');
    this.setRef('id');
    this.saveDocument(true);
  });
  
  // Index all FAQs
  data.categories.forEach(category => {
    category.faqs.forEach(faq => {
      // Store FAQ in map
      faqData.set(faq.id, faq);
      
      // Index for search
      faqIndex.addDoc({
        id: faq.id,
        q: faq.q,
        a: faq.a,
        tags: faq.tags.join(' ')
      });
    });
  });
  
  initialized = true;
}

/**
 * Compute simple bag-of-words similarity (fallback for semantic search)
 */
function computeSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  let intersection = 0;
  set1.forEach(word => {
    if (set2.has(word)) intersection++;
  });
  
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Search FAQs with hybrid scoring
 */
export function searchFAQs(
  query: string, 
  options: { limit?: number } = {}
): SearchResult[] {
  // Initialize if needed
  if (!initialized) {
    initializeFAQIndex();
  }
  
  const limit = options.limit || 3;
  const results: SearchResult[] = [];
  
  if (!query || query.trim().length === 0) {
    return results;
  }
  
  try {
    // Keyword search with elasticlunr
    const searchResults = faqIndex.search(query, {
      fields: {
        q: { boost: 3 },
        tags: { boost: 2 },
        a: { boost: 1 }
      },
      expand: true
    });
    
    // Process and score results
    searchResults.forEach((result: any) => {
      const faq = faqData.get(result.ref);
      if (!faq) return;
      
      // Keyword score from elasticlunr (normalized)
      const keywordScore = Math.min(result.score / 10, 1);
      
      // Semantic similarity score
      const semanticScore = computeSimilarity(query, `${faq.q} ${faq.a}`);
      
      // Combined score (weighted average)
      const combinedScore = (keywordScore * 0.7) + (semanticScore * 0.3);
      
      // Determine match reasons
      const reasons: string[] = [];
      if (keywordScore > 0.5) reasons.push('keyword match');
      if (semanticScore > 0.3) reasons.push('semantic similarity');
      
      // Check for exact tag matches
      const queryLower = query.toLowerCase();
      const exactTagMatch = faq.tags.some(tag => 
        queryLower.includes(tag.toLowerCase()) || 
        tag.toLowerCase().includes(queryLower)
      );
      if (exactTagMatch) {
        reasons.push('tag match');
      }
      
      results.push({
        faq,
        score: exactTagMatch ? Math.min(combinedScore + 0.2, 1) : combinedScore,
        reasons
      });
    });
    
    // Also check for direct question matches not caught by search
    faqData.forEach(faq => {
      const alreadyIncluded = results.some(r => r.faq.id === faq.id);
      if (!alreadyIncluded) {
        const directSimilarity = computeSimilarity(query, faq.q);
        if (directSimilarity > 0.6) {
          results.push({
            faq,
            score: directSimilarity,
            reasons: ['direct question match']
          });
        }
      }
    });
    
    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
    
  } catch (error) {
    console.error('FAQ search error:', error);
    return [];
  }
}

/**
 * Get FAQ by ID
 */
export function getFAQById(id: string): FAQ | undefined {
  if (!initialized) {
    initializeFAQIndex();
  }
  return faqData.get(id);
}

/**
 * Get all FAQs (for admin/debugging)
 */
export function getAllFAQs(): FAQ[] {
  if (!initialized) {
    initializeFAQIndex();
  }
  return Array.from(faqData.values());
}