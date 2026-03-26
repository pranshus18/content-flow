/**
 * Facebook/Instagram Token Expiration Checker
 * 
 * This script helps you check when your Facebook/Instagram tokens expire.
 * 
 * Usage:
 * 1. Replace {YOUR_TOKEN} with your actual access token
 * 2. Run: node check-token-expiration.js
 * 
 * Or use in browser console at: https://developers.facebook.com/tools/explorer/
 */

const FACEBOOK_APP_ID = '875964825144424';
const FACEBOOK_APP_SECRET = 'b30833d4b100675e3197c3e987ea4de2';

/**
 * Check token expiration
 * @param {string} accessToken - Your Facebook/Instagram access token
 */
async function checkTokenExpiration(accessToken) {
  try {
    // Debug token to get expiration info
    const debugUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
    
    const response = await fetch(debugUrl);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error.message);
      return;
    }
    
    const tokenInfo = data.data;
    const expiresAt = tokenInfo.expires_at;
    const isValid = tokenInfo.is_valid;
    const appId = tokenInfo.app_id;
    
    console.log('\n📊 Token Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Valid: ${isValid ? 'Yes' : 'No'}`);
    console.log(`🆔 App ID: ${appId}`);
    
    if (expiresAt === 0) {
      console.log('⏰ Expires: NEVER (Permanent token) ✅');
    } else {
      const expirationDate = new Date(expiresAt * 1000);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expirationDate - now) / (1000 * 60 * 60 * 24));
      
      console.log(`⏰ Expires: ${expirationDate.toLocaleString()}`);
      console.log(`📅 Days until expiry: ${daysUntilExpiry}`);
      
      if (daysUntilExpiry < 0) {
        console.log('❌ Token has EXPIRED! You need to get a new token.');
      } else if (daysUntilExpiry < 7) {
        console.log('⚠️  WARNING: Token expires in less than 7 days!');
        console.log('🔄 Action: Refresh your token NOW using the exchange process.');
      } else if (daysUntilExpiry < 30) {
        console.log('⚠️  Token expires in less than 30 days.');
        console.log('💡 Tip: Set a reminder to refresh in ' + (daysUntilExpiry - 7) + ' days.');
      } else {
        console.log('✅ Token is valid for more than 30 days. You\'re good!');
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return tokenInfo;
  } catch (error) {
    console.error('❌ Error checking token:', error.message);
  }
}

/**
 * Exchange short-lived token for long-lived token
 * @param {string} shortLivedToken - Your current short-lived or expiring token
 */
async function exchangeForLongLivedToken(shortLivedToken) {
  try {
    const exchangeUrl = `https://graph.facebook.com/v24.0/oauth/access_token`;
    
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: FACEBOOK_APP_ID,
      client_secret: FACEBOOK_APP_SECRET,
      fb_exchange_token: shortLivedToken
    });
    
    const response = await fetch(`${exchangeUrl}?${params}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error.message);
      return null;
    }
    
    const newToken = data.access_token;
    const expiresIn = data.expires_in;
    const expiresInDays = Math.floor(expiresIn / (60 * 60 * 24));
    
    console.log('\n✅ Token Exchange Successful!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 New Long-Lived Token:`);
    console.log(newToken);
    console.log(`⏰ Expires in: ${expiresInDays} days (${expiresIn} seconds)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 Next Steps:');
    console.log('1. Copy the token above');
    console.log('2. Go to Supabase Dashboard → Settings → Edge Functions → Secrets');
    console.log('3. Update FACEBOOK_ACCESS_TOKEN');
    console.log('4. Update INSTAGRAM_ACCESS_TOKEN (same token)');
    console.log('5. Set a reminder for ' + (expiresInDays - 7) + ' days from now\n');
    
    return newToken;
  } catch (error) {
    console.error('❌ Error exchanging token:', error.message);
    return null;
  }
}

// Example usage (uncomment and replace with your token):
/*
const YOUR_TOKEN = 'YOUR_ACCESS_TOKEN_HERE';

// Check expiration
checkTokenExpiration(YOUR_TOKEN).then(() => {
  // If token expires soon, exchange it
  // exchangeForLongLivedToken(YOUR_TOKEN);
});
*/

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkTokenExpiration, exchangeForLongLivedToken };
}

// For browser console usage
if (typeof window !== 'undefined') {
  window.checkTokenExpiration = checkTokenExpiration;
  window.exchangeForLongLivedToken = exchangeForLongLivedToken;
  console.log('✅ Token checker loaded!');
  console.log('Usage:');
  console.log('  checkTokenExpiration("YOUR_TOKEN")');
  console.log('  exchangeForLongLivedToken("YOUR_TOKEN")');
}
