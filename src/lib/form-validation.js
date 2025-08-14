/**
 * Form validation and compliance rules
 * Ensures all guest intake forms meet current specifications
 */

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Phone validation regex (international format)
 */
const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,4}$/;

/**
 * Date validation (YYYY-MM-DD)
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validation rules for each form type
 */
export const FORM_RULES = {
  reservation: {
    required: {
      fullName: {
        min: 2,
        max: 100,
        pattern: /^[a-zA-Z\s\-']+$/,
        message: 'Please enter a valid name (letters, spaces, hyphens, apostrophes only)'
      },
      email: {
        pattern: EMAIL_REGEX,
        message: 'Please enter a valid email address'
      },
      planningMode: {
        values: ['certain', 'unsure'],
        message: 'Please indicate if you have specific dates or are exploring options'
      },
      numberOfGuests: {
        min: 1,
        max: 12,
        type: 'number',
        message: 'Number of guests must be between 1 and 12'
      },
      consent: {
        type: 'boolean',
        value: true,
        message: 'Consent is required to process your inquiry'
      }
    },
    conditionalRequired: {
      // Required only if planningMode is 'certain'
      arrivalDate: {
        when: (data) => data.planningMode === 'certain',
        pattern: DATE_REGEX,
        validator: (value) => {
          const date = new Date(value);
          return date >= new Date().setHours(0, 0, 0, 0);
        },
        message: 'Please select a valid arrival date (cannot be in the past)'
      },
      departureDate: {
        when: (data) => data.planningMode === 'certain',
        pattern: DATE_REGEX,
        validator: (value, data) => {
          const departure = new Date(value);
          const arrival = new Date(data.arrivalDate);
          return departure > arrival;
        },
        message: 'Departure date must be after arrival date'
      }
    },
    optional: {
      phone: {
        pattern: PHONE_REGEX,
        message: 'Please enter a valid phone number'
      },
      countryCity: {
        max: 100
      },
      partyBreakdown: {
        max: 200
      },
      accommodationPreference: {
        values: ['Main Club rooms', 'Cottages', 'Suites', 'No preference']
      },
      budgetRange: {
        max: 100
      },
      airlineInfo: {
        max: 200
      },
      memberStatus: {
        max: 200
      },
      bookingQuestion: {
        max: 500
      },
      interests: {
        type: 'array',
        values: [
          'Rooms & Cottages',
          'Dining & Restaurants',
          'Spa & Wellness',
          'Tennis & Sports',
          'Beach Services',
          'Family Activities',
          'Special Events',
          'Weddings & Celebrations',
          'Other'
        ]
      },
      otherInterest: {
        max: 200,
        when: (data) => data.interests?.includes('Other')
      },
      specialRequests: {
        max: 500
      }
    }
  },
  
  dining: {
    required: {
      name: {
        min: 2,
        max: 100,
        pattern: /^[a-zA-Z\s\-']+$/,
        message: 'Please enter a valid name'
      },
      email: {
        pattern: EMAIL_REGEX,
        message: 'Please enter a valid email address'
      },
      preferredDate: {
        pattern: DATE_REGEX,
        validator: (value) => {
          const date = new Date(value);
          return date >= new Date().setHours(0, 0, 0, 0);
        },
        message: 'Please select a valid date'
      },
      preferredTime: {
        pattern: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
        message: 'Please select a valid time'
      },
      numberOfGuests: {
        min: 1,
        max: 20,
        type: 'number',
        message: 'Party size must be between 1 and 20'
      },
      venue: {
        values: ['Coral Room', 'Longtail Terrace', 'Beach Terrace', 'Frozen Hut', 'Private Dining']
      }
    },
    optional: {
      phone: {
        pattern: PHONE_REGEX
      },
      specialRequests: {
        max: 500
      },
      dietaryRestrictions: {
        max: 500
      }
    }
  },
  
  spa: {
    required: {
      name: {
        min: 2,
        max: 100,
        pattern: /^[a-zA-Z\s\-']+$/
      },
      email: {
        pattern: EMAIL_REGEX
      },
      preferredDate: {
        pattern: DATE_REGEX,
        validator: (value) => new Date(value) >= new Date().setHours(0, 0, 0, 0)
      },
      serviceType: {
        values: ['Facial', 'Massage', 'Body Treatment', 'Salon Services', 'Package', 'Other']
      }
    },
    optional: {
      phone: {
        pattern: PHONE_REGEX
      },
      preferredTime: {
        pattern: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      specificService: {
        max: 200
      },
      specialRequests: {
        max: 500
      }
    }
  },
  
  tennis: {
    required: {
      name: {
        min: 2,
        max: 100,
        pattern: /^[a-zA-Z\s\-']+$/
      },
      email: {
        pattern: EMAIL_REGEX
      },
      courtType: {
        values: ['Tennis', 'Pickleball', 'Squash']
      },
      preferredDate: {
        pattern: DATE_REGEX,
        validator: (value) => {
          const date = new Date(value);
          const today = new Date().setHours(0, 0, 0, 0);
          const maxAdvance = new Date();
          maxAdvance.setDate(maxAdvance.getDate() + 7);
          return date >= today && date <= maxAdvance;
        },
        message: 'Courts can be booked up to 1 week in advance'
      },
      numberOfPlayers: {
        min: 1,
        max: 4,
        type: 'number'
      }
    },
    optional: {
      phone: {
        pattern: PHONE_REGEX
      },
      preferredTime: {
        pattern: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      courtNumber: {
        type: 'number',
        min: 1,
        max: 8
      },
      playerNames: {
        max: 200,
        message: 'Please list all players'
      },
      equipmentNeeded: {
        type: 'array',
        values: ['Rackets', 'Balls', 'None']
      }
    }
  },
  
  wedding: {
    required: {
      name: {
        min: 2,
        max: 100,
        pattern: /^[a-zA-Z\s\-']+$/
      },
      email: {
        pattern: EMAIL_REGEX
      },
      eventType: {
        values: ['Wedding Ceremony', 'Reception', 'Both', 'Engagement', 'Other Celebration']
      },
      estimatedGuests: {
        min: 10,
        max: 400,
        type: 'number',
        message: 'Guest count must be between 10 and 400'
      },
      memberSponsor: {
        min: 2,
        max: 100,
        message: 'CBC member sponsorship is required for all events'
      }
    },
    optional: {
      phone: {
        pattern: PHONE_REGEX
      },
      preferredDate: {
        pattern: DATE_REGEX
      },
      alternateDate: {
        pattern: DATE_REGEX
      },
      venue: {
        values: [
          'Wedding Lawn',
          'Beach',
          'Longtail Terrace',
          'Coral Room',
          'Beach Terrace',
          'Frozen Hut Deck',
          'The Cave',
          'Main Lounge',
          'Multiple Venues'
        ]
      },
      budget: {
        max: 100
      },
      specialRequests: {
        max: 1000
      }
    }
  }
};

/**
 * Validate a single field
 * @param {string} value - Field value
 * @param {object} rule - Validation rule
 * @param {object} formData - Full form data (for conditional validation)
 * @returns {object} - { valid: boolean, error?: string }
 */
export function validateField(value, rule, formData = {}) {
  // Check conditional requirement
  if (rule.when && !rule.when(formData)) {
    return { valid: true };
  }
  
  // Check required
  if (rule.required !== false) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return { valid: false, error: rule.message || 'This field is required' };
    }
  }
  
  // Type validation
  if (rule.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      return { valid: false, error: 'Must be a number' };
    }
    if (rule.min !== undefined && num < rule.min) {
      return { valid: false, error: rule.message || `Must be at least ${rule.min}` };
    }
    if (rule.max !== undefined && num > rule.max) {
      return { valid: false, error: rule.message || `Must be no more than ${rule.max}` };
    }
  }
  
  if (rule.type === 'boolean') {
    if (rule.value !== undefined && value !== rule.value) {
      return { valid: false, error: rule.message || 'Invalid value' };
    }
  }
  
  if (rule.type === 'array') {
    if (!Array.isArray(value)) {
      return { valid: false, error: 'Must be an array' };
    }
    if (rule.values) {
      const invalidItems = value.filter(item => !rule.values.includes(item));
      if (invalidItems.length > 0) {
        return { valid: false, error: `Invalid values: ${invalidItems.join(', ')}` };
      }
    }
  }
  
  // String validation
  if (typeof value === 'string') {
    if (rule.min !== undefined && value.length < rule.min) {
      return { valid: false, error: `Must be at least ${rule.min} characters` };
    }
    if (rule.max !== undefined && value.length > rule.max) {
      return { valid: false, error: `Must be no more than ${rule.max} characters` };
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return { valid: false, error: rule.message || 'Invalid format' };
    }
  }
  
  // Enum validation
  if (rule.values && !rule.values.includes(value)) {
    return { valid: false, error: `Must be one of: ${rule.values.join(', ')}` };
  }
  
  // Custom validator
  if (rule.validator && !rule.validator(value, formData)) {
    return { valid: false, error: rule.message || 'Invalid value' };
  }
  
  return { valid: true };
}

/**
 * Validate entire form
 * @param {object} formData - Form data to validate
 * @param {string} formType - Type of form (reservation, dining, etc.)
 * @returns {object} - { valid: boolean, errors: { field: error } }
 */
export function validateForm(formData, formType) {
  const rules = FORM_RULES[formType];
  if (!rules) {
    return { valid: false, errors: { form: 'Unknown form type' } };
  }
  
  const errors = {};
  
  // Validate required fields
  for (const [field, rule] of Object.entries(rules.required)) {
    const result = validateField(formData[field], { ...rule, required: true }, formData);
    if (!result.valid) {
      errors[field] = result.error;
    }
  }
  
  // Validate conditional required fields
  if (rules.conditionalRequired) {
    for (const [field, rule] of Object.entries(rules.conditionalRequired)) {
      if (rule.when && rule.when(formData)) {
        const result = validateField(formData[field], { ...rule, required: true }, formData);
        if (!result.valid) {
          errors[field] = result.error;
        }
      }
    }
  }
  
  // Validate optional fields (if provided)
  if (rules.optional) {
    for (const [field, rule] of Object.entries(rules.optional)) {
      if (formData[field] !== undefined && formData[field] !== '') {
        const result = validateField(formData[field], rule, formData);
        if (!result.valid) {
          errors[field] = result.error;
        }
      }
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Sanitize form data for storage
 * @param {object} formData - Raw form data
 * @param {string} formType - Type of form
 * @returns {object} - Sanitized data
 */
export function sanitizeFormData(formData, formType) {
  const sanitized = {};
  const rules = FORM_RULES[formType];
  
  if (!rules) return formData;
  
  // Process all defined fields
  const allFields = {
    ...rules.required,
    ...(rules.conditionalRequired || {}),
    ...(rules.optional || {})
  };
  
  for (const [field, rule] of Object.entries(allFields)) {
    let value = formData[field];
    
    if (value === undefined || value === '') continue;
    
    // Trim strings
    if (typeof value === 'string') {
      value = value.trim();
      
      // Remove any HTML/script tags
      value = value.replace(/<[^>]*>/g, '');
      
      // Limit length
      if (rule.max) {
        value = value.substring(0, rule.max);
      }
    }
    
    // Ensure numbers are numbers
    if (rule.type === 'number') {
      value = Number(value);
    }
    
    // Ensure booleans are booleans
    if (rule.type === 'boolean') {
      value = Boolean(value);
    }
    
    // Ensure arrays are arrays
    if (rule.type === 'array' && !Array.isArray(value)) {
      value = [value];
    }
    
    sanitized[field] = value;
  }
  
  return sanitized;
}