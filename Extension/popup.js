/**
 * ============================================================
 * popup.js - NeuroLearn AI Chrome Extension
 * ============================================================
 *
 * WHAT IS THIS FILE?
 * This is the "brain" of the extension popup.
 * It runs when the user clicks the extension icon in their browser.
 *
 * THE FULL FLOW (step by step):
 * ┌─────────────────────────────────────────────────────────┐
 * │  User is on LinkedIn job page                           │
 * │      ↓                                                  │
 * │  User clicks NeuroLearn extension icon                  │
 * │      ↓                                                  │
 * │  popup.js opens (this file runs)                        │
 * │      ↓                                                  │
 * │  Step 1: Inject content.js into the LinkedIn page       │
 * │      ↓                                                  │
 * │  Step 2: content.js scrapes job title + description     │
 * │      ↓                                                  │
 * │  Step 3: Send scraped data to our Next.js API           │
 * │          POST /api/curate-keywords                      │
 * │      ↓                                                  │
 * │  Step 4: API uses Gemini AI to extract skill keywords   │
 * │      ↓                                                  │
 * │  Step 5: Show keywords as clickable buttons             │
 * │      ↓                                                  │
 * │  Step 6: User clicks a keyword → redirect to NeuroLearn │
 * │          with that keyword as search query              │
 * └─────────────────────────────────────────────────────────┘
 *
 * KEY CONCEPTS FOR JAVA FRESHERS:
 * - async/await: Like waiting for a database call to finish before continuing
 * - fetch(): Makes HTTP requests (like RestTemplate in Java Spring Boot)
 * - chrome.tabs: Browser API to interact with open browser tabs
 * - chrome.scripting: API to inject JS into web pages
 * ============================================================
 */


// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// Change this URL to your deployed site when going to production
// ─────────────────────────────────────────────────────────────
const NEUROLEARN_URL = "http://localhost:3000";


/**
 * HELPER: Update the status text shown in the popup
 * @param {string} message - Text to show
 * @param {'default'|'error'|'success'} type - Controls text color
 */
function setStatus(message, type = "default") {
    const statusEl = document.getElementById("status");
    statusEl.innerText = message;
    statusEl.className = type; // CSS class changes the color
}


/**
 * HELPER: Show the portal name badge (e.g. "🔗 LinkedIn")
 * This tells the user which job site was detected
 * @param {string} portal - The detected portal name
 */
function showPortalBadge(portal) {
    const badge = document.getElementById("portalBadge");

    // Map portal name to an emoji icon
    const icons = {
        linkedin: "🔗 LinkedIn",
        indeed: "🔍 Indeed",
        naukri: "💼 Naukri",
        glassdoor: "🚪 Glassdoor",
        internshala: "🎓 Internshala",
        generic: "🌐 Job Portal"
    };

    badge.innerText = icons[portal] || "🌐 Job Portal";
    badge.style.display = "block"; // Make it visible
}


/**
 * HELPER: Display an error message in the popup
 * Clears the keyword container and shows a friendly error
 * @param {string} message - The error message to display
 */
function showError(message) {
    setStatus(message, "error");
    document.getElementById("keywordsContainer").innerHTML = "";
}


/**
 * HELPER: Create a clickable keyword button
 *
 * When clicked, it redirects the current tab to NeuroLearn
 * with the keyword as a search query: /?q=React+JS
 *
 * @param {string} keyword - The skill/technology keyword (e.g., "React JS")
 * @param {object} tab - The Chrome tab object (to update the URL)
 * @returns {HTMLButtonElement} - The created button element
 */
function createKeywordButton(keyword, tab) {
    const button = document.createElement("button");
    button.innerText = keyword;
    button.className = "keyword-button";

    button.addEventListener("click", () => {
        // Encode the keyword for use in a URL (spaces → %20, etc.)
        const encodedQuery = encodeURIComponent(keyword);

        // Build the redirect URL → NeuroLearn homepage with the search query
        const redirectUrl = `${NEUROLEARN_URL}/?q=${encodedQuery}`;

        // Update the current browser tab's URL to go to NeuroLearn
        // The user will see the NeuroLearn site search for this keyword automatically
        chrome.tabs.update(tab.id, { url: redirectUrl });
    });

    return button;
}


/**
 * ============================================================
 * MAIN FUNCTION: Runs as soon as the popup HTML is ready
 * ============================================================
 *
 * DOMContentLoaded fires when the popup.html is fully parsed.
 * It's like @PostConstruct in Spring Boot — runs after initialization.
 */
document.addEventListener("DOMContentLoaded", async () => {

    const keywordsContainer = document.getElementById("keywordsContainer");

    // ─── Step 0: Get the current active browser tab ───
    // chrome.tabs.query() returns all tabs matching the filter
    // { active: true, currentWindow: true } means "the tab the user is looking at right now"
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("[NeuroLearn Popup] Active tab:", tab?.url);

    if (!tab) {
        showError("No active tab found.");
        return;
    }

    // ─── Guard: Check if we're on a supported page ───
    // We can't inject scripts into Chrome's own pages (chrome://...) or extension pages
    const url = tab.url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
        showError("Please navigate to a job listing page (LinkedIn, Indeed, Naukri, etc.)");
        keywordsContainer.innerHTML = "";
        return;
    }


    // ─── Step 1: Inject content.js into the current job portal page ───
    //
    // Why do we need to inject it each time?
    // Because content scripts in Manifest V3 aren't always persistent.
    // Injecting ensures it's fresh and available.
    //
    // chrome.scripting.executeScript() → Runs a JS file inside the webpage
    console.log("[NeuroLearn Popup] Step 1: Injecting content.js into tab", tab.id);
    setStatus("Reading the job page...");

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]   // Injects our content.js into the current tab's page
        });
    } catch (injectionError) {
        // This happens if the page doesn't allow script injection (e.g. Google search results)
        showError("Cannot read this page. Please open a specific job detail page.");
        return;
    }


    // ─── Step 2: Send a message to content.js to perform the scrape ───
    //
    // chrome.tabs.sendMessage() → Sends a message to content scripts in that tab
    // The content.js "onMessage" listener receives this and calls scrapeJobDescription()
    //
    // Note: We use a callback pattern here because sendMessage requires it
    console.log("[NeuroLearn Popup] Step 2: Sending 'performScrape' message to content.js");
    chrome.tabs.sendMessage(tab.id, { action: "performScrape" }, async (response) => {

        // chrome.runtime.lastError catches cases where content.js didn't respond
        // (e.g. the tab navigated away, or injection failed silently)
        if (chrome.runtime.lastError) {
            showError("Could not communicate with the page. Try refreshing the job page.");
            return;
        }

        // If content.js returned a failure (e.g., couldn't find description)
        if (!response || !response.success) {
            showError(response?.error || "Could not find job description. Make sure you're on a job detail page.");
            return;
        }

        // ✅ Successfully scraped!
        const { title, description, portal } = response.data;

        console.log("[NeuroLearn Popup] ✅ Scrape successful!");
        console.log("[NeuroLearn Popup] Portal detected:", portal);
        console.log("[NeuroLearn Popup] Job Title:", title);
        console.log("[NeuroLearn Popup] Description length:", description.length, "chars");
        console.log("[NeuroLearn Popup] Description preview:", description.substring(0, 200) + "...");

        // Show which portal was detected (LinkedIn / Indeed / etc.)
        showPortalBadge(portal);


        // ─── Step 3: Send scraped data to our Next.js API ───
        //
        // Our API endpoint: POST /api/curate-keywords
        // It uses Google Gemini AI to extract the top skill keywords from the job description
        //
        // This is like calling a Spring Boot REST API from a frontend using fetch()
        console.log("[NeuroLearn Popup] Step 3: Calling API →", `${NEUROLEARN_URL}/api/curate-keywords`);
        setStatus("AI is analyzing the job requirements...");
        keywordsContainer.innerHTML = '<div class="loading-animation"></div>';

        try {
            const apiResponse = await fetch(`${NEUROLEARN_URL}/api/curate-keywords`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"  // Tell the server we're sending JSON
                },
                body: JSON.stringify({
                    jobTitle: title,
                    jobDescription: description
                })
                // We don't include 'credentials' here because the API endpoint is public
            });

            // Parse the JSON response from our Next.js API
            const curatedData = await apiResponse.json();
            console.log("[NeuroLearn Popup] Step 4: API response status:", apiResponse.status);
            console.log("[NeuroLearn Popup] API response data:", JSON.stringify(curatedData, null, 2));

            // Check if API responded successfully and returned keywords
            if (!apiResponse.ok || !curatedData.keywords) {
                console.error("[NeuroLearn Popup] ❌ API returned error:", curatedData.error);
                showError(`API Error: ${curatedData.error || "Failed to extract keywords. Please try again."}`);
                return;
            }


            // ─── Step 4: Display the keyword buttons ───
            //
            // curatedData.keywords is an array like: ["React JS", "Node.js", "MongoDB", ...]
            // We create a button for each keyword

            keywordsContainer.innerHTML = ""; // Clear the loading spinner

            if (curatedData.keywords.length === 0) {
                showError("No relevant keywords found. The job description may be too short.");
                return;
            }

            // Show success status with the job title
            setStatus(`✅ "${curatedData.title || title}" — Click a skill to learn!`, "success");

            // ─── LOG: Print all extracted keywords ───
            console.log("[NeuroLearn Popup] ═══════════════════════════════════════");
            console.log("[NeuroLearn Popup] 🎯 EXTRACTED KEYWORDS FROM JOB PORTAL:");
            console.log("[NeuroLearn Popup] Job Title:", curatedData.title || title);
            console.log("[NeuroLearn Popup] Portal:", portal);
            console.log("[NeuroLearn Popup] Keywords found:", curatedData.keywords.length);
            curatedData.keywords.forEach((keyword, index) => {
                console.log(`[NeuroLearn Popup]   ${index + 1}. ${keyword}`);
            });
            console.log("[NeuroLearn Popup] ═══════════════════════════════════════");

            // Create a button for each AI-extracted keyword
            curatedData.keywords.forEach(keyword => {
                const button = createKeywordButton(keyword, tab);
                keywordsContainer.appendChild(button);
            });

            // ─── Optional: Save to chrome.storage for history ───
            // This lets us show "Recently analyzed jobs" in future versions
            chrome.storage.local.set({
                lastJob: {
                    title: curatedData.title || title,
                    keywords: curatedData.keywords,
                    portal: portal,
                    analyzedAt: new Date().toISOString()
                }
            });

        } catch (networkError) {
            // This catches fetch() failures — e.g., server is down or CORS error
            console.error("[NeuroLearn] API call failed:", networkError);
            showError(
                `Cannot connect to NeuroLearn server.\n` +
                `Make sure the app is running at: ${NEUROLEARN_URL}`
            );
        }
    }); // End of chrome.tabs.sendMessage callback

}); // End of DOMContentLoaded