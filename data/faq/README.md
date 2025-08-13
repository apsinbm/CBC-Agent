# FAQ Content Management Guide

## Overview
The FAQ system for CBC-Agent uses markdown files with frontmatter to manage frequently asked questions. Each category has its own file, making it easy to update content without touching the code.

## File Structure
```
data/faq/
├── transport.md         # Airport transfers, taxis, parking
├── hotel-services.md    # Front desk, housekeeping, amenities
├── dining.md           # Restaurants, reservations, dress code
├── sports.md           # Tennis, pickleball, gym, activities
├── bermuda-basics.md   # Weather, currency, customs
├── weddings.md         # Venues, catering, planning
└── README.md          # This file
```

## Category File Format

Each FAQ file must include:
1. **Frontmatter** (metadata at the top between `---` markers)
2. **Questions and Answers** in a specific format

### Example File Structure
```markdown
---
title: "Category Name"
icon: "icon-name"
order: 1
---

## Q: Your question here?

A: Your answer here. Can include **bold**, *italic*, and other markdown formatting.

## Q: Another question?

A: Another answer with multiple paragraphs.

Second paragraph of the answer.
```

### Frontmatter Fields
- `title`: Display name for the category
- `icon`: Icon identifier (see available icons below)
- `order`: Number for sorting categories (lower numbers appear first)

### Available Icons
- `car` - Transport
- `bell` - Hotel Services
- `utensils` - Dining
- `tennis-ball` - Sports
- `island` - Bermuda Info
- `heart` - Weddings
- `question-circle` - General

## Adding a New Category
1. Create a new `.md` file in `/data/faq/`
2. Add frontmatter with title, icon, and order
3. Add Q&A pairs using the format above
4. The category will automatically appear in the FAQ modal

## Adding Questions to Existing Categories
1. Open the relevant `.md` file
2. Add a new Q&A section:
```markdown
## Q: Your new question?

A: Your detailed answer here.
```

## Best Practices
- Keep questions concise and clear
- Start each question with "Q:" after the `##`
- Start each answer with "A:" on a new line
- Use markdown for formatting (lists, bold, links)
- Keep answers guest-friendly and informative
- Point to Reception for specific rates/availability

## Content Guidelines
- Never quote specific room rates
- Always defer availability to Reservations
- Include contact information where relevant
- Use inclusive, welcoming language
- Keep technical jargon to a minimum

## TODO Items
The following information needs to be confirmed/added:
- [ ] Specific business center facilities and hours
- [ ] Exact breakfast hours by season
- [ ] Current spa treatment menu and pricing
- [ ] Tennis clinic schedule
- [ ] Beach service seasonal dates
- [ ] Kids club programs and ages
- [ ] Specific dietary menu options
- [ ] Wedding package pricing tiers
- [ ] Group booking policies
- [ ] Pet policies

## Testing Your Changes
1. Save your markdown file
2. Refresh the app in development mode
3. Click the FAQ button to see your changes
4. Test the search function with keywords from your content
5. Verify formatting and links work correctly

## Troubleshooting
- **FAQ not appearing**: Check frontmatter syntax (must have `---` markers)
- **Formatting issues**: Ensure "Q:" and "A:" markers are properly formatted
- **Order issues**: Verify the `order` number in frontmatter
- **Search not finding content**: Keywords may need to be more prominent in Q or A text

## URL Deep Linking
FAQs support deep linking with the format:
```
https://yoursite.com/#faq=category-question-slug
```
Example: `#faq=transport-airport-transfers`

The slug is auto-generated from the category ID and question text.