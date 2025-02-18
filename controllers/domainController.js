const axios = require("axios");
const fs = require("fs");
const path = require("path");


exports.checkDomainStatus = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'No URL provided. Please include a "url" field in the request body.',
    });
  }

  try {
    const response = await axios.post(url);

    if ([400, 301, 403].includes(response.status)) {
      console.log(`[!] Domain ${url} is down (Status: ${response.status}).`);
      return res.status(200).json({
        success: true,
        message: `Domain ${url} is down. Status: ${response.status}`,
        status: response.status,
        switchRequired: true,
      });
    }

    console.log(`[+] Domain ${url} is working fine.`);
    return res.status(200).json({
      success: true,
      message: `Domain ${url} is working fine.`,
      status: response.status,
      switchRequired: false,
    });
  } catch (error) {
    // Handle unreachable domains
    console.log(`[!] Domain ${url} is unreachable.`);
    return res.status(500).json({
      success: false,
      message: `Domain ${url} is unreachable.`,
      switchRequired: true,
      error: error.message,
    });
  }
};

exports.registerNewDomain = async (req, res) => {
  const { DOMAIN_PREFIX, TLD, NAMECHEAP_API_URL, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, CLIENT_IP } = process.env;

  if (!DOMAIN_PREFIX || !TLD || !NAMECHEAP_API_URL || !NAMECHEAP_API_USER || !NAMECHEAP_API_KEY || !NAMECHEAP_USERNAME || !CLIENT_IP) {
    return res.status(500).json({ message: 'Missing required environment variables' });
  }

  const newDomain = `${DOMAIN_PREFIX}${Date.now()}.${TLD}`;
  console.log(`[+] Registering new domain: ${newDomain}`);

  const url = `${NAMECHEAP_API_URL}?ApiUser=${NAMECHEAP_API_USER}&ApiKey=${NAMECHEAP_API_KEY}&UserName=${NAMECHEAP_USERNAME}&Command=namecheap.domains.create&ClientIp=${CLIENT_IP}&DomainName=${newDomain}`;

  try {
    const response = await axios.get(url);
    const responseText = response.data;
    if (responseText.includes('Status="OK"')) {
      console.log(`[+] Successfully registered domain: ${newDomain}`);
      return res.status(200).json({
        message: 'Domain registered successfully',
        domain: newDomain,
      });
    } else {
      console.log(`[!] Failed to register domain: ${newDomain}`);
      return res.status(400).json({
        message: 'Failed to register domain. Please try again.',
      });
    }
  } catch (error) {
    console.error(`[!] Error while registering domain: ${error.message}`);
    return res.status(500).json({
      message: 'An error occurred while registering the domain',
      error: error.message,
    });
  }
};



exports.switchDomain = async (req, res) => {
  try {
    // Register a new domain
    const newDomain = `yourwebsite${Date.now()}.com`;
    // Update Cloudflare DNS
    // Add new domain to cPanel
    // Log the activity
    const logFile = path.join(__dirname, "../logs/domainSwitch.log");
    fs.appendFileSync(logFile, `[${new Date()}] Switched to ${newDomain}\n`);

    res.status(200).json({ success: true, newDomain });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
