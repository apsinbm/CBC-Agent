import nodemailer from 'nodemailer'
import { isEmailNotificationsEnabled } from './feature-flags'
import { safeLog, createSafeLogObject } from './pii-protection'

interface EmailOptions {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
  }>
}

interface IntakeEmailOptions {
  type: string
  subject: string
  data: any
}

// Primary: SMTP
async function sendViaSMTP(options: EmailOptions): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    })

    return true
  } catch (error) {
    safeLog('Email SMTP', 'Send failed:', error instanceof Error ? error.message : 'Unknown error')
    return false
  }
}

// Fallback: SendGrid
async function sendViaSendGrid(options: EmailOptions): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    return false
  }

  try {
    // Dynamic import with fallback
    let sgMail: any = null
    try {
      const module = await import('@sendgrid/mail' as any)
      sgMail = module.default || module
    } catch {
      safeLog('Email SendGrid', 'Module not installed - skipping')
      return false
    }
    if (!sgMail) return false
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)

    const msg = {
      to: options.to,
      from: process.env.SMTP_USER || 'noreply@coralbeach.bm',
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map(att => ({
        content: att.content.toString('base64'),
        filename: att.filename,
        type: 'application/json',
        disposition: 'attachment',
      })),
    }

    await sgMail.send(msg)
    return true
  } catch (error) {
    safeLog('Email SendGrid', 'Send failed:', error instanceof Error ? error.message : 'Unknown error')
    return false
  }
}

// Mailgun integration
async function sendViaMailgun(options: EmailOptions): Promise<boolean> {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    return false
  }

  try {
    // Dynamic import with fallback
    let mailgun: any = null
    try {
      const module = await import('mailgun-js' as any)
      mailgun = module.default || module
    } catch {
      safeLog('Email Mailgun', 'Module not installed - skipping')
      return false
    }
    if (!mailgun) return false
    
    const mg = mailgun({
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN
    })

    const mailgunOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@coralbeach.bm',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachment: options.attachments?.map(att => ({
        data: att.content,
        filename: att.filename
      }))
    }

    await mg.messages().send(mailgunOptions)
    return true
  } catch (error) {
    safeLog('Email Mailgun', 'Send failed:', error instanceof Error ? error.message : 'Unknown error')
    return false
  }
}

// Fallback: AWS SES
async function sendViaAWSSES(options: EmailOptions): Promise<boolean> {
  if (!process.env.AWS_SES_REGION || !process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_SECRET_ACCESS_KEY) {
    return false
  }

  try {
    // Dynamic import with fallback
    let AWS: any = null
    try {
      const module = await import('aws-sdk' as any)
      AWS = module.default || module
    } catch {
      safeLog('Email AWS SES', 'Module not installed - skipping')
      return false
    }
    if (!AWS) return false
    
    AWS.config.update({
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      region: process.env.AWS_SES_REGION,
    })

    const ses = new AWS.SES({ apiVersion: '2010-12-01' })

    const params = {
      Source: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@coralbeach.bm',
      Destination: {
        ToAddresses: [options.to],
      },
      Message: {
        Subject: {
          Data: options.subject,
        },
        Body: {
          Text: {
            Data: options.text,
          },
          Html: options.html ? {
            Data: options.html,
          } : undefined,
        },
      },
    }

    await ses.sendEmail(params).promise()
    return true
  } catch (error) {
    safeLog('Email AWS SES', 'Send failed:', error instanceof Error ? error.message : 'Unknown error')
    return false
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase() || 'smtp'
  
  // Try specified provider first
  let success = false
  
  switch (provider) {
    case 'smtp':
      success = await sendViaSMTP(options)
      break
    case 'sendgrid':
      success = await sendViaSendGrid(options)
      break
    case 'mailgun':
      success = await sendViaMailgun(options)
      break
    case 'aws':
    case 'ses':
      success = await sendViaAWSSES(options)
      break
    default:
      safeLog('Email', `Unknown provider: ${provider}, falling back to SMTP`)
      success = await sendViaSMTP(options)
  }
  
  // If primary provider failed, try fallbacks
  if (!success) {
    safeLog('Email', `Primary provider ${provider} failed, trying fallbacks`)
    
    if (provider !== 'smtp' && await sendViaSMTP(options)) {
      return true
    }
    if (provider !== 'sendgrid' && await sendViaSendGrid(options)) {
      return true
    }
    if (provider !== 'mailgun' && await sendViaMailgun(options)) {
      return true
    }
    if (provider !== 'aws' && provider !== 'ses' && await sendViaAWSSES(options)) {
      return true
    }
    
    safeLog('Email', 'All email providers failed')
    return false
  }
  
  return true
}

export function generateFrontDeskEmail(data: any): EmailOptions {
  const text = `
New Reservation Inquiry

Guest Contact:
- Name: ${data.fullName}
- Email: ${data.email}
- Phone: ${data.phone || 'Not provided'}
- From: ${data.countryCity || 'Not provided'}

Booking Question/Context:
${data.bookingQuestion || 'Not provided'}

Interests:
${data.interests && data.interests.length > 0 ? data.interests.join(', ') : 'Not specified'}
${data.otherInterest ? `\nOther: ${data.otherInterest}` : ''}

Dates & Party:
- Planning Status: ${data.planningMode === 'certain' ? 'Has specific dates' : 'Still exploring options'}
- Arrival: ${data.arrivalDate || '(not specified)'}
- Departure: ${data.departureDate || '(not specified)'}
- Number of Guests: ${data.numberOfGuests}
- Party Breakdown: ${data.partyBreakdown || 'Not provided'}

Accommodation & Preferences:
- Preference: ${data.accommodationPreference || 'No preference'}
- Budget: ${data.budgetRange || 'Not specified'}

Flight Information:
${data.airlineInfo || 'Not provided'}

Member Status:
${data.memberStatus || 'Not provided'}

Special Requests:
${data.specialRequests || 'None'}

Reference ID: ${data.id}
Submitted: ${data.createdAt}
`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    h2 { color: #004d7a; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; }
  </style>
</head>
<body>
  <h2>New Reservation Inquiry</h2>
  
  <div class="section">
    <h3>Guest Contact</h3>
    <p><span class="label">Name:</span> ${data.fullName}</p>
    <p><span class="label">Email:</span> ${data.email}</p>
    <p><span class="label">Phone:</span> ${data.phone || 'Not provided'}</p>
    <p><span class="label">From:</span> ${data.countryCity || 'Not provided'}</p>
  </div>
  
  ${data.bookingQuestion ? `
  <div class="section">
    <h3>Booking Question/Context</h3>
    <p>${data.bookingQuestion}</p>
  </div>` : ''}
  
  ${data.interests && data.interests.length > 0 ? `
  <div class="section">
    <h3>Areas of Interest</h3>
    <p>${data.interests.join(', ')}</p>
    ${data.otherInterest ? `<p><span class="label">Other:</span> ${data.otherInterest}</p>` : ''}
  </div>` : ''}
  
  <div class="section">
    <h3>Dates & Party</h3>
    <p><span class="label">Planning Status:</span> ${data.planningMode === 'certain' ? 'Has specific dates' : 'Still exploring options'}</p>
    <p><span class="label">Arrival:</span> ${data.arrivalDate || '(not specified)'}</p>
    <p><span class="label">Departure:</span> ${data.departureDate || '(not specified)'}</p>
    <p><span class="label">Number of Guests:</span> ${data.numberOfGuests}</p>
    <p><span class="label">Party Breakdown:</span> ${data.partyBreakdown || 'Not provided'}</p>
  </div>
  
  <div class="section">
    <h3>Accommodation & Preferences</h3>
    <p><span class="label">Preference:</span> ${data.accommodationPreference || 'No preference'}</p>
    <p><span class="label">Budget:</span> ${data.budgetRange || 'Not specified'}</p>
  </div>
  
  <div class="section">
    <h3>Flight Information</h3>
    <p>${data.airlineInfo || 'Not provided'}</p>
  </div>
  
  <div class="section">
    <h3>Member Status</h3>
    <p>${data.memberStatus || 'Not provided'}</p>
  </div>
  
  <div class="section">
    <h3>Special Requests</h3>
    <p>${data.specialRequests || 'None'}</p>
  </div>
  
  <hr>
  <p><small>Reference ID: ${data.id}<br>Submitted: ${data.createdAt}</small></p>
</body>
</html>
`

  return {
    to: process.env.FRONT_DESK_EMAIL || 'frontdesk@coralbeach.bm',
    subject: `New Reservation Inquiry – ${data.arrivalDate || 'Flexible Dates'} – ${data.fullName}`,
    text,
    html,
    attachments: [{
      filename: `reservation-${data.id}.json`,
      content: JSON.stringify(data, null, 2),
    }],
  }
}

export function generateGuestConfirmationEmail(data: any): EmailOptions {
  const text = `
Dear ${data.fullName},

Thank you for your inquiry at Coral Beach & Tennis Club. We've received your reservation request and our front desk team will be in touch within 24-48 hours.

Your Inquiry Summary:
- Planning Status: ${data.planningMode === 'certain' ? 'Specific dates confirmed' : 'Still exploring options'}
- Arrival: ${data.arrivalDate || '(not specified)'}
- Departure: ${data.departureDate || '(not specified)'}
- Guests: ${data.numberOfGuests}
- Accommodation: ${data.accommodationPreference || 'No preference'}${data.interests && data.interests.length > 0 ? `\n- Interests: ${data.interests.join(', ')}` : ''}

Reference ID: ${data.id}

You can reply to this email if you need to add any details or have questions.

We look forward to welcoming you to our pink sand paradise!

Warm regards,
The Coral Beach & Tennis Club Team
`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; }
    h2 { color: #004d7a; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <h2>Thank You for Your Inquiry</h2>
  
  <p>Dear ${data.fullName},</p>
  
  <p>Thank you for your inquiry at Coral Beach & Tennis Club. We've received your reservation request and our front desk team will be in touch within 24-48 hours.</p>
  
  <div class="summary">
    <h3>Your Inquiry Summary</h3>
    <p><strong>Planning Status:</strong> ${data.planningMode === 'certain' ? 'Specific dates confirmed' : 'Still exploring options'}<br>
    <strong>Arrival:</strong> ${data.arrivalDate || '(not specified)'}<br>
    <strong>Departure:</strong> ${data.departureDate || '(not specified)'}<br>
    <strong>Guests:</strong> ${data.numberOfGuests}<br>
    <strong>Accommodation:</strong> ${data.accommodationPreference || 'No preference'}${data.interests && data.interests.length > 0 ? `<br><strong>Interests:</strong> ${data.interests.join(', ')}` : ''}</p>
  </div>
  
  <p><strong>Reference ID:</strong> ${data.id}</p>
  
  <p>You can reply to this email if you need to add any details or have questions.</p>
  
  <p>We look forward to welcoming you to our pink sand paradise!</p>
  
  <p>Warm regards,<br>
  The Coral Beach & Tennis Club Team</p>
</body>
</html>
`

  return {
    to: data.email,
    subject: "We've received your inquiry – Coral Beach & Tennis Club",
    text,
    html,
  }
}

/**
 * Enhanced email notification system with feature flag support
 * 
 * @param {Object} options - Email options
 * @param {string} options.type - Intake type (dining, spa, tennis, etc.)
 * @param {string} options.subject - Email subject
 * @param {Object} options.data - Form submission data
 * @param {boolean} options.sendGuestCopy - Whether to send confirmation to guest
 * @returns {Promise<boolean>} - Success status
 */
export async function notifyReception(options: {
  type: string;
  subject: string;
  data: any;
  sendGuestCopy?: boolean;
}): Promise<boolean> {
  // Check if email notifications are enabled
  if (!isEmailNotificationsEnabled()) {
    safeLog('Email Notifications', 'Feature disabled, skipping email send')
    return true // Return success when disabled to not break workflows
  }
  
  const { type, subject, data, sendGuestCopy = false } = options
  const { payload } = data
  
  // Check for dry run mode
  const isDryRun = process.env.EMAIL_DRY_RUN === 'true'
  
  if (isDryRun) {
    safeLog('Email Dry Run', 'Would send emails:', {
      type,
      subject,
      recipients: getReceptionEmails(),
      guestEmail: sendGuestCopy ? payload.email : 'not sending',
      data: createSafeLogObject(payload)
    })
    return true
  }
  
  // Generate email content based on type
  const emailContent = generateIntakeEmailContent(type, payload)
  
  const subjectPrefix = process.env.EMAIL_SUBJECT_PREFIX || '[CBC Concierge] '
  const fullSubject = subjectPrefix + subject
  
  const text = `
${subject}

${emailContent.text}

Reference ID: ${data.id}
Submitted: ${data.createdAt}
User Timezone: ${payload.timezone || 'Unknown'}
`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    h2 { color: #004d7a; }
    .section { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px; }
    .label { font-weight: bold; color: #333; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h2>${subject}</h2>
  ${emailContent.html}
  <div class="footer">
    <p><strong>Reference ID:</strong> ${data.id}</p>
    <p><strong>Submitted:</strong> ${data.createdAt}</p>
    <p><strong>User Timezone:</strong> ${payload.timezone || 'Unknown'}</p>
  </div>
</body>
</html>
`

  const receptionEmails = getReceptionEmails()
  const bccEmails = process.env.EMAIL_BCC ? process.env.EMAIL_BCC.split(',').map(e => e.trim()) : []
  
  let receptionEmailSent = false
  
  // Send to each reception email address
  for (const email of receptionEmails) {
    const success = await sendEmail({
      to: email,
      subject: fullSubject,
      text,
      html,
      attachments: [{
        filename: `intake-${data.id}.json`,
        content: JSON.stringify(data, null, 2),
      }],
    })
    
    if (success) {
      receptionEmailSent = true
      safeLog('Email Reception', `Sent to ${email.split('@')[0]}@***`)
    } else {
      safeLog('Email Reception', `Failed to send to ${email.split('@')[0]}@***`)
    }
  }
  
  // Send BCC copies if configured
  for (const email of bccEmails) {
    const success = await sendEmail({
      to: email,
      subject: `[BCC] ${fullSubject}`,
      text,
      html,
    })
    
    if (success) {
      safeLog('Email BCC', `Sent to ${email.split('@')[0]}@***`)
    }
  }
  
  // Send confirmation to guest if enabled
  let guestEmailSent = false
  if (sendGuestCopy || process.env.EMAIL_SEND_GUEST_COPY === 'true') {
    guestEmailSent = await sendEmail({
      to: payload.email,
      subject: `Confirmation: ${subject}`,
      text: `Thank you for your submission. We'll be in touch soon.\n\n${text}`,
      html: `
        <h2>Thank you for your submission</h2>
        <p>We've received your request and will be in touch soon.</p>
        <hr>
        ${html}
      `,
    })
    
    if (guestEmailSent) {
      safeLog('Email Guest', `Confirmation sent to ${payload.email?.split('@')[0]}@***`)
    } else {
      safeLog('Email Guest', `Failed to send confirmation to ${payload.email?.split('@')[0]}@***`)
    }
  }
  
  return receptionEmailSent || guestEmailSent
}

/**
 * Get reception email addresses from configuration
 * @returns {string[]} Array of email addresses
 */
function getReceptionEmails(): string[] {
  const receptionEmails = process.env.RECEPTION_EMAILS || 
                         process.env.FRONTDESK_EMAIL || 
                         process.env.FRONT_DESK_EMAIL || 
                         'frontdesk@coralbeach.bm'
  
  return receptionEmails.split(',').map(email => email.trim()).filter(email => email.length > 0)
}

/**
 * Legacy function for backward compatibility
 */
export async function sendIntakeEmail(options: IntakeEmailOptions): Promise<boolean> {
  safeLog('Email', 'Using legacy sendIntakeEmail, consider migrating to notifyReception')
  
  return notifyReception({
    type: options.type,
    subject: options.subject,
    data: options.data,
    sendGuestCopy: true
  })
}

function generateIntakeEmailContent(type: string, payload: any): { text: string; html: string } {
  switch (type) {
    case 'dining':
      return {
        text: `
=== DINING RESERVATION REQUEST ===

GUEST INFORMATION:
• Name: ${payload.fullName}
• Email: ${payload.email}
• Phone: ${payload.phone || 'Not provided'}
• Member/Room Number: ${payload.memberRoomNumber || 'Not provided'}

RESERVATION DETAILS:
• Restaurant: ${payload.restaurant}
• Meal Service: ${payload.meal}
• Party Size: ${payload.partySize} ${payload.partySize === 1 ? 'guest' : 'guests'}
• Preferred Date: ${payload.date}
• Preferred Time: ${payload.time}

${payload.specialRequests ? `SPECIAL REQUESTS:\n${payload.specialRequests}` : 'No special requests'}

=== END REQUEST ===
`,
        html: `
<div class="section">
  <h3>🍽️ Dining Reservation Request</h3>
  
  <div style="margin-bottom: 15px;">
    <h4 style="color: #004d7a; margin-bottom: 8px;">Guest Information</h4>
    <p><span class="label">Name:</span> ${payload.fullName}</p>
    <p><span class="label">Email:</span> ${payload.email}</p>
    <p><span class="label">Phone:</span> ${payload.phone || 'Not provided'}</p>
    <p><span class="label">Member/Room Number:</span> ${payload.memberRoomNumber || 'Not provided'}</p>
  </div>
  
  <div style="margin-bottom: 15px;">
    <h4 style="color: #004d7a; margin-bottom: 8px;">Reservation Details</h4>
    <p><span class="label">Restaurant:</span> <strong>${payload.restaurant}</strong></p>
    <p><span class="label">Meal Service:</span> ${payload.meal}</p>
    <p><span class="label">Party Size:</span> ${payload.partySize} ${payload.partySize === 1 ? 'guest' : 'guests'}</p>
    <p><span class="label">Preferred Date:</span> <strong>${payload.date}</strong></p>
    <p><span class="label">Preferred Time:</span> <strong>${payload.time}</strong></p>
  </div>
  
  ${payload.specialRequests ? `
  <div style="margin-bottom: 15px;">
    <h4 style="color: #004d7a; margin-bottom: 8px;">Special Requests</h4>
    <p style="background: #f8f9fa; padding: 10px; border-left: 3px solid #004d7a;">${payload.specialRequests}</p>
  </div>` : ''}
</div>
`
      }
      
    case 'tennis':
      return {
        text: `
Tennis Booking Request
Name: ${payload.fullName}
Email: ${payload.email}
Phone: ${payload.phone || 'Not provided'}
Request Type: ${payload.requestType}
Players: ${payload.players}
Preferred Date: ${payload.preferredDate}
Preferred Time: ${payload.preferredTime}
Preferred Surface: ${payload.preferredSurface || 'No preference'}
Pro Preference: ${payload.proPreference || 'Any available'}
Notes: ${payload.notes || 'None'}
`,
        html: `
<div class="section">
  <h3>Tennis Booking Request</h3>
  <p><span class="label">Name:</span> ${payload.fullName}</p>
  <p><span class="label">Email:</span> ${payload.email}</p>
  <p><span class="label">Phone:</span> ${payload.phone || 'Not provided'}</p>
  <p><span class="label">Request Type:</span> ${payload.requestType}</p>
  <p><span class="label">Players:</span> ${payload.players}</p>
  <p><span class="label">Preferred Date:</span> ${payload.preferredDate}</p>
  <p><span class="label">Preferred Time:</span> ${payload.preferredTime}</p>
  <p><span class="label">Preferred Surface:</span> ${payload.preferredSurface || 'No preference'}</p>
  <p><span class="label">Pro Preference:</span> ${payload.proPreference || 'Any available'}</p>
  <p><span class="label">Notes:</span> ${payload.notes || 'None'}</p>
</div>
`
      }
      
    case 'courts-lawn-sports':
      return {
        text: `
Courts & Lawn Sports Booking Request
Name: ${payload.fullName}
Email: ${payload.email}
Phone: ${payload.phone || 'Not provided'}
Member Number: ${payload.memberNumber || 'Not provided'}
Sport: ${payload.sportType}
Request Type: ${payload.requestType}
Players: ${payload.players}
Preferred Date: ${payload.preferredDate}
Preferred Time: ${payload.preferredTime}
Preferred Surface: ${payload.preferredSurface || 'No preference'}
Instructor Preference: ${payload.proPreference || 'Any available'}
Notes: ${payload.notes || 'None'}
`,
        html: `
<div class="section">
  <h3>Courts & Lawn Sports Booking Request</h3>
  <p><span class="label">Name:</span> ${payload.fullName}</p>
  <p><span class="label">Email:</span> ${payload.email}</p>
  <p><span class="label">Phone:</span> ${payload.phone || 'Not provided'}</p>
  <p><span class="label">Member Number:</span> ${payload.memberNumber || 'Not provided'}</p>
  <p><span class="label">Sport:</span> ${payload.sportType}</p>
  <p><span class="label">Request Type:</span> ${payload.requestType}</p>
  <p><span class="label">Players:</span> ${payload.players}</p>
  <p><span class="label">Preferred Date:</span> ${payload.preferredDate}</p>
  <p><span class="label">Preferred Time:</span> ${payload.preferredTime}</p>
  <p><span class="label">Preferred Surface:</span> ${payload.preferredSurface || 'No preference'}</p>
  <p><span class="label">Instructor Preference:</span> ${payload.proPreference || 'Any available'}</p>
  <p><span class="label">Notes:</span> ${payload.notes || 'None'}</p>
</div>
`
      }
      
    case 'spa':
      return {
        text: `
Spa Booking Request
Name: ${payload.fullName}
Email: ${payload.email}
Phone: ${payload.phone || 'Not provided'}
Treatment Type: ${payload.treatmentType}
Duration: ${payload.duration || 'Not specified'}
Preferred Date: ${payload.preferredDate}
Preferred Time Window: ${payload.preferredTimeWindow}
Accessibility/Special Requests: ${payload.accessibilityRequests || 'None'}
`,
        html: `
<div class="section">
  <h3>Spa Booking Request</h3>
  <p><span class="label">Name:</span> ${payload.fullName}</p>
  <p><span class="label">Email:</span> ${payload.email}</p>
  <p><span class="label">Phone:</span> ${payload.phone || 'Not provided'}</p>
  <p><span class="label">Treatment Type:</span> ${payload.treatmentType}</p>
  <p><span class="label">Duration:</span> ${payload.duration || 'Not specified'}</p>
  <p><span class="label">Preferred Date:</span> ${payload.preferredDate}</p>
  <p><span class="label">Preferred Time Window:</span> ${payload.preferredTimeWindow}</p>
  <p><span class="label">Accessibility/Special Requests:</span> ${payload.accessibilityRequests || 'None'}</p>
</div>
`
      }
      
    case 'wedding':
      return {
        text: `
Wedding Enquiry
Couple Names: ${payload.coupleNames}
Email: ${payload.email}
Phone: ${payload.phone}
Anticipated Guest Count: ${payload.guestCount}
Preferred Season/Date: ${payload.preferredSeason || 'Not specified'}
Venue Preferences: ${payload.venuePreferences?.join(', ') || 'Not specified'}
Catering Style: ${payload.cateringStyle || 'Not specified'}
Budget Band: ${payload.budgetBand || 'Not specified'}
Working with Planner: ${payload.hasPlanner || 'Not specified'}
Planner Name: ${payload.plannerName || 'N/A'}
Vision/Notes: ${payload.vision || 'None'}
`,
        html: `
<div class="section">
  <h3>Wedding Enquiry</h3>
  <p><span class="label">Couple Names:</span> ${payload.coupleNames}</p>
  <p><span class="label">Email:</span> ${payload.email}</p>
  <p><span class="label">Phone:</span> ${payload.phone}</p>
  <p><span class="label">Anticipated Guest Count:</span> ${payload.guestCount}</p>
  <p><span class="label">Preferred Season/Date:</span> ${payload.preferredSeason || 'Not specified'}</p>
  <p><span class="label">Venue Preferences:</span> ${payload.venuePreferences?.join(', ') || 'Not specified'}</p>
  <p><span class="label">Catering Style:</span> ${payload.cateringStyle || 'Not specified'}</p>
  <p><span class="label">Budget Band:</span> ${payload.budgetBand || 'Not specified'}</p>
  <p><span class="label">Working with Planner:</span> ${payload.hasPlanner || 'Not specified'}</p>
  <p><span class="label">Planner Name:</span> ${payload.plannerName || 'N/A'}</p>
  <p><span class="label">Vision/Notes:</span> ${payload.vision || 'None'}</p>
</div>
`
      }
      
    case 'plan-your-stay':
      return {
        text: `
Reservation Inquiry
Name: ${payload.fullName}
Email: ${payload.email}
Phone: ${payload.phone || 'Not provided'}
From: ${payload.countryCity || 'Not provided'}

Booking Question/Context:
${payload.bookingQuestion || 'Not provided'}

Interests:
${payload.interests && payload.interests.length > 0 ? payload.interests.join(', ') : 'Not specified'}
${payload.otherInterest ? `\\nOther: ${payload.otherInterest}` : ''}

Dates & Party:
- Planning Status: ${payload.planningMode === 'certain' ? 'Has specific dates' : 'Still exploring options'}
- Arrival: ${payload.arrivalDate || '(not specified)'}
- Departure: ${payload.departureDate || '(not specified)'}
- Number of Guests: ${payload.numberOfGuests}
- Party Breakdown: ${payload.partyBreakdown || 'Not provided'}

Accommodation & Preferences:
- Preference: ${payload.accommodationPreference || 'No preference'}
- Budget: ${payload.budgetRange || 'Not specified'}

Flight Information:
${payload.airlineInfo || 'Not provided'}

Member Status:
${payload.memberStatus || 'Not provided'}

Special Requests:
${payload.specialRequests || 'None'}
`,
        html: `
<div class="section">
  <h3>Reservation Inquiry</h3>
  <p><span class="label">Name:</span> ${payload.fullName}</p>
  <p><span class="label">Email:</span> ${payload.email}</p>
  <p><span class="label">Phone:</span> ${payload.phone || 'Not provided'}</p>
  <p><span class="label">From:</span> ${payload.countryCity || 'Not provided'}</p>
</div>

${payload.bookingQuestion ? `
<div class="section">
  <h3>Booking Question/Context</h3>
  <p>${payload.bookingQuestion}</p>
</div>` : ''}

${payload.interests && payload.interests.length > 0 ? `
<div class="section">
  <h3>Areas of Interest</h3>
  <p>${payload.interests.join(', ')}</p>
  ${payload.otherInterest ? `<p><span class="label">Other:</span> ${payload.otherInterest}</p>` : ''}
</div>` : ''}

<div class="section">
  <h3>Dates & Party</h3>
  <p><span class="label">Planning Status:</span> ${payload.planningMode === 'certain' ? 'Has specific dates' : 'Still exploring options'}</p>
  <p><span class="label">Arrival:</span> ${payload.arrivalDate || '(not specified)'}</p>
  <p><span class="label">Departure:</span> ${payload.departureDate || '(not specified)'}</p>
  <p><span class="label">Number of Guests:</span> ${payload.numberOfGuests}</p>
  <p><span class="label">Party Breakdown:</span> ${payload.partyBreakdown || 'Not provided'}</p>
</div>

<div class="section">
  <h3>Accommodation & Preferences</h3>
  <p><span class="label">Preference:</span> ${payload.accommodationPreference || 'No preference'}</p>
  <p><span class="label">Budget:</span> ${payload.budgetRange || 'Not specified'}</p>
</div>

<div class="section">
  <h3>Flight Information</h3>
  <p>${payload.airlineInfo || 'Not provided'}</p>
</div>

<div class="section">
  <h3>Member Status</h3>
  <p>${payload.memberStatus || 'Not provided'}</p>
</div>

<div class="section">
  <h3>Special Requests</h3>
  <p>${payload.specialRequests || 'None'}</p>
</div>
`
      }
      
    default:
      return {
        text: JSON.stringify(payload, null, 2),
        html: `<pre>${JSON.stringify(payload, null, 2)}</pre>`
      }
  }
}