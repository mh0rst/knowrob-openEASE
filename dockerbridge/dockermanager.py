"""
The DockerManager handles all communication with docker api and provides an API for all actions webrob need to perform
with the docker host.
"""
import traceback

import docker
from docker.errors import *

from utils import sysout


class DockerManager(object):

    def __init__(self):
        self.__client = docker.Client(base_url='unix://var/run/docker.sock', version='1.12', timeout=10)

    def start_common_container(self):
        try:
            self.__start_common_container__(self.__client.containers(all=True))
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")
            traceback.print_exc()

    def __start_common_container__(self, all_containers):
        if self.__get_container("knowrob_data", all_containers) is None:
            sysout("Creating knowrob_data container.")
            self.__client.create_container('knowrob/knowrob_data', detach=True, name="knowrob_data", entrypoint='true')
            self.__client.start("knowrob_data")

        if self.__get_container("mongo_data", all_containers) is None:
            sysout("Creating mongo data container.")
            self.__client.create_container('busybox', detach=True, name='mongo_data', volumes=['/data/db'],
                                           entrypoint='true')

        if self.__get_container("mongo_db", all_containers) is None:
            sysout("Creating mongo container.")
            self.__client.create_container('mongo', detach=True, name='mongo_db')
            self.__client.start('mongo', volumes_from=['mongo_data'])

    def start_user_container(self, container_name, application_container, links, volumes):
        try:
            all_containers = self.__client.containers(all=True)
            # Make sure common containers are up and running
            self.__start_common_container__(all_containers)
            # Stop user container if running
            self.__stop_container__(container_name, all_containers)

            user_home_dir = '/home/ros/user_data/' + container_name
            user_data_container = 'data_'+container_name
            volumes += user_data_container
            sysout(str(volumes)) #TODO remove on finished testing

            sysout("Creating user container " + container_name)
            env = {"VIRTUAL_HOST": container_name,
                   "VIRTUAL_PORT": '9090',
                   "ROS_PACKAGE_PATH": ":".join([
                       "/home/ros/src",
                       "/opt/ros/hydro/share",
                       "/opt/ros/hydro/stacks",
                       user_home_dir
            ])}
            self.__client.create_container(application_container, detach=True, tty=True, environment=env,
                                           name=container_name)

            sysout("Starting user container " + container_name)
            # TODO add user data container to volumes
            # TODO make knowrob_data read only
            self.__client.start(container_name,
                                port_bindings={9090: ('127.0.0.1',)},
                                links=links,
                                volumes_from=volumes)
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")
            traceback.print_exc()

    def create_user_data_container(self, container_name):
        try:
            all_containers = self.__client.containers(all=True)
            user_home_dir = '/home/ros/user_data/' + container_name
            user_data_container = 'data_'+container_name
            if self.__get_container(user_data_container, all_containers) is None:
                sysout("Creating "+user_data_container+" container.")
                self.__client.create_container('knowrob/user_data', detach=True, tty=True, name=user_data_container,
                                           volumes=[user_home_dir], entrypoint='true')
                self.__client.start(user_data_container)
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")
            traceback.print_exc()

    def start_webapp_container(self, container_name, webapp_container, links, volumes):
        try:
            all_containers = self.__client.containers(all=True)
            # Make sure common containers are up and running
            self.__start_common_container__(all_containers)
            # Stop user container if running
            if self.__get_container(container_name, all_containers) is None:
                sysout("Creating webapp container " + container_name)
                env = {"VIRTUAL_HOST": container_name,
                       "VIRTUAL_PORT": '5000',
                       "OPEN_EASE_WEBAPP": 'true'}
                self.__client.create_container(webapp_container,
                                   detach=True, tty=True, stdin_open=True,
                                   environment=env,
                                   name=container_name,
                                   command='python runserver.py')
                sysout("Running webapp container " + container_name)
                self.__client.start(container_name,
                        port_bindings={5000: ('127.0.0.1',)},
                        links=links,
                        volumes_from=volumes)
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")
            traceback.print_exc()

    def stop_container(self, container_name):
        try:
            self.__stop_container__(container_name, self.__client.containers(all=True))
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")

    def __stop_container__(self, container_name, all_containers):
        # check if containers exist:
        if self.__get_container(container_name, all_containers) is not None:
            sysout("Stopping container " + container_name + "...\n")
            self.__client.stop(container_name, timeout=5)

            sysout("Removing container " + container_name + "...\n")
            self.__client.remove_container(container_name)

    def get_container_ip(self, container_name):
        try:
            inspect = self.__client.inspect_container(container_name)
            return inspect['NetworkSettings']['IPAddress']
        except (APIError, DockerException), e:
            return 'error'

    def get_container_log(self, container_name):
        try:
            logger = self.__client.logs(container_name, stdout=True, stderr=True, stream=False, timestamps=False)
            logstr = ""
            # TODO: limit number of lines!
            # It seems for a long living container the log gets to huge.
            for line in logger:
                logstr += line
            return logstr
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")
            return 'error'

    def container_exists(self, container_name):
        try:
            return self.__get_container(container_name, self.__client.containers(all=True)) is not None
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")
            return False

    def container_exists(self, container_name, base_container_name):
        try:
            cont = self.__get_container(container_name, self.__client.containers(all=True))
            if cont is None:
                return False
            
            inspect = self.__client.inspect_container(container_name)
            image = inspect['Config']['Image']
            
            return image is base_container_name
        
        except (APIError, DockerException), e:
            sysout("Error:" + str(e.message) + "\n")
            return False

    @staticmethod
    def __get_container(container_name, all_containers):
        for cont in all_containers:
            if "/" + container_name in cont['Names']:
                return cont
        return None
