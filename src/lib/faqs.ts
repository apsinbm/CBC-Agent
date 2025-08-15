import Fuse from 'fuse.js';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';

// Global singleton state
declare global {
  var __CBC_FAQ_STATE: {
    index: FlatFAQ[] | null;
    fuse: Fuse<FlatFAQ> | null;
    lastLoaded: number;
    watcher?: any;
  } | undefined;
}

interface FAQ {
  id: string;
  q: string;
  a: string;
  tags?: string[];
  updatedAt?: string;
}

interface Category {
  id: string;
  title: string;
  faqs: FAQ[];
}

interface FAQData {
  categories: Category[];
}

interface FlatFAQ {
  id: string;
  q: string;
  a: string;
  tags: string[];
  categoryId: string;
  categoryTitle: string;
  updatedAt?: string;
}

interface SearchHit extends FlatFAQ {
  score?: number;
}

// Initialize global state if not exists
if (!globalThis.__CBC_FAQ_STATE) {
  globalThis.__CBC_FAQ_STATE = {
    index: null,
    fuse: null,
    lastLoaded: 0,
  };
}

const FAQ_PATH = path.join(process.cwd(), 'data', 'faqs.yaml');
const CACHE_TTL = process.env.NODE_ENV === 'development' ? 2000 : 60000; // 2s in dev, 60s in prod

// Normalize query for better matching
function normalizeQuery(query: string): string {
  let normalized = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Simple keyword replacements only
  if (normalized.includes('pickle ball')) {
    normalized = normalized.replace('pickle ball', 'pickleball');
  }
  
  return normalized;
}

// Find exact or very high confidence matches
function findExactMatches(index: FlatFAQ[], normalizedQuery: string): SearchHit[] {
  const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);
  const matches: SearchHit[] = [];
  
  for (const faq of index) {
    const questionWords = normalizeQuery(faq.q).split(' ');
    const tagWords = faq.tags.flatMap(tag => normalizeQuery(tag).split(' '));
    
    // Check for exact question match
    if (normalizeQuery(faq.q) === normalizedQuery) {
      matches.push({ ...faq, score: 0.0 });
      continue;
    }
    
    // Check for high word overlap (70%+ of query words found)
    let matchingWords = 0;
    for (const word of queryWords) {
      if (questionWords.includes(word) || tagWords.includes(word)) {
        matchingWords++;
      }
    }
    
    if (queryWords.length > 0 && matchingWords / queryWords.length >= 0.7) {
      matches.push({ ...faq, score: 0.1 - (matchingWords / queryWords.length) * 0.05 });
    }
  }
  
  // Sort by score (lower is better)
  return matches.sort((a, b) => (a.score || 0) - (b.score || 0));
}

// Load and parse FAQs from YAML
async function loadFAQs(): Promise<FlatFAQ[]> {
  try {
    const fileContent = await fs.readFile(FAQ_PATH, 'utf-8');
    const data = yaml.load(fileContent) as FAQData;
    
    if (!data?.categories || !Array.isArray(data.categories)) {
      console.warn('[FAQs] Invalid YAML structure: missing categories array');
      return [];
    }
    
    const flatIndex: FlatFAQ[] = [];
    
    for (const category of data.categories) {
      if (!category.id || !category.title || !Array.isArray(category.faqs)) {
        console.warn(`[FAQs] Skipping invalid category: ${category.id || 'unknown'}`);
        continue;
      }
      
      for (const faq of category.faqs) {
        if (!faq.id || !faq.q || !faq.a) {
          console.warn(`[FAQs] Skipping invalid FAQ in category ${category.id}`);
          continue;
        }
        
        flatIndex.push({
          id: faq.id,
          q: faq.q,
          a: faq.a,
          tags: Array.isArray(faq.tags) ? faq.tags : [],
          categoryId: category.id,
          categoryTitle: category.title,
          updatedAt: faq.updatedAt,
        });
      }
    }
    
    console.log(`[FAQs] Loaded ${flatIndex.length} FAQs from ${data.categories.length} categories`);
    return flatIndex;
  } catch (error) {
    console.warn('[FAQs] Failed to load FAQs:', error instanceof Error ? error.message : error);
    return [];
  }
}

// Initialize FAQ system (idempotent)
export async function initFaqs(): Promise<void> {
  const state = globalThis.__CBC_FAQ_STATE!;
  const now = Date.now();
  
  // Check if we need to reload
  if (state.index && state.fuse && (now - state.lastLoaded) < CACHE_TTL) {
    return; // Already loaded and fresh
  }
  
  try {
    const flatIndex = await loadFAQs();
    
    if (flatIndex.length === 0) {
      state.index = [];
      state.fuse = null;
      state.lastLoaded = now;
      return;
    }
    
    // Configure Fuse.js for fuzzy search with enhanced settings
    const fuseOptions: Fuse.IFuseOptions<FlatFAQ> = {
      includeScore: true,
      threshold: 0.4,  // More precise threshold for better matches
      distance: 80,    // Reduced distance for better relevance
      minMatchCharLength: 2,
      ignoreLocation: true,  // Don't penalize matches at different positions
      findAllMatches: true,  // Include all matches
      keys: [
        { name: 'q', weight: 0.70 },       // Increased question weight
        { name: 'tags', weight: 0.20 },    // Tags are important
        { name: 'categoryTitle', weight: 0.10 },
      ],
    };
    
    state.index = flatIndex;
    state.fuse = new Fuse(flatIndex, fuseOptions);
    state.lastLoaded = now;
  } catch (error) {
    console.warn('[FAQs] Initialization failed:', error);
    // Keep existing index if reload fails
  }
}

// Search FAQs with enhanced relevance
export function searchFaqs(query: string, topN: number = 1): { hits: SearchHit[] } {
  const state = globalThis.__CBC_FAQ_STATE!;
  
  if (!state.fuse || !state.index || state.index.length === 0) {
    return { hits: [] };
  }
  
  const normalized = normalizeQuery(query);
  
  // First, check for exact matches or high-confidence matches
  const exactMatches = findExactMatches(state.index, normalized);
  if (exactMatches.length > 0) {
    return { hits: exactMatches.slice(0, topN) };
  }
  
  // Then do fuzzy search
  const results = state.fuse.search(normalized, { limit: Math.max(topN * 3, 10) }); // Get more for better selection
  
  if (results.length === 0) {
    return { hits: [] };
  }
  
  // Process results with enhanced scoring
  const hits: SearchHit[] = results
    .map(result => ({
      ...result.item,
      score: result.score,
    }))
    .filter(hit => (hit.score || 0) < 0.8); // Filter out very poor matches
  
  if (hits.length === 0) {
    return { hits: [] };
  }
  
  // Enhanced tie-breaking: consider multiple factors
  if (hits.length > 1) {
    const topScore = hits[0].score || 0;
    const tied = hits.filter(h => Math.abs((h.score || 0) - topScore) < 0.03); // Slightly wider tie margin
    
    if (tied.length > 1) {
      // Enhanced sorting: tag overlap, question length, then answer length
      const queryTokens = new Set(normalized.split(' '));
      tied.sort((a, b) => {
        // 1. Tag overlap (higher is better)
        const aTagOverlap = a.tags.filter(t => 
          t.split(' ').some(word => queryTokens.has(word.toLowerCase()))
        ).length;
        const bTagOverlap = b.tags.filter(t => 
          t.split(' ').some(word => queryTokens.has(word.toLowerCase()))
        ).length;
        
        if (aTagOverlap !== bTagOverlap) {
          return bTagOverlap - aTagOverlap; // More overlap is better
        }
        
        // 2. Question length (shorter questions often more specific)
        if (Math.abs(a.q.length - b.q.length) > 20) {
          return a.q.length - b.q.length;
        }
        
        // 3. Answer length (shorter is usually better for quick answers)
        return a.a.length - b.a.length;
      });
      
      // Replace the original order with the tie-broken order
      hits.splice(0, tied.length, ...tied);
    }
  }
  
  return { hits: hits.slice(0, topN) };
}

// Get all FAQs
export function getAllFaqs(): FlatFAQ[] {
  const state = globalThis.__CBC_FAQ_STATE!;
  return state.index || [];
}

// Hot reload in development
export function hotReloadInDev(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  const state = globalThis.__CBC_FAQ_STATE!;
  
  // Don't set up multiple watchers
  if (state.watcher) {
    return;
  }
  
  try {
    const fsWatch = require('fs');
    
    state.watcher = fsWatch.watch(FAQ_PATH, async (eventType: string) => {
      if (eventType === 'change') {
        console.log('[FAQs] Detected change in faqs.yaml, reloading...');
        // Force reload by clearing cache
        state.lastLoaded = 0;
        await initFaqs();
      }
    });
    
    console.log('[FAQs] Hot reload watcher enabled for development');
  } catch (error) {
    console.warn('[FAQs] Could not enable hot reload:', error);
  }
}