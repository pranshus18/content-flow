/**
 * Quick diagnostic script to test Edge Function connectivity
 * Run this in browser console when on the admin page
 */

async function testGenerateCaptionFunction() {
  console.log('🔍 Testing Edge Function connectivity...\n');
  
  // Check environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  console.log('1. Environment Variables:');
  console.log('   SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('   SUPABASE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  console.log('   URL Value:', supabaseUrl || 'NOT SET');
  console.log('');
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('2. Authentication:');
  if (user) {
    console.log('   ✅ User logged in:', user.email);
  } else {
    console.log('   ❌ Not logged in');
    console.log('   Error:', authError?.message);
  }
  console.log('');
  
  // Test function invocation
  console.log('3. Testing Function Invocation:');
  try {
    const { data, error } = await supabase.functions.invoke('generate-caption', {
      body: {
        userDescription: 'Test description for diagnostic',
        title: 'Test Title',
        platform: 'instagram',
        mediaType: 'image'
      }
    });
    
    if (error) {
      console.log('   ❌ Function Error:');
      console.log('   Message:', error.message);
      console.log('   Full Error:', error);
      
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        console.log('\n   💡 Solution: Deploy the function using:');
        console.log('   supabase functions deploy generate-caption');
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.log('\n   💡 Solution: Log out and log in again');
      } else if (error.message?.includes('Network')) {
        console.log('\n   💡 Solution: Check your Supabase URL and internet connection');
      }
    } else if (data?.success) {
      console.log('   ✅ Function works! Caption generated:', data.caption?.substring(0, 50) + '...');
    } else if (data?.error) {
      console.log('   ⚠️ Function returned error:', data.error);
      if (data.error.includes('API key')) {
        console.log('\n   💡 Solution: Add API keys in Supabase Dashboard → Edge Functions → Secrets');
      }
    } else {
      console.log('   ⚠️ Unexpected response:', data);
    }
  } catch (err) {
    console.log('   ❌ Exception:', err.message);
    console.log('   Full Error:', err);
  }
  
  console.log('\n✅ Diagnostic complete!');
}

// Run the test
testGenerateCaptionFunction();

