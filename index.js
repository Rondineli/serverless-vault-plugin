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

    return new Promise((resolve, reject) => {

      var options = {
        url: myModule.serverless.service.custom.vault.url + '/v1/' + myModule.serverless.service.custom.vault.secret,
        headers: {
          'X-Vault-Token': myModule.serverless.service.custom.vault.token,
          'Content-Type':'application/json',
        },
        strictSSL: myModule.serverless.service.custom.vault.ssl_check || false
      };

      function callbackT(error, response, body) {

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
          reject(myModule);
        }
      }
      request.get(options, callbackT.bind(myModule));
    });

  }
}

module.exports = ServerlessPlugin;
