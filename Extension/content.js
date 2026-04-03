/**
 * ============================================================
 * content.js - NeuroLearn AI Chrome Extension
 * ============================================================
 *
 * WHAT IS THIS FILE?
 * This is a "content script". It runs INSIDE the webpage the user
 * is currently viewing (like LinkedIn, Indeed, Naukri, etc.).
 *
 * WHY DO WE NEED THIS?
 * The extension's popup.js can't directly read web page content.
 * So we inject this script into the page, it reads the DOM (page structure),
 * extracts job info, and sends it back to popup.js via chrome messaging.
 *
 * HOW DOES IT WORK?
 * 1. popup.js sends a message: { action: "performScrape" }
 * 2. This file listens for that message
 * 3. It detects which job portal the user is on
 * 4. It extracts job title + description using site-specific CSS selectors
 * 5. It sends the data back to popup.js
 * ============================================================
 */


/**
 * HELPER: Detect which job portal the user is currently on.
 * We check the URL (window.location.hostname) to figure out the site.
 *
 * @returns {string} - portal name like "linkedin", "indeed", "naukri", etc.
 */
function detectPortal() {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes("linkedin.com")) return "linkedin";
  if (hostname.includes("indeed.com")) return "indeed";
  if (hostname.includes("naukri.com")) return "naukri";
  if (hostname.includes("glassdoor.com")) return "glassdoor";
  if (hostname.includes("internshala.com")) return "internshala";

  // Unknown portal — we'll try generic selectors as fallback
  return "generic";
}


/**
 * HELPER: Try multiple CSS selectors and return text from the first match.
 *
 * Why multiple selectors?
 * Because websites often update their HTML structure, so we have fallbacks.
 *
 * @param {string[]} selectors - Array of CSS selectors to try in order
 * @returns {string} - The innerText of the matched element, or empty string
 */
function trySelectors(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      // Make sure element exists AND has actual visible text
      if (element && element.innerText && element.innerText.trim().length > 20) {
        return element.innerText.trim();
      }
    } catch (e) {
      // If the CSS selector itself is invalid, skip it
      console.warn("[NeuroLearn] Invalid selector:", selector, e);
    }
  }
  return ""; // No selector matched
}


/**
 * MAIN FUNCTION: Scrape job title and description from the current page.
 *
 * Each portal has different HTML structure, so we define site-specific
 * selectors and fall back to generic ones if needed.
 *
 * @returns {{ title: string, description: string, portal: string }}
 */
function scrapeJobDescription() {

  const portal = detectPortal();
  let jobTitle = "";
  let jobDescription = "";

  // ─────────────────────────────────────────────
  // LINKEDIN Selectors
  // LinkedIn job pages look like: linkedin.com/jobs/view/123456789
  // The job title is usually in an <h1> with class "top-card-layout__title"
  // The description is inside a <div class="description__text">
  // ─────────────────────────────────────────────
  if (portal === "linkedin") {
    jobTitle = trySelectors([
      "h1.top-card-layout__title",           // LinkedIn job detail page (logged out)
      "h1.t-24.t-bold",                       // LinkedIn job page (logged in)
      ".job-details-jobs-unified-top-card__job-title h1",  // newer LinkedIn layout
      "h1"                                    // Final fallback: any h1
    ]);

    jobDescription = trySelectors([
      ".description__text",                   // Classic LinkedIn layout
      ".jobs-description__content",           // Logged-in LinkedIn layout
      ".jobs-box__html-content",              // Another variant
      ".jobs-description",                    // General description wrapper
      "[class*='description']"               // Any element with 'description' in class
    ]);
  }

  // ─────────────────────────────────────────────
  // INDEED Selectors
  // Indeed job pages: indeed.com/viewjob?jk=...
  // ─────────────────────────────────────────────
  else if (portal === "indeed") {
    jobTitle = trySelectors([
      "h1.jobsearch-JobInfoHeader-title",    // Main job title
      "h1[class*='jobTitle']",
      "h1"
    ]);

    jobDescription = trySelectors([
      "#jobDescriptionText",                 // Main description div
      ".jobsearch-jobDescriptionText",
      "[class*='jobDescription']"
    ]);
  }

  // ─────────────────────────────────────────────
  // NAUKRI Selectors
  // Naukri job pages: naukri.com/job-listings-...
  // ─────────────────────────────────────────────
  else if (portal === "naukri") {
    jobTitle = trySelectors([
      "h1.jd-header-title",
      ".jd-header h1",
      "h1[class*='title']",
      "h1"
    ]);

    jobDescription = trySelectors([
      ".job-desc",                           // Naukri job description box
      ".dang-inner-html",                    // Description HTML content
      "[class*='job-desc']",
      "[class*='description']"
    ]);
  }

  // ─────────────────────────────────────────────
  // GLASSDOOR Selectors
  // ─────────────────────────────────────────────
  else if (portal === "glassdoor") {
    jobTitle = trySelectors([
      "[data-test='job-title']",
      "h1[class*='title']",
      "h1"
    ]);

    jobDescription = trySelectors([
      "[class*='JobDetails']",
      "[data-test='jobDescriptionContent']",
      ".desc"
    ]);
  }

  // ─────────────────────────────────────────────
  // INTERNSHALA Selectors
  // ─────────────────────────────────────────────
  else if (portal === "internshala") {
    jobTitle = trySelectors([
      "h1.profile",
      ".heading_4_5.profile",
      "h1"
    ]);

    jobDescription = trySelectors([
      "#job-description",
      ".job-description-container",
      "[class*='about-internship']"
    ]);
  }

  // ─────────────────────────────────────────────
  // GENERIC Fallback (for unknown job portals)
  // These are common patterns across many job sites
  // ─────────────────────────────────────────────
  else {
    jobTitle = trySelectors([
      "h1.job-title",
      "h1[class*='title']",
      ".job-title",
      "h1"
    ]);

    jobDescription = trySelectors([
      "div[class*='job-description']",
      "div[id*='job-details']",
      "div[class*='description']",
      ".job-content",
      "article",
      "main"                                  // Very last resort: main content area
    ]);
  }

  // ─────────────────────────────────────────────
  // CLEANUP: Sometimes scraped text has too much whitespace or junk
  // We clean it up before sending
  // ─────────────────────────────────────────────

  // Remove extra spaces and trim
  jobTitle = jobTitle.replace(/\s+/g, " ").trim();
  jobDescription = jobDescription.replace(/\s+/g, " ").trim();

  // Limit description length to avoid sending huge payloads to API
  // 3000 characters is plenty for keyword extraction
  if (jobDescription.length > 3000) {
    jobDescription = jobDescription.substring(0, 3000) + "...";
  }

  // If we couldn't find a title, use a sensible default
  if (!jobTitle) {
    jobTitle = document.title || "Unknown Job";  // fallback to browser tab title
  }

  console.log("[NeuroLearn] Portal detected:", portal);
  console.log("[NeuroLearn] Job Title found:", jobTitle);
  console.log("[NeuroLearn] Description length:", jobDescription.length);

  return {
    title: jobTitle,
    description: jobDescription,
    portal: portal  // We send back the portal name too (useful for debugging)
  };
}


/**
 * ============================================================
 * MESSAGE LISTENER
 * ============================================================
 *
 * This is how the extension's popup.js communicates with this content script.
 *
 * When popup.js does: chrome.tabs.sendMessage(tabId, { action: "performScrape" })
 * → This listener receives that message
 * → Calls scrapeJobDescription()
 * → Sends back: { success: true, data: { title, description, portal } }
 *
 * The "sendResponse" callback is how we reply to the sender.
 * "return true" at the end is IMPORTANT — it tells Chrome to keep
 * the message channel open for async responses.
 * ============================================================
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Only handle our specific action — ignore other messages
  if (request.action === "performScrape") {

    try {
      const data = scrapeJobDescription();

      // Check if we actually got useful data
      if (!data.description || data.description.length < 30) {
        sendResponse({
          success: false,
          error: "Could not find job description on this page. Please make sure you're on a job detail page."
        });
      } else {
        sendResponse({ success: true, data });
      }

    } catch (error) {
      // If anything crashes, send back a clean error message
      console.error("[NeuroLearn] Scraping error:", error);
      sendResponse({ success: false, error: "An error occurred while reading the page." });
    }
  }

  return true; // Keep message channel open for async sendResponse
});