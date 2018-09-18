'use strict';

const fse = require('fs-extra');
const os = require('os');
const crypto = require('crypto');
const path = require('path');

const replaceTextInFile = (filePath, subString, newSubString) => {
  const fileContent = fse.readFileSync(filePath).toString();
  fse.writeFileSync(filePath, fileContent.replace(subString, newSubString));
};

const getTmpDirPath = () => path.join(os.tmpdir(),
  'tmpdirs-serverless-vault-plugin',
  'serverless-vault-plugin',
  crypto.randomBytes(8).toString('hex'));


function setEnv(serverless, funcName) {
  const serviceVars = serverless.service.provider.environment || {};
  let functionVars = {};
  if (funcName && serverless.service.functions[funcName]) {
    functionVars = serverless.service.functions[funcName].environment || {};
  }
  return Object.assign(
    process.env,
    serviceVars,
    functionVars
  );
}



module.exports = {
  replaceTextInFile,
  getTmpDirPath,
  setEnv,
};
