## Example how to use the serverless-vault-plugin

### Install docker and run vault in your local env
* To install docker look at [![docker instalation page](https://docs.docker.com/install/)]

Then, run:
```
sudo docker run -dt --cap-add=IPC_LOCK -e "VAULT_DEV_ROOT_TOKEN_ID=4bea777b-9752-4c57-972d-02d091715254" -e 'VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200' vault
```

It will create a docker container with vault and a root token: 4bea777b-9752-4c57-972d-02d091715254.

Then, install npm and nodeJs: [![see it here](https://www.npmjs.com/get-npm)]

then, run:
```
npm i
```
It will create a `node_modules` path.

Access your container and add the following commands (inside of the container).
```
export VAULT_ADDR='http://0.0.0.0:8200'

vault write secret/example-app SECRET_1="foo" SECRET_2="bar" SECRET_3="foobar"
```

Set your token as env var in your deployment machine (or your local machine) `*Pssiu: It is just to not let you commit any token on serverless.yml file.`
```
export TOKEN_VAULT=4bea777b-9752-4c57-972d-02d091715254.
```
Then, finnaly run your app deployment application:
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

### Sugestions:
1. User always a valid certificate for vault
2. Get preference to use userpass method with a expiration token ttl, userpass will retrieve a temp token to retrieve the passwords
3. Never commit your passwords or users, use it as your env vars or try to create it in a separeted file the you can add in your gitignore
4. Look always to your policies, set the right policies to your lambda app (to use kms using always less permissions as possible)
5. Create a fork from this repository and contribute

Cheers!
