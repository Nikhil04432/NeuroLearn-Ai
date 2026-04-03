/**
 * ============================================================
 * /api/curate-keywords/route.ts
 * ============================================================
 *
 * WHAT IS THIS FILE?
 * This is a Next.js API Route (like a Spring Boot @RestController endpoint).
 * It receives a job title + description from the Chrome extension,
 * sends it to Google Gemini AI, and returns a list of skill keywords.
 *
 * HTTP METHOD: POST
 * ENDPOINT:    /api/curate-keywords
 *
 * REQUEST BODY (JSON):
 * {
 *   "jobTitle": "Full Stack Developer",
 *   "jobDescription": "We are looking for a developer with React, Node.js..."
 * }
 *
 * RESPONSE (JSON):
 * {
 *   "title": "Full Stack Developer",
 *   "summary": "A role focused on building web applications with React and Node.js",
 *   "keywords": ["React JS", "Node.js", "MongoDB", "REST APIs", "TypeScript"]
 * }
 *
 * JAVA ANALOGY:
 * This is like a @PostMapping("/curate-keywords") in Spring Boot,
 * where @RequestBody maps to the JSON we parse with request.json()
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/gemini';

/**
 * POST handler - Next.js App Router style
 * Named export "POST" tells Next.js to call this for POST requests
 */
export async function POST(request: NextRequest) {
  try {
    // ─── Parse the request body ───
    // request.json() is async — it reads and parses the JSON body
    const { jobTitle, jobDescription } = await request.json();

    // ─── LOG: Incoming request ───
    console.log('\n[curate-keywords API] ═══════════════════════════════════');
    console.log('[curate-keywords API] 📥 Incoming request:');
    console.log('[curate-keywords API]   Job Title:', jobTitle);
    console.log('[curate-keywords API]   Description length:', jobDescription?.length, 'chars');
    console.log('[curate-keywords API]   Description preview:', jobDescription?.substring(0, 150) + '...');

    // ─── Validation ───
    if (!jobTitle || !jobDescription) {
      console.warn('[curate-keywords API] ❌ Validation failed: missing jobTitle or jobDescription');
      return NextResponse.json(
        { error: 'jobTitle and jobDescription are required' },
        { status: 400 }
      );
    }

    if (jobDescription.length < 30) {
      console.warn('[curate-keywords API] ❌ Description too short:', jobDescription.length, 'chars');
      return NextResponse.json(
        { error: 'Job description is too short to extract meaningful keywords' },
        { status: 400 }
      );
    }

    // ─── Call Gemini AI to extract keywords ───
    console.log('[curate-keywords API] 🤖 Calling Gemini AI...');
    const geminiService = new GeminiService();
    const enhancedData = await geminiService.enhanceJobKeywords(jobTitle, jobDescription);

    // ─── LOG: Gemini AI response ───
    console.log('[curate-keywords API] ✅ Gemini AI responded!');
    console.log('[curate-keywords API] 🎯 EXTRACTED KEYWORDS:');
    console.log('[curate-keywords API]   Title:', enhancedData.title);
    console.log('[curate-keywords API]   Summary:', enhancedData.summary);
    console.log('[curate-keywords API]   Keywords (' + enhancedData.keywords?.length + '):');
    enhancedData.keywords?.forEach((kw: string, i: number) => {
      console.log(`[curate-keywords API]     ${i + 1}. ${kw}`);
    });
    console.log('[curate-keywords API] ═══════════════════════════════════\n');

    return NextResponse.json({
      title: enhancedData.title,
      summary: enhancedData.summary,
      keywords: enhancedData.keywords
    });

  } catch (error) {
    // Catch-all: If Gemini API fails, network errors, or JSON parse errors
    console.error('[curate-keywords API] Error:', error);

    return NextResponse.json(
      { error: 'Failed to process job description. Please try again.' },
      { status: 500 }  // 500 = Internal Server Error
    );
  }
}