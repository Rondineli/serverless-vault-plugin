import boto3
import os
import json

from base64 import b64decode


def decrypt(key, value):
    try:
        var_plain_text = boto3.client('kms').decrypt(CiphertextBlob=b64decode(os.environ.get(key)))['Plaintext'].decode("utf")
    except Exception as e:
        print(e)
        return None

    os.environ[key] = var_plain_text
    return var_plain_text

for key, value in os.environ.items():
    decrypt(key, value)

def hello(event, context):
    for key, value in os.environ.items():
        decrypt(key, value)
    environ_data = os.environ.copy()
    data = json.dumps(environ_data)
    return data

