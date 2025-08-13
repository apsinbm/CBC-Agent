# Accommodation System Test Queries

Test these queries in the chatbot to verify accommodation functionality:

## Basic Queries
1. "What cottages do you have?"
2. "Tell me about Surfsong cottage"
3. "Do you have family-friendly accommodations?"
4. "Which rooms have ocean views?"
5. "What's the largest cottage?"

## Rate/Availability Queries (should defer to Reservations)
1. "How much is a room for tonight?"
2. "What are the rates for Surfsong?"
3. "Is Bay Grape available next week?"
4. "Can I book a cottage for Christmas?"

## Specific Cottage Queries
1. "Tell me about cottages with beach access"
2. "Which cottages have kitchens?"
3. "Do any cottages have washers and dryers?"
4. "What's special about Enchanted Trifle?"

## Policy Questions
1. "What's your cancellation policy?"
2. "Can non-members book rooms?"
3. "Do members get any discounts?"
4. "What taxes apply to room rates?"

## Expected Behaviors:
- ✅ Should provide detailed descriptions of accommodations
- ✅ Should mention member priority and 15% discount
- ✅ Should NEVER quote specific rates
- ✅ Should NEVER claim availability
- ✅ Should always refer to reservations@coralbeach.bm for bookings
- ✅ Should mention that all rates include breakfast
- ✅ Should help match accommodations to guest needs