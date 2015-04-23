import base64
import hashlib
import os
import shutil
from urllib2 import URLError
import pyjsonrpc

from flask import flash, session
from pyjsonrpc.rpcerror import JsonRpcError
from webrob.app_and_db import app
from webrob.pages.utility import random_string


client = pyjsonrpc.HttpClient(url="http://"+os.environ['DOCKERBRIDGE_PORT_5001_TCP_ADDR'] + ':'
                              + os.environ['DOCKERBRIDGE_PORT_5001_TCP_PORT'])


def generate_mac(user_container_name, client_name, dest, rand, t, level, end, cache=False):
    """
    Generate the mac for use with rosauth. Choose params according to rosauth specification.
    """
    if cache and 'secret_t' in session and session['secret_t'] > t:
        secret = session['secret_key']
    else:
        secret = client.files_readsecret(user_container_name)
    if cache:
        session['secret_t'] = t + 30
        session['secret_key'] = secret
    return hashlib.sha512(secret + client_name + dest + rand + str(t) + level + str(end)).hexdigest()


def start_user_container(container_name, application_container, links, volumes):
    try:
        client.notify("create_user_data_container", container_name)
        client.notify("files_writesecret", container_name, random_string(16))
        client.notify("start_user_container", container_name, application_container, links, volumes)
    except JsonRpcError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def start_webapp_container(container_name, webapp_container, links, volumes):
    try:
        client.notify("start_webapp_container", container_name, webapp_container, links, volumes)
    except JsonRpcError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def stop_container(user_container_name):
    try:
        client.notify("stop_container", user_container_name)
        if 'secret_t' in session:
            del session['secret_t']
        if 'secret_key' in session:
            del session['secret_key']
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def container_exists(user_container_name, base_container=None):
    try:
        return client.container_exists(user_container_name, base_container)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")
    return None


def get_container_ip(user_container_name):
    try:
        return client.get_container_ip(user_container_name)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")
    return None


def get_container_log(user_container_name):
    try:
        return client.get_container_log(user_container_name)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def refresh(user_container_name):
    try:
        client.notify("refresh", user_container_name)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def file_exists(user_container_name, file):
    try:
        return client.files_exists(user_container_name, file)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def file_rm(user_container_name, file, recursive=False):
    try:
        client.notify("files_rm", user_container_name, file, recursive)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def file_ls(user_container_name, dir, recursive=False):
    try:
        return client.files_ls(user_container_name, dir, recursive)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def file_read(user_container_name, file):
    try:
        return base64.b64decode(client.files_fromcontainer(user_container_name, file))
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def file_write(user_container_name, data, file):
    try:
        client.notify("files_tocontainer", user_container_name, base64.b64encode(data), file)
    except JsonRpcError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your application failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


class LFTransfer(object):

    def __init__(self, user_container):
        self.lftdir = None
        self.user_container = user_container

    def get_filetransfer_folder(self):
        return self.lftdir

    def to_container(self, sourcefile, targetfile):
        if '/tmp/openEASE/dockerbridge' in sourcefile:
            source = os.path.relpath(sourcefile, '/tmp/openEASE/dockerbridge')
        elif self.lftdir not in sourcefile:
            source = os.path.relpath(os.path.join(self.lftdir, sourcefile), '/tmp/openEASE/dockerbridge')
        else:
            source = sourcefile
        client.notify("files_largetocontainer", self.user_container, source, targetfile)

    def from_container(self, sourcefile, targetfile):
        if '/tmp/openEASE/dockerbridge' in targetfile:
            target = os.path.relpath(targetfile, '/tmp/openEASE/dockerbridge')
        elif self.lftdir not in targetfile:
            target = os.path.relpath(os.path.join(self.lftdir, targetfile), '/tmp/openEASE/dockerbridge')
        else:
            target = targetfile
        client.notify("files_largefromcontainer", self.user_container, sourcefile, target)

    def __enter__(self):
        if not os.access('/tmp/openEASE/dockerbridge/', os.W_OK):
            client.notify("files_lft_set_writeable")
        self.lftdir = os.path.join('/tmp/openEASE/dockerbridge', random_string(16))
        os.mkdir(self.lftdir)
        return self

    def __exit__(self, type, value, traceback):
        shutil.rmtree(self.lftdir, True)