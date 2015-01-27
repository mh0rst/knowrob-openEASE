from Crypto.Random import random
from flask import jsonify, request, session
from flask_login import current_user
import hashlib
import string
import time
from webrob.app_and_db import app

__author__ = 'mhorst@cs.uni-bremen.de'

@app.route('/wsauth/v1.0/by_session', methods=['GET'])
def login_by_session():
    if current_user.is_authenticated():
        return generate_mac()
    return jsonify({'error': 'not authenticated'})


@app.route('/wsauth/v1.0/by_token/<string:token>', methods=['GET'])
def login_by_token(token):
    return jsonify({'error': 'not implemented yet'})

def generate_mac():
    secret = "RW6WZ2yp67ETMdj2" #TODO customize for each user
    client = request.remote_addr
    dest = session['container_ip']

    rand = "".join([random.choice(string.ascii_letters + string.digits) for n in xrange(30)])

    t = int(time.time())
    level = "user"
    end = int(t + 3600)

    mac = hashlib.sha512(secret + client + dest + rand + str(t) + level + str(end) ).hexdigest()
    return jsonify({
            'mac': mac,
            'client': client,
            'dest': dest,
            'rand': rand,
            't': t,
            'level': level,
            'end': end
        })