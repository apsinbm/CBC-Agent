import nodemailer from 'nodemailer'

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
    console.error('SMTP send failed:', error)
    return false
  }
}

// Fallback: SendGrid
async function sendViaSendGrid(options: EmailOptions): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    return false
  }

  try {
    const sgMail = await import('@sendgrid/mail').then(m => m.default).catch(() => null)
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
    console.error('SendGrid send failed:', error)
    return false
  }
}

// Fallback: AWS SES
async function sendViaAWSSES(options: EmailOptions): Promise<boolean> {
  if (!process.env.AWS_SES_REGION || !process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_SECRET_ACCESS_KEY) {
    return false
  }

  try {
    const AWS = await import('aws-sdk').then(m => m.default).catch(() => null)
    if (!AWS) return false
    
    AWS.config.update({
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      region: process.env.AWS_SES_REGION,
    })

    const ses = new AWS.SES({ apiVersion: '2010-12-01' })

    const params = {
      Source: process.env.SMTP_USER || 'noreply@coralbeach.bm',
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
    console.error('AWS SES send failed:', error)
    return false
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Try primary SMTP
  if (await sendViaSMTP(options)) {
    return true
  }

  // Try SendGrid
  if (await sendViaSendGrid(options)) {
    return true
  }

  // Try AWS SES
  if (await sendViaAWSSES(options)) {
    return true
  }

  console.error('All email providers failed')
  return false
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

export async function sendIntakeEmail(options: IntakeEmailOptions): Promise<boolean> {
  const frontDeskEmail = process.env.FRONTDESK_EMAIL || process.env.FRONT_DESK_EMAIL || 'frontdesk@coralbeach.bm'
  const { type, subject, data } = options
  const { payload } = data
  
  // Generate email content based on type
  let emailContent = generateIntakeEmailContent(type, payload)
  
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

  // Send to front desk
  const frontDeskEmailSent = await sendEmail({
    to: frontDeskEmail,
    subject,
    text,
    html,
    attachments: [{
      filename: `intake-${data.id}.json`,
      content: JSON.stringify(data, null, 2),
    }],
  })
  
  // Send confirmation to guest
  const guestEmailSent = await sendEmail({
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
  
  return frontDeskEmailSent || guestEmailSent
}

function generateIntakeEmailContent(type: string, payload: any): { text: string; html: string } {
  switch (type) {
    case 'dining':
      return {
        text: `
Dining Reservation Request
Name: ${payload.fullName}
Email: ${payload.email}
Phone: ${payload.phone || 'Not provided'}
Member/Room Number: ${payload.memberRoomNumber || 'Not provided'}
Party Size: ${payload.partySize}
Restaurant: ${payload.restaurant}
Meal: ${payload.meal}
Date: ${payload.date}
Time: ${payload.time}
Special Requests: ${payload.specialRequests || 'None'}
`,
        html: `
<div class="section">
  <h3>Dining Reservation Request</h3>
  <p><span class="label">Name:</span> ${payload.fullName}</p>
  <p><span class="label">Email:</span> ${payload.email}</p>
  <p><span class="label">Phone:</span> ${payload.phone || 'Not provided'}</p>
  <p><span class="label">Member/Room Number:</span> ${payload.memberRoomNumber || 'Not provided'}</p>
  <p><span class="label">Party Size:</span> ${payload.partySize}</p>
  <p><span class="label">Restaurant:</span> ${payload.restaurant}</p>
  <p><span class="label">Meal:</span> ${payload.meal}</p>
  <p><span class="label">Date:</span> ${payload.date}</p>
  <p><span class="label">Time:</span> ${payload.time}</p>
  <p><span class="label">Special Requests:</span> ${payload.specialRequests || 'None'}</p>
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
      
    default:
      return {
        text: JSON.stringify(payload, null, 2),
        html: `<pre>${JSON.stringify(payload, null, 2)}</pre>`
      }
  }
}