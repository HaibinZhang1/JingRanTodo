const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    // 1. Launch browser
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // 2. Set viewport to match the icon frame but larger to ensure capture
    await page.setViewportSize({ width: 500, height: 500 });

    // 3. Load the HTML file
    // Assuming this script is run from project root
    const htmlPath = path.resolve(process.cwd(), '井然-图标.html');

    if (!fs.existsSync(htmlPath)) {
        console.error('Error: 井然-图标.html not found at', htmlPath);
        process.exit(1);
    }

    const fileUrl = 'file://' + htmlPath;
    console.log('Loading:', fileUrl);
    await page.goto(fileUrl);

    // 4. Locate the icon frame
    const iconFrame = page.locator('.icon-frame');
    await iconFrame.waitFor();

    // 5. Screenshot the element
    // We want a transparent background if possible. 
    // The HTML body has a dark background. We might need to inject CSS to make body transparent?
    // The icon itself has shadows that might need the background to look right?
    // The requirement says: "modify icon". Usually app icons need transparent background.
    // The HTML provided has: body { background-color: #0f172a; }
    // Let's try to make the page background transparent BEFORE screenshotting the element.
    // However, screenshotting an element usually cuts it out.
    // If the element has internal shadows/glows that rely on blending, we might need a specific background.
    // But for an app icon, we typically want PNG with transparency.
    // The `.icon-frame` has `border-radius: 68px;` and shadows.

    // Inject style to make sure we capture it cleanly on transparent bg if desired
    await page.evaluate(() => {
        document.body.style.background = 'transparent';
    });

    const outputPath = path.resolve(process.cwd(), 'public', 'icon.png');

    console.log('Taking screenshot...');
    await iconFrame.screenshot({
        path: outputPath,
        omitBackground: true // This ensures the screenshot has transparent background where applicable
    });

    console.log('Icon saved to:', outputPath);

    await browser.close();
})();
