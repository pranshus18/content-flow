import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync as readEnv } from 'fs';

// Try to load environment variables from .env file
let SUPABASE_URL, SUPABASE_ANON_KEY;

try {
  if (existsSync('.env')) {
    const envContent = readEnv('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key.trim() === 'VITE_SUPABASE_URL') {
        SUPABASE_URL = value.replace(/^["']|["']$/g, '');
      }
      if (key.trim() === 'VITE_SUPABASE_PUBLISHABLE_KEY') {
        SUPABASE_ANON_KEY = value.replace(/^["']|["']$/g, '');
      }
    });
  }
} catch (e) {
  // Ignore if .env doesn't exist
}

// Allow override via command line or environment
SUPABASE_URL = process.env.VITE_SUPABASE_URL || SUPABASE_URL;
SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('\nPlease provide Supabase credentials in one of these ways:');
  console.error('\n1. Create a .env file in the project root:');
  console.error('   VITE_SUPABASE_URL=your-project-url');
  console.error('   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key');
  console.error('\n2. Or set them as environment variables:');
  console.error('   export VITE_SUPABASE_URL=your-project-url');
  console.error('   export VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key');
  console.error('\n3. Or pass them as command line arguments:');
  console.error('   node upload-logo.js --url=your-url --key=your-key');
  console.error('\nYou can find these in your Supabase project settings:');
  console.error('   Supabase Dashboard → Project Settings → API');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadLogo() {
  try {
    const logoPath = join(__dirname, 'public', 'Screenshot 2026-01-15 at 10.58.35 PM.png');
    
    console.log('📤 Reading logo file...');
    const fileBuffer = readFileSync(logoPath);
    const fileName = 'tatva-ops-logo.png'; // Clean filename
    const filePath = `branding/${fileName}`;
    
    console.log('📤 Uploading to Supabase storage...');
    console.log(`   Bucket: content-media`);
    console.log(`   Path: ${filePath}`);
    
    const { data, error } = await supabase.storage
      .from('content-media')
      .upload(filePath, fileBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // If it's a duplicate error, try to update instead
      if (error.message?.includes('already exists')) {
        console.log('⚠️  File exists, updating...');
        const { error: updateError } = await supabase.storage
          .from('content-media')
          .update(filePath, fileBuffer, {
            contentType: 'image/png',
            cacheControl: '3600',
          });
        
        if (updateError) {
          throw updateError;
        }
      } else {
        throw error;
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('content-media')
      .getPublicUrl(filePath);

    console.log('\n✅ Logo uploaded successfully!');
    console.log(`\n📎 Public URL:`);
    console.log(`   ${publicUrl}`);
    console.log(`\n💡 You can now use this URL in your branding settings.`);
    console.log(`   Go to Settings → Media Branding & Watermark`);
    console.log(`   Paste this URL in the "Company Logo" field.`);
    
    return publicUrl;
  } catch (error) {
    console.error('\n❌ Error uploading logo:', error.message);
    
    if (error.message?.includes('new row violates row-level security')) {
      console.error('\n💡 Tip: Make sure you are logged in as an admin user.');
      console.error('   The branding folder requires admin permissions.');
    } else if (error.message?.includes('JWT')) {
      console.error('\n💡 Tip: You may need to authenticate first.');
      console.error('   Try logging in through the app, then run this script.');
    }
    
    process.exit(1);
  }
}

uploadLogo();
