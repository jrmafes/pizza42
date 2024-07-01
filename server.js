const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const axios = require("axios");
const { auth } = require("express-oauth2-jwt-bearer");
const { join } = require("path");
const authConfig = require("./auth_config.json");

const app = express();
const PORT = process.env.PORT || 3001; // Define the PORT variable

if (!authConfig.domain || !authConfig.audience || !authConfig.m2mClientId || !authConfig.m2mClientSecret) {
  throw "Please make sure that auth_config.json is in place and populated";
}

app.use(morgan("dev"));
app.use(helmet());
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}`,
});

app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

// Endpoint to fetch user profile
app.get("/api/user-profile", checkJwt, async (req, res) => {
  try {
    const tokenResponse = await axios.post(`https://${authConfig.domain}/oauth/token`, {
      client_id: authConfig.m2mClientId,
      client_secret: authConfig.m2mClientSecret,
      audience: `https://${authConfig.domain}/api/v2/`,
      grant_type: 'client_credentials'
    });

    const managementToken = tokenResponse.data.access_token;
    const userId = req.auth.payload.sub;

    const userResponse = await axios.get(`https://${authConfig.domain}/api/v2/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${managementToken}`
      }
    });

    res.json(userResponse.data);
  } catch (err) {
    console.error('Error fetching user profile', err.response ? err.response.data : err.message, err.stack);
    res.status(500).send({ msg: "Error fetching user profile", error: err.response ? err.response.data : err.message });
  }
});

// Endpoint to update user metadata
app.post("/api/update-metadata", checkJwt, async (req, res) => {
  const { sub, lastPizzaType, lastPizzaSize } = req.body;

  if (!sub || !lastPizzaType || !lastPizzaSize) {
    console.error('Missing required fields', req.body);
    return res.status(400).send({ msg: "Missing required fields" });
  }

  try {
    const tokenResponse = await axios.post(`https://${authConfig.domain}/oauth/token`, {
      client_id: authConfig.m2mClientId,
      client_secret: authConfig.m2mClientSecret,
      audience: `https://${authConfig.domain}/api/v2/`,
      grant_type: 'client_credentials'
    });

    const managementToken = tokenResponse.data.access_token;

    await axios.patch(`https://${authConfig.domain}/api/v2/users/${sub}`, {
      user_metadata: {
        lastPizzaType: lastPizzaType,
        lastPizzaSize: lastPizzaSize
      }
    }, {
      headers: {
        Authorization: `Bearer ${managementToken}`
      }
    });

    res.send({ msg: "Order Details Updated, You're All Set!" });
  } catch (err) {
    console.error('Error details:', err.response ? err.response.data : err.message, err.stack);
    res.status(500).send({ msg: "Error updating user metadata", error: err.response ? err.response.data : err.message });
  }
});

// Endpoint to send verification email
app.post('/send-verification-email', checkJwt, async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    console.error('Missing user_id in request body', req.body);
    return res.status(400).send({ msg: "Missing user_id" });
  }

  try {
    const tokenResponse = await axios.post(`https://${authConfig.domain}/oauth/token`, {
      client_id: authConfig.m2mClientId,
      client_secret: authConfig.m2mClientSecret,
      audience: `https://${authConfig.domain}/api/v2/`,
      grant_type: 'client_credentials'
    });

    const managementToken = tokenResponse.data.access_token;

    await axios.post(`https://${authConfig.domain}/api/v2/jobs/verification-email`, {
      user_id: user_id,
      client_id: authConfig.m2mClientId
    }, {
      headers: {
        Authorization: `Bearer ${managementToken}`
      }
    });

    res.status(200).send('Verification email sent successfully');
  } catch (err) {
    console.error('Error sending verification email:', err.response ? err.response.data : err.message, err.stack);
    res.status(500).send({ msg: "Error sending verification email", error: err.response ? err.response.data : err.message });
  }
});

app.get("/auth_config.json", (req, res) => {
  res.sendFile(join(__dirname, "auth_config.json"));
});

app.get("/*", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.use(function(err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    return res.status(401).send({ msg: "Invalid token" });
  }

  next(err, req, res);
});

process.on("SIGINT", function() {
  process.exit();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
