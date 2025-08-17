#!/usr/bin/env node

/**
 * Test script for contextual response handling
 * Verifies that affirmative responses to bot suggestions work correctly
 */

const API_URL = 'http://localhost:3000/api/chat';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(messages) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.reply;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

async function runTest(testName, messages, expectedPatterns) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(60));
  
  const conversation = [];
  let success = true;
  
  for (let i = 0; i < messages.length; i++) {
    const userMessage = messages[i];
    conversation.push({ role: 'user', content: userMessage });
    
    console.log(`\nUSER: ${userMessage}`);
    
    const reply = await sendMessage(conversation);
    
    if (!reply) {
      console.error('❌ Failed to get response');
      return false;
    }
    
    console.log(`BOT: ${reply.substring(0, 200)}${reply.length > 200 ? '...' : ''}`);
    
    conversation.push({ role: 'assistant', content: reply });
    
    // Check if expected pattern exists for this turn
    if (expectedPatterns[i]) {
      const patterns = Array.isArray(expectedPatterns[i]) ? expectedPatterns[i] : [expectedPatterns[i]];
      const matched = patterns.some(pattern => {
        if (pattern.startsWith('!')) {
          // Negative pattern - should NOT match
          return !reply.toLowerCase().includes(pattern.substring(1).toLowerCase());
        } else {
          // Positive pattern - should match
          return reply.toLowerCase().includes(pattern.toLowerCase());
        }
      });
      
      if (!matched) {
        console.error(`\n❌ Response ${i + 1} failed pattern check`);
        console.error(`   Expected patterns: ${patterns.join(' OR ')}`);
        console.error(`   Got: ${reply.substring(0, 100)}...`);
        success = false;
      } else {
        console.log(`✅ Response ${i + 1} matches expected pattern`);
      }
    }
    
    await sleep(1000); // Delay between messages
  }
  
  return success;
}

async function runAllTests() {
  console.log('\n🧪 Starting Contextual Response Tests');
  console.log('Make sure the development server is running on http://localhost:3000\n');
  
  const tests = [
    {
      name: 'Weather → Yes (should provide dining info)',
      messages: [
        'What is the weather?',
        'Yes'
      ],
      patterns: [
        ['weather', 'temperature', 'conditions'],
        ['dining', 'menu', 'restaurant', '!yoga', '!tennis', '!spa']
      ]
    },
    {
      name: 'Time → Yes (should provide dining info)',
      messages: [
        'What time is it?',
        'Yes please'
      ],
      patterns: [
        ['time', 'AM', 'PM'],
        ['dining', 'menu', 'restaurant', '!yoga', '!golf', '!spa']
      ]
    },
    {
      name: 'Direct "Yes" without context (might match FAQ)',
      messages: [
        'Yes'
      ],
      patterns: [
        null // Don't check pattern for standalone "Yes"
      ]
    },
    {
      name: 'Weather → Absolutely (contextual affirmation)',
      messages: [
        'How is the weather today?',
        'Absolutely'
      ],
      patterns: [
        ['weather', 'temperature', 'sunny', 'cloudy', 'degrees'],
        ['dining', 'menu', 'breakfast', 'lunch', 'dinner', '!yoga']
      ]
    },
    {
      name: 'Non-contextual question after weather',
      messages: [
        'What is the weather?',
        'What activities are available?'
      ],
      patterns: [
        ['weather', 'temperature'],
        ['activities', 'tennis', 'beach', 'spa', '!weather']
      ]
    },
    {
      name: 'Multiple contextual follow-ups',
      messages: [
        'What time is it?',
        'Sure',
        'What about dinner?'
      ],
      patterns: [
        ['time', 'clock', 'AM', 'PM'],
        ['dining', 'menu', '!yoga', '!spa'],
        ['dinner', 'evening', 'restaurant']
      ]
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await runTest(test.name, test.messages, test.patterns);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    await sleep(2000); // Delay between tests
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Contextual responses are working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the contextual affirmation logic.');
  }
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});