/**
 * Email Service Test Endpoint
 * 
 * Allows safe testing of email configuration in development/staging environments.
 * Restricted to dry-run mode and development environments for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isEmailNotificationsEnabled } from '@/src/lib/feature-flags';
import { notifyReception } from '@/src/lib/email';
import { safeLog } from '@/src/lib/pii-protection';

export async function POST(request: NextRequest) {
  try {
    // Security checks
    const isDryRun = process.env.EMAIL_DRY_RUN === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Only allow in development or when dry run is enabled
    if (isProduction && !isDryRun) {
      return NextResponse.json({
        ok: false,
        message: 'Email testing is not allowed in production without dry run mode',
        hint: 'Enable EMAIL_DRY_RUN=true to test email configuration safely'
      }, { status: 403 });
    }
    
    // Check if email notifications are enabled
    if (!isEmailNotificationsEnabled()) {
      return NextResponse.json({
        ok: false,
        message: 'Email notifications are disabled via feature flag',
        hint: 'Set FEATURE_EMAIL_NOTIFICATIONS=true to enable email testing'
      }, { status: 400 });
    }
    
    const body = await request.json();
    const { type = 'test', includeGuestCopy = false } = body;
    
    // Validate test type
    const validTypes = ['test', 'dining', 'tennis', 'spa', 'wedding', 'plan-your-stay', 'courts-lawn-sports'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        ok: false,
        message: `Invalid test type. Valid types: ${validTypes.join(', ')}`
      }, { status: 400 });
    }
    
    // Generate test data based on type
    const testData = generateTestData(type);
    
    const intakeData = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload: testData,
      createdAt: new Date().toISOString(),
      ipHash: 'test-ip-hash',
      userAgent: 'Email Test Agent'
    };
    
    safeLog('Email Test', `Testing email for type: ${type}, dry run: ${isDryRun}`);
    
    // Send test email
    const startTime = Date.now();
    const success = await notifyReception({
      type,
      subject: `TEST: ${type} email template - ${new Date().toLocaleString()}`,
      data: intakeData,
      sendGuestCopy: includeGuestCopy
    });
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      ok: true,
      message: success 
        ? 'Test email sent successfully' 
        : 'Email sending failed - check logs for details',
      test_id: intakeData.id,
      type,
      dry_run_mode: isDryRun,
      guest_copy_sent: includeGuestCopy,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    safeLog('Email Test Error', 'Email test failed:', error.message);
    
    return NextResponse.json({
      ok: false,
      message: 'Email test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}\n\n/**\n * Generate test data for different intake types\n */\nfunction generateTestData(type: string): any {\n  const baseData = {\n    fullName: 'Test User',\n    email: 'test@example.com',\n    phone: '+1-441-555-0123',\n    timestamp: new Date().toISOString(),\n    timezone: 'America/Halifax'\n  };\n  \n  switch (type) {\n    case 'dining':\n      return {\n        ...baseData,\n        memberRoomNumber: 'TEST-123',\n        partySize: 2,\n        restaurant: 'Coral Beach Restaurant',\n        meal: 'Dinner',\n        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow\n        time: '19:00',\n        specialRequests: 'This is a test reservation - please ignore'\n      };\n      \n    case 'tennis':\n      return {\n        ...baseData,\n        requestType: 'Court Booking',\n        players: 2,\n        preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],\n        preferredTime: '14:00',\n        preferredSurface: 'Clay',\n        proPreference: 'Any available',\n        notes: 'Test tennis booking - please ignore'\n      };\n      \n    case 'courts-lawn-sports':\n      return {\n        ...baseData,\n        memberNumber: 'TEST-456',\n        sportType: 'Tennis',\n        requestType: 'Lesson',\n        players: 1,\n        preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],\n        preferredTime: '10:00',\n        preferredSurface: 'Hard Court',\n        proPreference: 'Head Pro preferred',\n        notes: 'Test courts & lawn sports booking - please ignore'\n      };\n      \n    case 'spa':\n      return {\n        ...baseData,\n        treatmentType: 'Relaxation Massage',\n        duration: '60 minutes',\n        preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],\n        preferredTimeWindow: 'Morning (9am-12pm)',\n        accessibilityRequests: 'Test spa booking - please ignore'\n      };\n      \n    case 'wedding':\n      return {\n        ...baseData,\n        coupleNames: 'Test Bride & Test Groom',\n        guestCount: '50-75',\n        preferredSeason: 'Spring 2025',\n        venuePreferences: ['Beachfront', 'Garden'],\n        cateringStyle: 'Plated dinner',\n        budgetBand: '$50,000 - $75,000',\n        hasPlanner: 'Yes',\n        plannerName: 'Test Wedding Planner',\n        vision: 'Test wedding inquiry - please ignore. Elegant beachfront ceremony with garden reception.'\n      };\n      \n    case 'plan-your-stay':\n      return {\n        ...baseData,\n        countryCity: 'Test City, Test Country',\n        planningMode: 'certain',\n        arrivalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next week\n        departureDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days\n        numberOfGuests: 2,\n        partyBreakdown: '2 adults',\n        accommodationPreference: 'Ocean View Room',\n        budgetRange: '$500-750 per night',\n        airlineInfo: 'Test Airline Flight 123',\n        memberStatus: 'Non-member',\n        bookingQuestion: 'Test reservation inquiry - please ignore',\n        interests: ['Tennis', 'Spa', 'Dining'],\n        otherInterest: 'Beach activities',\n        specialRequests: 'Test reservation - please ignore all details'\n      };\n      \n    default:\n      return {\n        ...baseData,\n        testType: type,\n        message: 'This is a test email - please ignore'\n      };\n  }\n}\n\n// Only allow GET for documentation\nexport async function GET(request: NextRequest) {\n  return NextResponse.json({\n    endpoint: '/api/email/test',\n    description: 'Test email service configuration and templates',\n    methods: ['POST'],\n    restrictions: [\n      'Only available in development environment',\n      'Only available when EMAIL_DRY_RUN=true in production',\n      'Requires FEATURE_EMAIL_NOTIFICATIONS=true'\n    ],\n    parameters: {\n      type: {\n        description: 'Type of email template to test',\n        options: ['test', 'dining', 'tennis', 'spa', 'wedding', 'plan-your-stay', 'courts-lawn-sports'],\n        default: 'test'\n      },\n      includeGuestCopy: {\n        description: 'Whether to send a copy to the test guest email',\n        type: 'boolean',\n        default: false\n      }\n    },\n    example: {\n      type: 'dining',\n      includeGuestCopy: false\n    }\n  });\n}"