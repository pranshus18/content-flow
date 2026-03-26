/**
 * Copy and paste this entire script into your browser console
 * (while logged into your app as admin)
 * 
 * This will test if the generate-caption function is working
 */

(async function testGenerateCaption() {
  console.log('🧪 Testing generate-caption Edge Function...\n');
  
  // Step 1: Check authentication
  console.log('1️⃣ Checking authentication...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (user) {
    console.log('   ✅ Logged in as:', user.email);
  } else {
    console.log('   ❌ NOT logged in!');
    console.log('   Error:', authError?.message);
    console.log('\n   💡 Solution: Log in to your app first');
    return;
  }
  console.log('');
  
  // Step 2: Check environment
  console.log('2️⃣ Checking environment...');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  console.log('   Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('   Supabase Key:', supabaseKey ? '✅ Set' : '❌ Missing');
  if (!supabaseUrl || !supabaseKey) {
    console.log('\n   💡 Solution: Check your .env file');
    return;
  }
  console.log('');
  
  // Step 3: Test function invocation
  console.log('3️⃣ Testing function invocation...');
  try {
    const { data, error } = await supabase.functions.invoke('generate-caption', {
      body: {
        userDescription: 'A beautiful sunset over the ocean with vibrant colors',
        title: 'Sunset Photo',
        platform: 'instagram',
        mediaType: 'image'
      }
    });
    
    if (error) {
      console.log('   ❌ Function Error:');
      console.log('   Message:', error.message);
      console.log('   Full Error:', error);
      console.log('');
      
      // Provide specific solutions
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        console.log('   💡 SOLUTION: Function is not deployed!');
        console.log('   1. Go to Supabase Dashboard → Edge Functions');
        console.log('   2. Click "Create Function"');
        console.log('   3. Name it: generate-caption');
        console.log('   4. Copy code from: supabase/functions/generate-caption/index.ts');
        console.log('   5. Paste and Deploy');
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.log('   💡 SOLUTION: Authentication issue');
        console.log('   1. Log out of the app');
        console.log('   2. Log back in');
        console.log('   3. Try again');
      } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        console.log('   💡 SOLUTION: Network/Connection issue');
        console.log('   1. Check your internet connection');
        console.log('   2. Verify Supabase URL is correct:', supabaseUrl);
        console.log('   3. Check if Supabase project is active');
      } else if (error.message?.includes('Failed to send')) {
        console.log('   💡 SOLUTION: Cannot reach Edge Function');
        console.log('   1. Verify function is deployed in Supabase Dashboard');
        console.log('   2. Check function name is exactly: generate-caption');
        console.log('   3. Verify you are logged in');
      }
    } else if (data?.success && data?.caption) {
      console.log('   ✅ SUCCESS! Function is working!');
      console.log('   Generated Caption:', data.caption.substring(0, 100) + '...');
      console.log('');
      console.log('   🎉 Everything is configured correctly!');
      console.log('   The "Generate with AI" button should work now.');
    } else if (data?.error) {
      console.log('   ⚠️ Function returned error:', data.error);
      if (data.error.includes('API key')) {
        console.log('');
        console.log('   💡 SOLUTION: API keys not set in Supabase Secrets');
        console.log('   1. Go to Supabase Dashboard → Edge Functions → Secrets');
        console.log('   2. Add GEMINI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY');
        console.log('   3. Wait 30 seconds or redeploy function');
      }
    } else {
      console.log('   ⚠️ Unexpected response:', data);
    }
  } catch (err) {
    console.log('   ❌ Exception occurred:');
    console.log('   Error:', err.message);
    console.log('   Full Error:', err);
  }
  
  console.log('\n✅ Test complete!');
})();

