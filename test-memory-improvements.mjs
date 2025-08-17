#!/usr/bin/env node

/**
 * Test script for memory and context improvements
 * Verifies that the chatbot maintains context and remembers key information
 */

const API_URL = 'http://localhost:3000/api/chat';
const SESSION_ID = 'memory_test_' + Date.now();

async function sendMessage(messages) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `cbc_session=${SESSION_ID}`
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Testing Memory & Context Improvements\n');
  console.log('Session ID:', SESSION_ID);
  console.log('=' .repeat(60));
  
  const conversation = [];
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Initial time query
  console.log('\n📝 Test 1: Initial time query');
  conversation.push({ role: 'user', content: 'What time is it?' });
  const response1 = await sendMessage(conversation);
  console.log('Response:', response1?.reply?.substring(0, 100) + '...');
  
  if (response1?.reply?.includes('Club')) {
    testsPassed++;
    console.log('✅ Time query successful');
  } else {
    testsFailed++;
    console.log('❌ Time query failed');
  }
  
  conversation.push({ role: 'assistant', content: response1?.reply || '' });
  
  // Test 2: Weather query
  console.log('\n📝 Test 2: Weather query');
  conversation.push({ role: 'user', content: 'What about the weather?' });
  const response2 = await sendMessage(conversation);
  console.log('Response:', response2?.reply?.substring(0, 100) + '...');
  
  if (response2?.reply?.includes('°C')) {
    testsPassed++;
    console.log('✅ Weather query successful');
  } else {
    testsFailed++;
    console.log('❌ Weather query failed');
  }
  
  conversation.push({ role: 'assistant', content: response2?.reply || '' });
  
  // Test 3: Tennis courts info
  console.log('\n📝 Test 3: Tennis courts information');
  conversation.push({ role: 'user', content: 'How many tennis courts do you have?' });
  const response3 = await sendMessage(conversation);
  console.log('Response:', response3?.reply?.substring(0, 100) + '...');
  
  if (response3?.reply?.includes('8') || response3?.reply?.includes('eight')) {
    testsPassed++;
    console.log('✅ Tennis courts info correct');
  } else {
    testsFailed++;
    console.log('❌ Tennis courts info incorrect');
  }
  
  conversation.push({ role: 'assistant', content: response3?.reply || '' });
  
  // Test 4: Memory recall - ask about time again
  console.log('\n📝 Test 4: Memory recall - time consistency');
  conversation.push({ role: 'user', content: 'Can you remind me what time you said it was?' });
  const response4 = await sendMessage(conversation);
  console.log('Response:', response4?.reply?.substring(0, 150) + '...');
  
  // Check if it references or maintains time context
  if (response4?.reply?.includes('PM') || response4?.reply?.includes('AM')) {
    testsPassed++;
    console.log('✅ Time memory maintained');
  } else {
    testsFailed++;
    console.log('❌ Time memory lost');
  }
  
  conversation.push({ role: 'assistant', content: response4?.reply || '' });
  
  // Test 5: Context awareness - reference tennis from earlier
  console.log('\n📝 Test 5: Context awareness - tennis reference');
  conversation.push({ role: 'user', content: 'Are the tennis courts you mentioned open now?' });
  const response5 = await sendMessage(conversation);
  console.log('Response:', response5?.reply?.substring(0, 150) + '...');
  
  // Should reference that it's late (from earlier time mention) and courts are closed
  if (response5?.reply && (response5.reply.includes('closed') || response5.reply.includes('night') || response5.reply.includes('late'))) {
    testsPassed++;
    console.log('✅ Context awareness working - knows it\'s late');
  } else {
    testsFailed++;
    console.log('❌ Context awareness failed');
  }
  
  // Test 6: Check if weather is still remembered
  console.log('\n📝 Test 6: Weather memory recall');
  conversation.push({ role: 'user', content: 'Is it good weather for outdoor activities?' });
  const response6 = await sendMessage(conversation);
  console.log('Response:', response6?.reply?.substring(0, 150) + '...');
  
  // Should reference the weather from earlier
  if (response6?.reply && (response6.reply.includes('27') || response6.reply.includes('weather') || response6.reply.includes('temperature'))) {
    testsPassed++;
    console.log('✅ Weather context maintained');
  } else {
    testsFailed++;
    console.log('❌ Weather context lost');
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total: ${testsPassed + testsFailed}`);
  console.log(`🎯 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsPassed === 6) {
    console.log('\n🎉 Perfect! All memory and context tests passed!');
    console.log('The chatbot successfully maintains context throughout the conversation.');
  } else if (testsPassed >= 4) {
    console.log('\n✨ Good! Most memory features are working correctly.');
  } else {
    console.log('\n⚠️ Some memory features need improvement.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});