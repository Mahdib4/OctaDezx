// Test AI Function
// Run this in your browser console on the customer chat page to test

async function testAI() {
  console.log('🧪 Testing AI Function...');
  
  try {
    const response = await fetch(
      'https://tmjfvsvpfmmlhvtozjwc.supabase.co/functions/v1/ai-chat-response',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtamZ2c3ZwZm1tbGh2dG96andjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzkxNTgsImV4cCI6MjA3MDg1NTE1OH0.EBxemYR5HHgNp4u6BBRGddcw-bBv2ctYmfP9bzCQlKw'
        },
        body: JSON.stringify({
          message: 'Hello, I need help',
          businessId: 'your-business-id-here',
          sessionId: 'test-session-' + Date.now()
        })
      }
    );
    
    const data = await response.json();
    
    if (data.response) {
      console.log('✅ AI is working!');
      console.log('Response:', data.response);
    } else {
      console.log('❌ No response from AI');
      console.log('Data:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAI();
