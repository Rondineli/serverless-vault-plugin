'use strict';
const path = require('path');
const Serverless = require('serverless');
const execSync = require('child_process').execSync;
const expect = require('chai').expect;
const testUtils = require('./Utils');
const fse = require('fs-extra');
const App = require('../index');

const serverless = new Serverless();
serverless.init();
const serverlessExec = path.join(serverless.config.serverlessPath, '..', 'bin', 'serverless');


process.env.MOCHA_PLUGIN_TEST_DIR = path.join(__dirname);
const tmpDir = testUtils.getTmpDirPath();
fse.mkdirsSync(tmpDir);
fse.copySync(path.join(process.env.MOCHA_PLUGIN_TEST_DIR, 'test-service'), tmpDir);
process.chdir(tmpDir);

describe ('Integration with stage option', () => {
  it('Should contain vault on params in cli info', () => {
    const test = execSync(`${serverlessExec}`);
    const result = new Buffer(test, 'base64').toString();

    expect(result).to.have.string('vault ......................... It will get your secrets from vault and upload secretly to kms');
  });
});

describe ('Testing retrieving data from vault', () => {
  const app = new App({}, {});
  const hooks = Object.keys(app.hooks);
  const commands = Object.keys(app.commands);
  
  it('Checking configs', () => {
    expect(hooks).to.eql(['before:package:initialize', 'before:vault:vault']);
    
  });

  it('Checking commands', () => {
    expect(commands).to.eql([ 'vault' ]);
    expect(app.commands.vault.usage).to.have.string('It will get your secrets from vault and upload secretly to kms');
    expect(app.commands.vault.lifecycleEvents).to.eql(['vault']);
    
  });

  it('Must check if const has env vars', () => {
    const serverless = {
      service: {
        provider: {
          environment: {
            TEST_VALUE_PROVIDER: 'test value provider',
          },
        },
        functions: {
          testFunction2: {
            environment: {
              TEST_VALUE_FUNCTION: 'test value function 2',
            },
          },
        },
      },
    };
    testUtils.setEnv(serverless, 'testFunction2');
    expect(process.env.TEST_VALUE_PROVIDER).to.be.equal('test value provider');
    expect(process.env.TEST_VALUE_FUNCTION).to.be.equal('test value function 2'); 
  });
});
