import { NextRequest, NextResponse } from 'next/server';
import { initFaqs, searchFaqs, getAllFaqs } from '@/src/lib/faqs';

export async function GET(request: NextRequest) {
  try {
    // Initialize FAQs if needed
    await initFaqs();
    
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    
    if (query) {
      // Search mode
      const topN = parseInt(process.env.FAQ_RETURN_TOP || '1', 10);
      const results = searchFaqs(query, topN);
      
      // Remove scores from production responses for security
      const sanitizedHits = results.hits.map(hit => ({
        id: hit.id,
        q: hit.q,
        a: hit.a,
        tags: hit.tags,
        categoryId: hit.categoryId,
        categoryTitle: hit.categoryTitle,
        ...(process.env.NODE_ENV === 'development' ? { score: hit.score } : {}),
      }));
      
      return NextResponse.json({
        query,
        hits: sanitizedHits,
      });
    } else {
      // Summary mode
      const allFaqs = getAllFaqs();
      const categories = new Set(allFaqs.map(f => f.categoryId));
      const latestUpdate = allFaqs
        .map(f => f.updatedAt)
        .filter(Boolean)
        .sort()
        .pop();
      
      return NextResponse.json({
        categoriesCount: categories.size,
        faqsCount: allFaqs.length,
        updatedAtMax: latestUpdate || null,
      });
    }
  } catch (error) {
    console.error('[FAQs API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}