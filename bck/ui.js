// URL mapping, from hash to a function that responds to that URL action
const router = {
  "/": () => {
    showContent("content-home");
    updateUI(); // Ensure UI updates when navigating to Home
  },
  "/login": () => login(),
  "/profile": () =>
    requireAuth(async () => {
      showContent("content-profile");
      await fetchUserProfile(); // Fetch and update profile information
    }, "/profile"),
  "/external-api": () =>
    requireAuth(async () => {
      showContent("content-external-api");
      await fetchUserProfile(); // Fetch and update profile information
    }, "/external-api"),
  "/login": () => login()
};

// Declare helper functions

/**
 * Iterates over the elements matching 'selector' and passes them
 * to 'fn'
 * @param {*} selector The CSS selector to find
 * @param {*} fn The function to execute for every element
 */
const eachElement = (selector, fn) => {
  for (let e of document.querySelectorAll(selector)) {
    fn(e);
  }
};

/**
 * Tries to display a content panel that is referenced
 * by the specified route URL. These are matched using the
 * router, defined above.
 * @param {*} url The route URL
 */
const showContentFromUrl = (url) => {
  if (router[url]) {
    router[url]();
    return true;
  }

  return false;
};

/**
 * Returns true if `element` is a hyperlink that can be considered a link to another SPA route
 * @param {*} element The element to check
 */
const isRouteLink = (element) =>
  element.tagName === "A" && element.classList.contains("route-link");

/**
 * Displays a content panel specified by the given element id.
 * All the panels that participate in this flow should have the 'page' class applied,
 * so that it can be correctly hidden before the requested content is shown.
 * @param {*} id The id of the content to show
 */
const showContent = (id) => {
  eachElement(".reset-on-nav", (e) => e.classList.remove("show"));
  eachElement(".page", (p) => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  // If navigating to Home, ensure form visibility for authenticated users
  if (id === "content-home") {
    auth0Client.isAuthenticated().then(isAuthenticated => {
      if (isAuthenticated) {
        document.getElementById("content-forms").classList.remove("hidden");
      } else {
        document.getElementById("content-forms").classList.add("hidden");
      }
    });
  } else {
    document.getElementById("content-forms").classList.add("hidden");
  }
};

/**
 * Updates the user interface
 */
const updateUI = async () => {
  try {
    const isAuthenticated = await auth0Client.isAuthenticated();
    const fireUpOvenBtn = document.getElementById('submitBtn');
    const sendVerificationEmailBtn = document.getElementById('sendVerificationEmailBtn');

    if (isAuthenticated) {
      const user = await auth0Client.getUser();
      console.log("User data: ", user);

      document.getElementById("profile-data").innerText = JSON.stringify(
        user,
        null,
        2
      );

      document.querySelectorAll("pre code").forEach(hljs.highlightBlock);

      eachElement(".profile-image", (e) => (e.src = user.picture));
      eachElement(".user-name", (e) => (e.innerText = user.name));
      eachElement(".user-email", (e) => (e.innerText = user.email));
      eachElement(".auth-invisible", (e) => e.classList.add("hidden"));
      eachElement(".auth-visible", (e) => e.classList.remove("hidden"));

      // Always set the form fields to -Select- by default
      document.getElementById("lastPizzaType").value = "";
      document.getElementById("lastPizzaSize").value = "";

      // Check if email is verified
      const isEmailVerified = user.email_verified;
      console.log("Is email verified: ", isEmailVerified);

      // Show or hide the "Fire Up the Oven" button based on email verification status
      if (isEmailVerified) {
        console.log("Showing the button");
        fireUpOvenBtn.style.display = "block";
        sendVerificationEmailBtn.style.display = "none";
      } else {
        console.log("Hiding the button");
        fireUpOvenBtn.style.display = "none";
        sendVerificationEmailBtn.style.display = "block";
      }

    } else {
      eachElement(".auth-invisible", (e) => e.classList.remove("hidden"));
      eachElement(".auth-visible", (e) => e.classList.add("hidden"));
      console.log("User is not authenticated. Hiding the buttons.");
      fireUpOvenBtn.style.display = "none";
      sendVerificationEmailBtn.style.display = "none";
    }
  } catch (err) {
    console.log("Error updating UI!", err);
    return;
  }

  console.log("UI updated");
};

/**
 * Fetches and updates the user profile information
 */
const fetchUserProfile = async () => {
  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch("/api/user-profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const user = await response.json();
    console.log("Fetched user profile data: ", user);

    document.getElementById("profile-data").innerText = JSON.stringify(
      user,
      null,
      2
    );

    document.querySelectorAll("pre code").forEach(hljs.highlightBlock);

    eachElement(".profile-image", (e) => (e.src = user.picture));
    eachElement(".user-name", (e) => (e.innerText = user.name));
    eachElement(".user-email", (e) => (e.innerText = user.email));
  } catch (err) {
    console.log("Error fetching user profile!", err);
  }
};

window.onpopstate = (e) => {
  if (e.state && e.state.url && router[e.state.url]) {
    showContentFromUrl(e.state.url);
  }
};
