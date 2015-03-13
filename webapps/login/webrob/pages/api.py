from flask import jsonify, request, session, redirect
from flask_login import current_user
from flask_user import login_required
import time
from urlparse import urlparse
from webrob.app_and_db import app, db
from webrob.docker import knowrob_docker
from webrob.docker.knowrob_docker import generate_mac
from webrob.models.users import User
from webrob.pages.utility import random_string

__author__ = 'mhorst@cs.uni-bremen.de'


@app.route('/api/v1.0/auth_by_session', methods=['GET'])
def login_by_session():
    """
    Returns authentication information for the currently logged in user as required by the knowrob.js authentication
    request
    """
    if current_user.is_authenticated():
        ip = knowrob_docker.get_container_ip(session['user_container_name'])
        return generate_rosauth(session['user_container_name'], ip)
    return jsonify({'error': 'not authenticated'})


@app.route('/api/v1.0/refresh_by_session', methods=['GET'])
def refresh_by_session():
    """
    Refreshes the running session for a currently logged in user. This prevents a users container from being terminated
    automatically.
    """
    if current_user.is_authenticated():
        knowrob_docker.refresh(current_user.username)
        return jsonify({'result': 'success'})
    return jsonify({'error': 'not authenticated'})


@app.route('/api/v1.0/auth_by_token/<string:token>', methods=['GET'])
def login_by_token(token):
    """
    Returns authentication information for the user assigned to the given API token. This is needed to authenticate
    against the rosbridge by third party clients.
    """
    user = user_by_token(token)
    if user is None:
        return jsonify({'error': 'wrong api token'})
    ip = knowrob_docker.get_container_ip(user.username)
    return generate_rosauth(user.username, ip)


@app.route('/api/v1.0/start_container/<string:token>', methods=['GET'])
def start_container(token):
    """
    Starts the container of the user assigned to the given API token. The WebSocket url to the users rosbridge instance
    will be returned on success.
    """
    user = user_by_token(token)
    if user is None:
        return jsonify({'error': 'wrong api token'})
    #knowrob_docker.start_user_container(user.username, '/home/ros/user_data/' + user.username)
    #TODO doesn't work, wat do?
    host_url = urlparse(request.host_url).hostname
    return jsonify({'result': 'success',
                    'url': '//'+host_url+'/ws/'+user.username+'/'})


@app.route('/api/v1.0/stop_container/<string:token>', methods=['GET'])
def stop_container(token):
    """
    Stops the container of the user assigned to the given API token.
    """
    user = user_by_token(token)
    if user is None:
        return jsonify({'error': 'wrong api token'})
    knowrob_docker.stop_container(user.username)
    return jsonify({'result': 'success'})


@app.route('/api/v1.0/refresh_by_token/<string:token>', methods=['GET'])
def refresh_by_token(token):
    """
    Refreshes the running session for the user assigned to the given API token. This prevents a users container from
    being terminated automatically.
    """
    user = user_by_token(token)
    if user is None:
        return jsonify({'error': 'wrong api token'})
    knowrob_docker.refresh(user.username)
    return jsonify({'result': 'success'})

@app.route('/create_api_token', methods=['GET'])
@login_required
def create_api_token():
    create_token()
    return redirect('/')


def create_token():
    current_user.api_token = random_string(64)
    db.session.commit()
    session['api_token'] = current_user.api_token


def user_by_token(token):
    """
    Returns the user object for the given API token, or None if no matching user could be found.
    """
    return User.query.filter_by(api_token=token).first()


def generate_rosauth(user_container_name, dest):
    """
    Generate the mac for use with rosauth and compile a json object with all necessary information to authenticate
    with the server.
    :param user_container_name: Name of the user container
    :param dest: IP of the destination
    :return: a json object for ros
    """
    client = request.remote_addr

    rand = random_string(30)

    t = int(time.time())
    level = "user"
    end = int(t + 3600)


    return jsonify({
            'mac': generate_mac(user_container_name, client, dest, rand, t, level, end),
            'client': client,
            'dest': dest,
            'rand': rand,
            't': t,
            'level': level,
            'end': end
        })