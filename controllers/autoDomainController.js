const { exec } = require('child_process');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SERVER_IP = process.env.SERVER_IP;
const CURRENT_DOMAIN = JSON.parse(process.env.CURRENT_DOMAIN);
const DOMAIN_PREFIX = JSON.parse(process.env.DOMAIN_PREFIX);
const TLD = JSON.parse(process.env.TLD);
const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER;
const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY;
const NAMECHEAP_USERNAME = process.env.NAMECHEAP_USERNAME;
const CLIENT_IP = process.env.CLIENT_IP;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CPANEL_USER = process.env.CPANEL_USER;
const CPANEL_PASSWORD = process.env.CPANEL_PASSWORD;
const CPANEL_API_URL = process.env.CPANEL_API_URL;
const NAMECHEAP_API_URL = process.env.NAMECHEAP_API_URL;

const cloudflareAxios = axios.create({
  baseURL: `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}`,
  headers: {
    Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const cpanelAxios = axios.create({
  baseURL: CPANEL_API_URL,
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${CPANEL_USER}:${CPANEL_PASSWORD}`).toString('base64')
  }
});

async function checkDomainStatus() {
  console.log("[START] Checking domain status...");
  for (const domain of CURRENT_DOMAIN) {
    try {
      const response = await axios.get(`http://${domain}`);
      if ([400, 301, 403].includes(response.status)) {
        console.log(`[!] Domain ${domain} is down (Status: ${response.status}). Initiating switch...`);
        console.log("[END] Domain check - issue detected.");
        return true;
      }
      console.log(`[+] Domain ${domain} is working fine.`);
    } catch (error) {
      console.log(`[!] Domain ${domain} is unreachable. Initiating switch...`);
      console.log("[END] Domain check - issue detected.");
      return true;
    }
  }
  console.log("[END] All domains is working fine.");
  return false;
}

async function registerNewDomain() {
  console.log("[START] Registering new domain...");
  const newDomain = `${DOMAIN_PREFIX[0]}${Date.now()}.${TLD[0]}`;
  console.log(`[+] Attempting to register: ${newDomain}`);

  const url = `${NAMECHEAP_API_URL}?ApiUser=${NAMECHEAP_API_USER}&ApiKey=${NAMECHEAP_API_KEY}&UserName=${NAMECHEAP_USERNAME}&Command=namecheap.domains.create&ClientIp=${CLIENT_IP}&DomainName=${newDomain}`;
  try {
    const response = await axios.get(url);
    const text = response.data;
    if (text.includes('Status="OK"')) {
      console.log(`[+] Successfully registered domain: ${newDomain}`);
      console.log("[END] Domain registration successful.");
      return newDomain;
    }
  } catch (error) {
    console.log("[!] Failed to register new domain.", error);
  }
  console.log("[END] Domain registration failed.");
  return null;
}

async function updateCloudflareDNS(newDomain) {
  console.log("[START] Updating Cloudflare DNS...");
  try {
    const response = await cloudflareAxios.post('/dns_records', {
      type: 'A',
      name: newDomain,
      content: SERVER_IP,
      ttl: 1,
      proxied: false
    });
    if (response.data.success) {
      console.log(`[+] DNS updated for ${newDomain} in Cloudflare.`);
    } else {
      console.log("[!] Failed to update DNS in Cloudflare.", response.data);
    }
  } catch (error) {
    console.log("[!] Error updating DNS in Cloudflare.", error);
  }
  console.log("[END] Cloudflare DNS update complete.");
}

async function updateCpanel(newDomain) {
  console.log("[START] Updating cPanel...");
  try {
    if (response.data.status === 'success') {
      console.log(`[+] cPanel updated with new domain: ${newDomain}`);
    } else {
      console.log("[!] Failed to update cPanel.", response.data);
    }
  } catch (error) {
    console.log("[!] Error updating cPanel.", error);
  }
  console.log("[END] cPanel update complete.");
}


function restartWebServer() {
  console.log("[START] Restarting web server...");
  exec('sudo systemctl restart nginx', (error, stdout, stderr) => {
    if (error) {
      console.log(`[!] Failed to restart web server: ${stderr}`);
    } else {
      console.log(`[+] Web server restarted successfully.`);
    }
    console.log("[END] Web server restart process.");
  });
}


function sendEmailNotification(newDomain) {
  console.log("[START] Sending email notification...");
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: ADMIN_EMAIL,
    subject: 'Domain Switch Notification',
    text: `The domain has been switched to: ${newDomain}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(`[!] Failed to send email notification: ${error}`);
    } else {
      console.log(`[+] Email notification sent: ${info.response}`);
    }
    console.log("[END] Email notification process.");
  });
}

async function switchDomainIfNeeded() {
  const isDown = await checkDomainStatus();
  if (isDown) {
    const newDomain = await registerNewDomain();
    if (newDomain) {
      await updateCloudflareDNS(newDomain);
      await updateCpanel(newDomain);
      restartWebServer();
      sendEmailNotification(newDomain);
      console.log(`[+] Successfully switched to ${newDomain}`);
    }
  }
}

module.exports = {
  switchDomainIfNeeded
};
