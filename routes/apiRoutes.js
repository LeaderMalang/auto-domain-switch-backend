const express = require("express");
const { checkDomainStatus, switchDomain, registerNewDomain } = require("../controllers/domainController");


const apiRoutes = express.Router();

apiRoutes.post("/check-domain-status", checkDomainStatus);
apiRoutes.post("/register-new-domain", registerNewDomain);
apiRoutes.post("/switch", switchDomain);

module.exports = apiRoutes;