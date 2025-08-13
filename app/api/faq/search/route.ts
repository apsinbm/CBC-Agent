import { NextRequest, NextResponse } from 'next/server';
import { searchFAQs } from '@/src/lib/faq';

// Use Edge runtime for speed
export const runtime = 'nodejs'; // Edge doesn't support fs operations, so using nodejs

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }
    
    const limit = parseInt(searchParams.get('limit') || '3', 10);
    const results = searchFAQs(query, { limit });
    
    // Remove internal fields for API response
    const cleanResults = results.map(r => ({
      faq: {
        id: r.faq.id,
        question: r.faq.q,
        answer: r.faq.a,
        category: r.faq.categoryId
      },
      score: r.score,
      matchReasons: r.reasons
    }));
    
    return NextResponse.json({
      query,
      results: cleanResults,
      count: cleanResults.length
    });
    
  } catch (error) {
    console.error('FAQ search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}