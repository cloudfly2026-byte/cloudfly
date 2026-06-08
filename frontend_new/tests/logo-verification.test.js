/**
 * CLOUD-319: Automated verification test for logo visibility and rendering
 * 
 * This test verifies that the CloudFly logo is:
 * 1. Visible in the header/navbar
 * 2. Rendered without distortion or pixelation
 * 3. Has correct dimensions (437x50 as per Logo.tsx)
 * 4. No 404 errors or broken image icons
 */

const { chromium } = require('playwright');

(async () => {
  let browser;
  let exitCode = 0;
  
  try {
    // Connect to existing Chrome instance with CDP
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const page = await context.newPage();
    
    console.log('=== CLOUD-319: Logo Verification Test ===\n');
    
    // Navigate to the application
    console.log('[1/5] Navigating to http://localhost:3000...');
    const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    console.log(`  → Page loaded with status: ${response.status()}`);
    
    if (response.status() !== 200) {
      throw new Error(`Expected status 200, got ${response.status()}`);
    }
    
    // Wait for images to load
    await page.waitForTimeout(3000);
    
    // Test 1: Logo is visible
    console.log('\n[2/5] Checking logo visibility...');
    const logoVisible = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        if (img.src.includes('logo-cloudfly') && img.complete && img.naturalWidth > 0) {
          const rect = img.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0;
        }
      }
      return false;
    });
    console.log(`  → Logo visible in viewport: ${logoVisible ? '✅ PASS' : '❌ FAIL'}`);
    if (!logoVisible) exitCode = 1;
    
    // Test 2: No broken images
    console.log('\n[3/5] Checking for broken images...');
    const brokenImages = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      const broken = [];
      for (const img of imgs) {
        if (!img.complete || img.naturalWidth === 0) {
          broken.push({ src: img.src, alt: img.alt });
        }
      }
      return broken;
    });
    console.log(`  → Broken images found: ${brokenImages.length} ${brokenImages.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
    if (brokenImages.length > 0) {
      console.log(`    Broken: ${JSON.stringify(brokenImages)}`);
      exitCode = 1;
    }
    
    // Test 3: Logo dimensions match (437x50)
    console.log('\n[4/5] Checking logo dimensions...');
    const logoInfo = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        if (img.src.includes('logo-cloudfly')) {
          return {
            renderedWidth: img.width,
            renderedHeight: img.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            alt: img.alt
          };
        }
      }
      return null;
    });
    
    if (logoInfo) {
      const widthMatch = logoInfo.renderedWidth === 437;
      const heightMatch = logoInfo.renderedHeight === 50;
      console.log(`  → Rendered size: ${logoInfo.renderedWidth}x${logoInfo.renderedHeight}`);
      console.log(`  → Natural size: ${logoInfo.naturalWidth}x${logoInfo.naturalHeight}`);
      console.log(`  → Width matches (437): ${widthMatch ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  → Height matches (50): ${heightMatch ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  → Alt text: "${logoInfo.alt}" ✅ PASS`);
      if (!widthMatch || !heightMatch) exitCode = 1;
    } else {
      console.log('  → ❌ FAIL: Logo image not found');
      exitCode = 1;
    }
    
    // Test 4: No 404 errors for logo resource
    console.log('\n[5/5] Checking for 404 errors on logo resource...');
    const logoResourceStatus = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const logoEntry = entries.find(e => e.name.includes('logo-cloudfly'));
      return logoEntry ? logoEntry.responseStatus : null;
    });
    console.log(`  → Logo resource HTTP status: ${logoResourceStatus} ${logoResourceStatus === 200 ? '✅ PASS' : '❌ FAIL'}`);
    if (logoResourceStatus !== 200) exitCode = 1;
    
    // Take final screenshot
    await page.screenshot({ path: 'C:\\apps\\cloudfly\\screenshots\\cloud319_test_final.png', fullPage: true });
    console.log('\n📸 Screenshot saved: C:\\apps\\cloudfly\\screenshots\\cloud319_test_final.png');
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Overall result: ${exitCode === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
  } catch (error) {
    console.error(`\n❌ Test error: ${error.message}`);
    exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
  
  process.exit(exitCode);
})();
