// The Auth0 client, initialized in configureClient()
let auth0Client = null;

/**
 * Starts the authentication flow
 */
const login = async (targetUrl) => {
  try {
    console.log("Logging in", targetUrl);

    const options = {
      authorizationParams: {
        redirect_uri: window.location.origin
      }
    };

    if (targetUrl) {
      options.appState = { targetUrl };
    }

    await auth0Client.loginWithRedirect(options);
  } catch (err) {
    console.log("Log in failed", err);
  }
};

/**
 * Executes the logout flow
 */
const logout = async () => {
  try {
    console.log("Logging out");
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  } catch (err) {
    console.log("Log out failed", err);
  }
};

/**
 * Retrieves the auth configuration from the server
 */
const fetchAuthConfig = () => fetch("/auth_config.json");

/**
 * Initializes the Auth0 client
 */
const configureClient = async () => {
  const response = await fetchAuthConfig();
  const config = await response.json();

  auth0Client = await auth0.createAuth0Client({
    domain: config.domain,
    clientId: config.clientId,
    authorizationParams: {
      audience: config.audience
    }
  });
};

/**
 * Checks to see if the user is authenticated. If so, `fn` is executed. Otherwise, the user
 * is prompted to log in
 * @param {*} fn The function to execute if the user is logged in
 */
const requireAuth = async (fn, targetUrl) => {
  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    return fn();
  }

  return login(targetUrl);
};

/**
 * Calls the API endpoint with an authorization token
 */
const callApi = async () => {
  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch("/api/external", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const responseData = await response.json();

    const responseElement = document.getElementById("api-call-result");

    responseElement.innerText = JSON.stringify(responseData, {}, 2);

    document.querySelectorAll("pre code").forEach(hljs.highlightBlock);

    eachElement(".result-block", (c) => c.classList.add("show"));
  } catch (e) {
    console.error(e);
  }
};

/**
 * Updates the user metadata by calling the update API endpoint
 */
const updateUserMetadata = async (event) => {
  event.preventDefault();

  const lastPizzaType = document.getElementById("lastPizzaType").value;
  const lastPizzaSize = document.getElementById("lastPizzaSize").value;

  if (!lastPizzaType || !lastPizzaSize) {
    alert("Please fill in both fields.");
    return;
  }

  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch("/api/update-metadata", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sub: (await auth0Client.getUser()).sub,
        lastPizzaType,
        lastPizzaSize
      })
    });

    const responseData = await response.json();
    const resultElement = document.getElementById("update-metadata-result");

    resultElement.innerText = responseData.msg;
  } catch (e) {
    console.error("Error updating metadata:", e);
  }
};

/**
 * Checks form validity to enable/disable the submit button
 */
const checkFormValidity = () => {
  const lastPizzaType = document.getElementById("lastPizzaType").value;
  const lastPizzaSize = document.getElementById("lastPizzaSize").value;
  const submitBtn = document.getElementById("submitBtn");

  if (lastPizzaType !== "" && lastPizzaSize !== "") {
    submitBtn.disabled = false;
  } else {
    submitBtn.disabled = true;
  }
};

// Will run when page finishes loading
window.onload = async () => {
  await configureClient();

  // If unable to parse the history hash, default to the root URL
  if (!showContentFromUrl(window.location.pathname)) {
    showContentFromUrl("/");
    window.history.replaceState({ url: "/" }, {}, "/");
  }

  const bodyElement = document.getElementsByTagName("body")[0];

  // Listen out for clicks on any hyperlink that navigates to a #/ URL
  bodyElement.addEventListener("click", (e) => {
    if (isRouteLink(e.target)) {
      const url = e.target.getAttribute("href");

      if (showContentFromUrl(url)) {
        e.preventDefault();
        window.history.pushState({ url }, {}, url);
      }
    } else if (e.target.getAttribute("id") === "call-api") {
      e.preventDefault();
      callApi();
    }
  });

  // Listen for form submission
  const updateMetadataForm = document.getElementById("update-metadata-form");
  if (updateMetadataForm) {
    updateMetadataForm.addEventListener("submit", updateUserMetadata);
  }

  // Listen for changes in dropdowns to validate the form
  const lastPizzaType = document.getElementById("lastPizzaType");
  const lastPizzaSize = document.getElementById("lastPizzaSize");

  if (lastPizzaType && lastPizzaSize) {
    lastPizzaType.addEventListener("change", checkFormValidity);
    lastPizzaSize.addEventListener("change", checkFormValidity);
  }

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    console.log("> User is authenticated");
    window.history.replaceState({}, document.title, window.location.pathname);
    document.getElementById("content-forms").classList.remove("hidden"); // Show the forms when authenticated
    updateUI();
    return;
  }

  console.log("> User not authenticated");

  const query = window.location.search;
  const shouldParseResult = query.includes("code=") && query.includes("state=");

  if (shouldParseResult) {
    console.log("> Parsing redirect");
    try {
      const result = await auth0Client.handleRedirectCallback();

      if (result.appState && result.appState.targetUrl) {
        showContentFromUrl(result.appState.targetUrl);
      }

      console.log("Logged in!");
      document.getElementById("content-forms").classList.remove("hidden"); // Show the forms when authenticated
    } catch (err) {
      console.log("Error parsing redirect:", err);
    }

    window.history.replaceState({}, document.title, "/");
  }

  updateUI();
};

// Add event listener for "Send Verification Email" button
document.getElementById('sendVerificationEmailBtn').addEventListener('click', async () => {
  try {
    const token = await auth0Client.getTokenSilently();
    const user = await auth0Client.getUser();
    const response = await fetch('/send-verification-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ user_id: user.sub })
    });

    if (response.ok) {
      document.getElementById('verification-email-result').innerText = 'Email on Its Way. Please Confirm.';
    } else {
      document.getElementById('verification-email-result').innerText = 'Error sending verification email';
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
    document.getElementById('verification-email-result').innerText = 'Error sending verification email';
  }
});
