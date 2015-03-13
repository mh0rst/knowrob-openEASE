import hashlib
import os.path
from urllib2 import URLError
import pyjsonrpc

from flask import flash
from pyjsonrpc.rpcerror import InternalError
from webrob.app_and_db import app
from webrob.pages.utility import write_text_file, random_string


# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
# Docker stuff


def docker_connect():
    http_client = pyjsonrpc.HttpClient(
        url="http://"+os.environ['DOCKERBRIDGE_PORT_5001_TCP_ADDR'] + ':'
            + os.environ['DOCKERBRIDGE_PORT_5001_TCP_PORT']
    )
    return http_client


def generate_secret(user_container_name):
    path = '/tmp/easesecrets/' + user_container_name
    if not os.path.exists(path):
        os.makedirs(path)
    write_text_file(path + '/secret', random_string(16))


def generate_mac(user_container_name, client, dest, rand, t, level, end):
    """
    Generate the mac for use with rosauth. Choose params according to rosauth specification.
    """
    f = open('/tmp/easesecrets/' + user_container_name + '/secret', 'r')
    secret = f.readline()
    f.close()
    return hashlib.sha512(secret + client + dest + rand + str(t) + level + str(end)).hexdigest()


def start_user_container(container_name, user_home_dir, application_container, links, volumes):
    try:
        c = docker_connect()

        if c is not None:
            generate_secret(user_container_name)
            c.notify("start_user_container", container_name, application_container, links, volumes)
            # create home directory if it does not exist yet
            if not os.path.exists(user_home_dir):
                os.makedirs(user_home_dir)

    except InternalError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def start_webapp_container(container_name, webapp_container, links, volumes):
    try:
        app.logger.error("start_webapp_container\n")
        c = docker_connect()

        if c is not None:
            c.notify("start_webapp_container", container_name, webapp_container, links, volumes)

    except InternalError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your OpenEASE instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def stop_container(user_container_name):
    try:
        c = docker_connect()
        if c is not None:
            c.notify("stop_container", user_container_name)

    except InternalError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")

def container_exists(user_container_name):
    try:
        c = docker_connect()
        if c is not None:
            return c.container_exists(user_container_name)
    except InternalError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")

def get_container_ip(user_container_name):
    try:
        c = docker_connect()
        if c is not None:
            return c.get_container_ip(user_container_name)
    except InternalError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def get_container_log(user_container_name):
    try:
        c = docker_connect()
        if c is not None:
            return c.get_container_log(user_container_name)
    except InternalError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")


def refresh(user_container_name):
    try:
        c = docker_connect()
        if c is not None:
            return c.notify("refresh", user_container_name)
    except InternalError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e.message) + str(e.data) + "\n")
    except URLError, e:
        flash("Error: Connection to your KnowRob instance failed.")
        app.logger.error("ConnectionError during connect: " + str(e) + "\n")
