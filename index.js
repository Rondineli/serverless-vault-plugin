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
    };
    this.kms = new aws.KMS({region: this.options.region});
  }

  kmsEncryptVariable(key, value) {
    const myValue = value;
    const myKey = key;
    const myModule = this;

    let PrePromise = function() {
      return new Promise((resolve, reject) => {
        const params = {
          KeyId: myModule.serverless.service.custom.kms.keyId,
          Plaintext: Buffer.from(String(myValue))
        };

        myModule.kms.encrypt(params, (err, data) => {
          if (err) {
            reject(err);

          } else {
            resolve(data);
          }
        });
      }).then(data => {
        return {
          'key': myKey,
          'value': data
        };
      });
    };

    let data = PrePromise();
    return data;
  }

  getVaultSecrets() {
    const myModule = this;
    const methodAuth = myModule.serverless.service.custom.vault.method || 'token';

    function prePromisseTokenCallBack(){
      const  myOptions = {
        url : myModule.serverless.service.custom.vault.url + '/v1/auth/userpass/login/' + myModule.serverless.service.custom.vault.user,
        method: 'POST',
        headers: {
          'Content-Type':'application/json'
        },
        json: {
          'password': myModule.serverless.service.custom.vault.password
        },
        strictSSL: myModule.serverless.service.custom.vault.ssl_check || false
      };

      let PrePromise = function() {
        return new Promise(function(resolve, reject) {

          request.post(myOptions, function(error, response, body) {

            if (!error & response.statusCode == 200) {
              resolve(body);
            } else {
              myModule.serverless.cli.log('Error to authenticate on Vault: ' + error + ' StatusCode: ' + response.statusCode);
              reject(error);
            }
          });
        }).then(data => {
          return data;
        });
      };

      let data = PrePromise();
      return data;
    }
    
    function prePromisseDataCallBack(token=null){
      if (token) {
        myModule.serverless.service.custom.vault.token = token;
      }

      const myOptions = {
        url: myModule.serverless.service.custom.vault.url + '/v1/' + myModule.serverless.service.custom.vault.secret,
        method: 'GET',
        headers: {
          'X-Vault-Token': myModule.serverless.service.custom.vault.token,
          'Content-Type':'application/json',
        },
        strictSSL: myModule.serverless.service.custom.vault.ssl_check || false
      };

      let PrePromise = function() {
        return new Promise(function(resolve, reject) {
          request.get(myOptions, function(error, response, body) {

            var arrayData = [];

            if (!error & response.statusCode == 200){
              var data = JSON.parse(body);
              var keysToVault = myModule.serverless.service.provider.environment;

              myModule.serverless.service.provider.environment = [];
      
              for (var key in keysToVault) {
                if (data.data[keysToVault[key]]) {
                  arrayData.push(
                    myModule.kmsEncryptVariable(
                      keysToVault[key],
                      data.data[keysToVault[key]]
                    )
                  );
                } else  {
                  myModule.serverless.cli.log('Key ' + key + 'var not found on vault to be encrypted by kms');
                }
              }
              Promise.all(arrayData).then(function (result) {
                myModule.serverless.service.provider.environment = {};

                for (var rst in result) {
                  var key = result[rst]['key'].toString();
                  var value = result[rst]['value'].CiphertextBlob.toString('base64');

                  myModule.serverless.service.provider.environment[key] = value;
                }
                resolve(myModule);
              });

            } else {
              myModule.serverless.cli.log('Problems to retrieve keys from vault: Check your path and your address and make sure you have everything done before run it again'); 
              myModule.serverless.cli.log('Error to authenticate on Vault: ' + error + ' StatusCode: ' + response.statusCode);
              reject(myModule);
            }
          });
        });
      };
      let data = PrePromise();
      return data;
    }

    return new Promise((resolve, reject) => {

      if (methodAuth == 'userpass') {
        if ((!myModule.serverless.service.custom.vault.user) || (!myModule.serverless.service.custom.vault.password)){
          myModule.serverless.cli.log('You need set user, pass to this type of auth');
          reject('set user, pass to moving on...');
        }
        prePromisseTokenCallBack()
          .then(function (result) {
            var token = result['auth']['client_token'];
            resolve(prePromisseDataCallBack(token));
          });
      } else if (methodAuth == 'token') {
        resolve(prePromisseDataCallBack());
      } else {
        reject('method key must be: "userpass" or "token" by default: "token"');
      }
    });
  }
}

module.exports = ServerlessPlugin;
