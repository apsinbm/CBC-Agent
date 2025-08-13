import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/src/lib/email';
import { logEvent } from '@/src/lib/analytics/logEvent';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, email, phone, message, transcript } = data;
    
    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }
    
    // Get IP for analytics
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Log handoff request
    await logEvent('HANDOFF_REQUESTED', {
      hasPhone: !!phone,
      hasTranscript: !!transcript,
      messageLength: message.length
    }, { ip });
    
    // Prepare email content
    const emailSubject = `[CBC Concierge] Handoff Request - ${name}`;
    
    let emailBody = `
<h2>Guest Assistant Handoff Request</h2>

<p><strong>Guest Information:</strong></p>
<ul>
  <li><strong>Name:</strong> ${name}</li>
  <li><strong>Email:</strong> ${email}</li>
  ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ''}
</ul>

<p><strong>Guest's Question/Message:</strong></p>
<blockquote style="background: #f5f5f5; padding: 10px; border-left: 3px solid #ccc;">
  ${message.replace(/\n/g, '<br>')}
</blockquote>
`;

    if (transcript && transcript.length > 0) {
      emailBody += `
<p><strong>Recent Chat History:</strong></p>
<div style="background: #f9f9f9; padding: 10px; border: 1px solid #ddd;">
`;
      
      // Include last 5 exchanges
      const recentTranscript = transcript.slice(-10);
      recentTranscript.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'Guest' : 'Alonso';
        emailBody += `
<p><strong>${role}:</strong> ${msg.content.substring(0, 500)}${msg.content.length > 500 ? '...' : ''}</p>
`;
      });
      
      emailBody += '</div>';
    }
    
    emailBody += `
<p style="margin-top: 20px; color: #666; font-size: 12px;">
  This handoff was requested via the CBC Guest Assistant chatbot at ${new Date().toLocaleString()}.
</p>
`;
    
    // Send email to reception
    const frontDeskEmail = process.env.FRONT_DESK_EMAIL || 'frontdesk@coralbeach.bm';
    
    const emailSent = await sendEmail({
      to: frontDeskEmail,
      subject: emailSubject,
      html: emailBody,
      text: emailBody.replace(/<[^>]*>/g, '') // Strip HTML for text version
    });
    
    // Log email result
    await logEvent('EMAIL_SENT', {
      success: emailSent,
      type: 'handoff'
    }, { ip });
    
    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: "We've sent your message to our Reception team. They'll follow up with you soon."
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send message. Please try again or call the front desk.' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Handoff API error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}