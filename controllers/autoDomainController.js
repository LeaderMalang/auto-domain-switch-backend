const axios = require("axios");
const dotenv = require("dotenv");
const xml2js = require("xml2js");
const parser = new xml2js.Parser();
const nodemailer = require("nodemailer");
const { exec } = require("child_process");
dotenv.config();

const CLIENT_IP = process.env.CLIENT_IP;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const NAMECHEAP_API_URL = process.env.NAMECHEAP_API_URL;
const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY;
const NAMECHEAP_USERNAME = process.env.NAMECHEAP_USERNAME;
const CURRENT_DOMAIN = JSON.parse(process.env.CURRENT_DOMAIN.replace(/([a-zA-Z0-9.-]+)/g, '"$1"'));
const API_KEY = process.env.SAFE_BROWSING_API_KEY;
const SAFE_BROWSING_URL = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;

async function fetchDomainList() {
  console.log("[START] Fetching registered domains...");
  const url = `${NAMECHEAP_API_URL}?ApiUser=${NAMECHEAP_USERNAME}&ApiKey=${NAMECHEAP_API_KEY}&UserName=${NAMECHEAP_USERNAME}&ClientIp=${CLIENT_IP}&Command=namecheap.domains.getList`;
  try {
    const response = await axios.get(url);
    const result = await parser.parseStringPromise(response.data);

    if (result.ApiResponse.Errors && result.ApiResponse.Errors[0].Error) {
      console.log(
        `[!] Error fetching domain list: ${result.ApiResponse.Errors[0].Error[0]._}`
      );
      return [];
    }

    const domains =
      result.ApiResponse.CommandResponse[0].DomainGetListResult[0].Domain.map(
        (domain) => domain.$.Name
      );

    console.log(`[+] Registered domains: ${domains.join(", ")}`);
    return domains;
  } catch (error) {
    console.error(`[!] Error fetching domain list: ${error.message}`);
    return [];
  }
}

async function checkDomainStatus() {
  console.log("[START] Checking domain status...");

  let issuesDetected = false;

  for (const domain of CURRENT_DOMAIN) {
    console.log(`\n[CHECKING] Domain: ${domain}`);

    try {
      const safeBrowsingResponse = await axios.post(SAFE_BROWSING_URL, {
        client: {
          clientId: "eminent-wording-451317-c8",
          clientVersion: "1.0",
        },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: `http://${domain}` }],
        },
      });

      if (
        safeBrowsingResponse.data.matches &&
        safeBrowsingResponse.data.matches.length > 0
      ) {
        console.log(
          `[!] Domain ${domain} is flagged as dangerous by Google Safe Browsing.`
        );
        const threats = safeBrowsingResponse.data.matches.map(
          (match) =>
            `Type: ${match.threatType}, Platform: ${match.platformType}, URL: ${match.threat.url}`
        );
        console.log("Threats detected:\n", threats.join("\n"));
        issuesDetected = true;
        continue;
      } else {
        console.log(
          `[+] Domain ${domain} is safe according to Google Safe Browsing.`
        );
      }

      try {
        const response = await axios.get(`http://${domain}`, { timeout: 5000 });
        if ([400, 301, 403].includes(response.status)) {
          console.log(
            `[!] Domain ${domain} is down (Status: ${response.status}).`
          );
          issuesDetected = true;
        } else {
          console.log(`[+] Domain ${domain} is reachable and working fine.`);
        }
      } catch (reachabilityError) {
        console.log(
          `[!] Domain ${domain} is unreachable. Network error or no response.`
        );
        issuesDetected = true;
      }
    } catch (error) {
      if (error.response) {
        console.log(
          `[!] Error with domain ${domain}: Status ${error.response.status}.`
        );
      } else if (error.request) {
        console.log(`[!] Error with domain ${domain}: No response received.`);
      } else {
        console.log(
          `[!] General error with domain ${domain}: ${error.message}`
        );
      }
      issuesDetected = true;
    }
  }

  if (issuesDetected) {
    console.log("\n[END] One or more domains have issues.", issuesDetected);
  } else {
    console.log("\n[END] All domains are safe and reachable.");
  }

  return issuesDetected;
}

async function setCustomDNS(domain) {
  console.log(`[START] Setting custom DNS for ${domain}`);
  const [SLD, TLD] = domain.split(".");

  const nameservers = encodeURIComponent("dns1.namecheaphosting.com","dns2.namecheaphosting.com");

  const url = `${NAMECHEAP_API_URL}/xml.response?ApiUser=${NAMECHEAP_USERNAME}&ApiKey=${NAMECHEAP_API_KEY}&UserName=${NAMECHEAP_USERNAME}&ClientIp=${CLIENT_IP}&Command=namecheap.domains.dns.setCustom&SLD=${SLD}&TLD=${TLD}&Nameservers=${nameservers}`;

  try {
    const response = await axios.get(url);

    const result = await parser.parseStringPromise(response.data);

    if (result.ApiResponse.Errors && result.ApiResponse.Errors[0].Error) {
      console.log(
        `[!] Error setting DNS for ${domain}: ${result.ApiResponse.Errors[0].Error[0]._}`
      );
      return false;
    }

    console.log(`[+] Custom DNS set for ${domain}`);
    return true;
  } catch (error) {
    console.error(`[!] DNS set error for ${domain}: ${error.message}`);
    return false;
  }
}

function restartWebServer() {
  console.log("[START] Restarting web server...");
  const command =
    process.platform === "win32" ? "iisreset" : "sudo systemctl restart nginx";
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`[!] Web server restart failed: ${stderr}`);
    } else {
      console.log(`[+] Web server restarted successfully.`);
    }
  });
}

function sendEmailNotification(domain) {
  console.log("[START] Sending email notification...");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: ADMIN_EMAIL,
    subject: "Domain Update Notification",
    text: `The domain has been updated: ${domain}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(`[!] Email notification failed: ${error}`);
    } else {
      console.log(`[+] Email notification sent: ${info.response}`);
    }
  });
}

async function switchDomainIfNeeded() {
  const issuesDetected = await checkDomainStatus();
  if (issuesDetected) {
    const domains = await fetchDomainList();
    for (const domain of domains) {
      if (await checkDomainStatus(domain)) {
        console.log(`[+] Switching to domain: ${domain}`);
        if (await setCustomDNS(domain)) {
          restartWebServer();
          sendEmailNotification(domain);
          break;
        }
      }
    }
  }
}

module.exports = {
  switchDomainIfNeeded,
};
