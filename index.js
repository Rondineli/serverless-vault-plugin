'use strict';

const request = require('request');
const aws = require('aws-sdk');

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      vault: {
        usage: 'It will get your secrets from vault and upload secretly to kms',
        lifecycleEvents: [
          'vault',
        ],
        options: {},
      },
    };

    this.hooks = {
      'before:package:initialize': this.getVaultSecrets.bind(this),
      'before:vault:vault': this.getVaultSecrets.bind(this), // Shows encrypted passwords from vault and kms
    };
    this.kms = new aws.KMS({region: this.options.region});

  }

  /**
   * @param {*} variableKey 
   * @param {*} variableValue 
   * @returns {Promise}
   */
  kmsEncryptVariable(variableKey, variableValue) {
    return new Promise((resolve, reject) => {
      const params = {
        KeyId: this.serverless.service.custom.kms.keyId,
        Plaintext: Buffer.from(String(variableValue))
      };

      this.kms.encrypt(params, (err, data) => {
        if (err) {
          reject(err);

        } else {
          resolve(data);
        }
      });
    }).then(data => {
      return {
        'key': variableKey,
        'value': data
      };
    });
  }

  /**
   * @private
   * @returns {Promise}
   */
  requestLoginToken() {
    const  myOptions = {
      url : this.serverless.service.custom.vault.url + '/v1/auth/userpass/login/' + this.serverless.service.custom.vault.user,
      method: 'POST',
      headers: {
        'Content-Type':'application/json'
      },
      json: {
        'password': this.serverless.service.custom.vault.password
      },
      strictSSL: !!this.serverless.service.custom.vault.ssl_check
    };

    return new Promise((resolve, reject) => {
      request.post(myOptions, (error, response = {}, body) => {
        if (!error && typeof response.statusCode !== 'undefined' && response.statusCode == 200) {
          resolve(body);
        } else {
          this.serverless.cli.log('Error to authenticate on Vault: ' + error + ' StatusCode: ' + response.statusCode);
          reject(error);
        }
      });
    }).then(data => {
      return data;
    });
  }

  /**
   * @private
   * @returns {Promise}
   */
  getSingleSecrets(token, ignoreVars) {
    if (token) {
      this.serverless.service.custom.vault.token = token;
    }

    const myOptions = {
      url: this.serverless.service.custom.vault.url + '/v1/' + this.serverless.service.custom.vault.secret,
      method: 'GET',
      headers: {
        'X-Vault-Token': this.serverless.service.custom.vault.token,
        'Content-Type':'application/json',
      },
      strictSSL: this.serverless.service.custom.vault.ssl_check || false
    };

    return new Promise((resolve, reject) => {
      request.get(myOptions, (error, response = {}, body) => {
        const arrayData = [];
        if (!error && typeof response.statusCode !== 'undefined' && response.statusCode == 200){
          const data = JSON.parse(body);
          const keysToVault = this.serverless.service.provider.environment;

          this.serverless.service.provider.environment = [];
  
          for (let key in keysToVault) {
            if (data.data[keysToVault[key]]) {
              arrayData.push(
                this.kmsEncryptVariable(
                  keysToVault[key],
                  data.data[keysToVault[key]]
                )
              );
            } else  {
              this.serverless.cli.log('Key ' + key + 'var not found on vault to be encrypted by kms');
            }
          }
          Promise.all(arrayData).then((result) => {
            this.serverless.service.provider.environment = {};

            for (let rst in result) {
              const key = result[rst]['key'].toString();
              const value = result[rst]['value'].CiphertextBlob.toString('base64');

              this.serverless.service.provider.environment[key] = value;
            }
            for (let ignore in ignoreVars.ignore) {
              this.serverless.service.provider.environment[Object.keys(ignoreVars.ignore[ignore])[0]] = Object.values(ignoreVars.ignore[ignore])[0]
            }
            console.log(this.serverless.service.provider.environment);
            resolve(this);
          });

        } else {
          this.serverless.cli.log('Problems to retrieve keys from vault: Check your path and your address and make sure you have everything done before run it again'); 
          this.serverless.cli.log('Error to authenticate on Vault: ' + error + ' StatusCode: ' + response.statusCode);
          reject(this);
        }
      });
    });
  }

  /**
   * @private
   * @returns {Promise}
   */
  getMultiplesSecrets(token, ignoreVars) {
    if (token) {
      this.serverless.service.custom.vault.token = token;
    }
    return new Promise((resolve, reject) => {
      const keysToVault = this.serverless.service.provider.environment;

      this.serverless.service.provider.environment = [];

      for (let key in keysToVault) {

        const myOptions = {
          url: this.serverless.service.custom.vault.url + '/v1/' + this.serverless.service.custom.vault.secret + '/' + keysToVault[key],
          method: 'GET',
          headers: {
            'X-Vault-Token': this.serverless.service.custom.vault.token,
            'Content-Type':'application/json',
          },
          strictSSL: !!this.serverless.service.custom.vault.ssl_check
        };

        request.get(myOptions, (error, response = {}, body) => {

          const arrayData = [];
          if (!error && typeof response.statusCode !== 'undefined' && response.statusCode == 200){
            const data = JSON.parse(body);

    

            for (let secret in data.data) {
              arrayData.push(
                this.kmsEncryptVariable(
                  secret,
                  data.data[secret]
                )
              );
            }
            Promise.all(arrayData).then((result) => {
              this.serverless.service.provider.environment = {};
 
              for (let rst in result) {
                const key = result[rst]['key'].toString();
                const value = result[rst]['value'].CiphertextBlob.toString('base64');
 
                this.serverless.service.provider.environment[key] = value;
              }
              for (let ignore in ignoreVars.ignore) {
                this.serverless.service.provider.environment[Object.keys(ignoreVars.ignore[ignore])[0]] = Object.values(ignoreVars.ignore[ignore])[0]
              }
              resolve(this);
            });
          
          } else {
            this.serverless.cli.log('Problems to retrieve keys from vault: Check your path and your address and make sure you have everything done before run it again'); 
            this.serverless.cli.log('Error to authenticate on Vault: ' + error + ' StatusCode: ' + response.statusCode);
            reject(this);
          }
        });
      }
    });

  }

  getVaultSecrets() {
    const methodAuth = this.serverless.service.custom.vault.method || 'token';
    var ignoreVars = '';

    for (var i = 0; i < this.serverless.service.provider.environment.length; i++) {
      if (this.serverless.service.provider.environment[i].hasOwnProperty("ignore")) {
        ignoreVars = this.serverless.service.provider.environment[i];
        this.serverless.service.provider.environment.splice(i, 1);
      }
    }

    return new Promise((resolve, reject) => {
      this.method = '';

      if (this.serverless.service.custom.vault.secret.includes('/')) {
        this.method = this.getSingleSecrets;
      } else {
        this.method = this.getMultiplesSecrets;
      }

      if (methodAuth === 'userpass') {
        if ((!this.serverless.service.custom.vault.user) || (!this.serverless.service.custom.vault.password)){
          this.serverless.cli.log('You need set user, pass to this type of auth');
          reject('set user, pass to moving on...');
        }
        this.requestLoginToken().then(function (result) {
          const token = result['auth']['client_token'];
          resolve(this.method(token, ignoreVars));
        });
      } else if (methodAuth === 'token') {
        resolve(this.method(null, ignoreVars));
      } else {
        reject('method key must be: "userpass" or "token" by default: "token"');
      }
    });

  }
}

module.exports = ServerlessPlugin;
