## Example - How to use serverless-vault-plugin

### Install Docker and run vault in your local env

-- **Install Docker** ([https://docs.docker.com/install/](https://docs.docker.com/install/))

-- **Run:**
```
sudo docker run -dt --cap-add=IPC_LOCK -e "VAULT_DEV_ROOT_TOKEN_ID=4bea777b-9752-4c57-972d-02d091715254" -e 'VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200' vault
```

It will create a docker container with Vault and a root token: `4bea777b-9752-4c57-972d-02d091715254`.

-- **Install npm and nodeJs** ([https://www.npmjs.com/get-npm](https://www.npmjs.com/get-npm))

-- **Run:**
```
npm i
```
It will create a `node_modules` path.

-- **Access your container and add the following commands** (inside of the container).
```
export VAULT_ADDR='http://0.0.0.0:8200'

vault write secret/example-app SECRET_1="foo" SECRET_2="bar" SECRET_3="foobar"
```

-- **Set your token as env var in your deployment machine** (or your local machine) `*Pssiu: It is just to not let you commit any token on serverless.yml file.`
```
export TOKEN_VAULT=4bea777b-9752-4c57-972d-02d091715254.
```
-- **Finnaly, run your app deployment application**
```
sls deploy -s dev
```

### Example how to use the plugin with Userpass method auth
Create a user/ pass on vault. Access your vault container and run: (inside of the container)
```
export VAULT_ADDR='http://0.0.0.0:8200'

vault login -method=userpass username=myuser password=mypassword
```

then, add it your `serverless.yml`
```
custom:

  vault:
    method: "userpass"
    user: "myuser"
    password: "mypassword"
    url: "https://localhost:8200"
    secret: "secret/example-app"
    ssl_check: false
  kms:
    keyId: ${env:KEY_KMS_ID}

```

### Suggestions:
1. User always needs a valid certificate for the vault
2. Get preference to use userpass method with a expiration token ttl, userpass will retrieve a temp token to retrieve the passwords
3. Never commit your passwords or users. Use it as your env vars or try to create it in a separeted file (add it to .gitignore)
4. Look always at your policies, set the right policies of your lambda app (in order to set kms to use always the least permissions)
5. Create a fork of this repository and contribute :)

Cheers!
