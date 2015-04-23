"""
Basic file handling functions for handling data in docker data containers.
"""
import StringIO
import os

import docker
from docker.errors import APIError
import dockerio

__author__ = 'mhorst@cs.uni-bremen.de'


# Temporary large file directory on host
lft_dir = os.environ["OPENEASE_LFT"]


def data_container_name(user_container_name):
    """
    Return the data container name for the given user_container_name
    """
    return 'data_'+user_container_name


def absolute_userpath(relative):
    """
    Return the absolute path to the given relative filepath inside the user data container
    """
    return '/home/ros/user_data/'+relative


def host_transferpath(relative):
    """
    Return the absolute path to the given relative filename in the hosts large file transfer directory mounted inside
    the the user data container.
    """
    return '/tmp/openEASE/dockerbridge/'+relative


class FileManager(object):

    def __init__(self):
        self.docker = docker.Client(base_url='unix://var/run/docker.sock', version='1.18', timeout=10)

    def fromcontainer(self, container, sourcefile, target):
        """
        Reads the sourcefile from the container and streams the contents to the target
        :param container: container to read in as string
        :param sourcefile: file to read as string
        :param target: target to stream the file's content to
        """
        self.__readfile(container, sourcefile, target)

    def tocontainer(self, container, source, targetfile, user=0):
        """
        Writes the content from the source to the targetfile inside the container
        :param container: container to write to as string
        :param source: stream to read data from
        :param targetfile: target to write the data to
        :param user: uid or username of the desired owner
        """
        self.__writefile(container, source, targetfile, user)

    def copy_with_hostmount(self, container, sourcefile, targetfile, user=0):
        """
        Copies the given sourcefile to the given target with a mounted data container and host transfermount
        :param container: datacontainer to mount
        :param sourcefile: file to copy to the target
        :param targetfile: target to copy the file to
        :param user: UID or user name to use for copying
        """
        # If source is a folder and target folder already exists, integrate sourcefolder in targetfolder. otherwise
        # copy. Note that copy might fail or produce unexpected results if target already exists (folder -> file results
        # in failure, file -> folder will copy the file INTO the folder)
        cp_cmd = "sh -c 'test -e "+targetfile+' && test -d '+targetfile+ \
                 '&& cp -rf '+sourcefile+'/* '+targetfile+' || cp -rf '+sourcefile+' '+targetfile+"'"
        cont = self.__create_temp_hostmount_container(cp_cmd, container, user)
        self.__start_container(cont)
        self.__stop_and_remove(cont, True)

    def chown_hostmount(self, user=0, group=0):
        """
        Runs recursive chown with the given user and group on the host transfermount
        :param user: UID or username
        :param group: GID or groupname
        """
        cont = self.__create_temp_hostmount_container('chown -R '+str(user)+':'+str(group)+' '+host_transferpath('.'))
        self.__start_container(cont)
        self.__stop_and_remove(cont, True)

    def exists(self, container, file):
        """
        Returns true if file exists inside the container
        :param container: container to check for file existence in
        :param file: the file to check
        """
        return 'Yep' in self.__exists(container, file)

    def mkdir(self, container, dir, parents=False, user=0):
        """
        Creates a new directory inside the container
        :param container: container to create the folder in
        :param dir: the directory to create
        :param parents: set to true if nonexisting parent directories should also be created
        :param user: uid or username of the desired owner
        """
        cont = self.__create_temp_container('mkdir '+('-p ' if parents else ' ')+dir, container, user)
        self.__start_container(cont)
        self.__stop_and_remove(cont, True)

    def rm(self, container, file, recursive=False):
        """
        Removes the given file from the container
        :param container: container to remove the file from
        :param file: the file to remove
        :param recursive: set to true if directories should be removed recursively
        """
        cont = self.__create_temp_container('rm '+('-r ' if recursive else ' ')+file, container)
        self.__start_container(cont)
        self.__stop_and_remove(cont, True)

    def tar(self, container, sourcefile, target, chdir=None):
        """
        Compresses the given file from the container
        :param container: container to use
        :param sourcefile: file to compress
        :param target: stream to write the data to
        :param chdir: directory to change to inside tar
        """
        cont = self.__create_temp_container('tar -c' +
                                            (' -C '+chdir if chdir is not None else '') +
                                            ' -f - '+sourcefile, container)
        outstream = self.__attach(cont, 'stdout')
        self.__start_container(cont)
        self.__pump(outstream, target)
        self.__stop_and_remove(cont, True)

    def untar(self, container, source, targetdir, user=0):
        """
        Untar the tar file from the source stream into the targetdir inside the container
        :param container: container to use
        :param source: stream of a tar file
        :param targetdir: directory to extract the tar file into
        """
        cont = self.__create_temp_container('tar -x -C '+targetdir+' -f -', container, user)
        instream = self.__attach(cont, 'stdin')
        self.__start_container(cont)
        self.__pump(source, instream)
        self.__stop_and_remove(cont, True)

    def listfiles(self, container, dir, recursive=True):
        """
        Returns all files found in given directory inside the container
        :param container: Name of the data container
        :param dir: Path to list the files from
        :param recursive: whether to recursively list all files including subdirectories
        :return: a string list of files
        """
        opts = ' -maxdepth 1' if not recursive else ''
        opts += ' -exec sh -c \'"\'"\'test -d {} && echo -n d || echo -n f; echo {}\'"\'"\' \;'
        find = self.__find(container, dir, opts)
        if len(find) > 0:
            del find[0]
        children = []
        if len(find) > 0:
            children = self.__filter_ls(find)
        return {'name': dir[dir.rfind("/")+1:], 'children': children, 'isdir': True}

    def __filter_ls(self, list, prefix='.'):
        result = []
        visited_subdirs = []
        for i in range(0, len(list)):
            entry = list[i]
            if not entry.startswith(prefix, 1):
                break
            if len(filter(lambda s: s in entry[1:], visited_subdirs)) > 0:
                continue
            isdir = entry.startswith('d')
            children = []
            if isdir:
                children = self.__filter_ls(list[i+1:], entry[1:])
                visited_subdirs.append(entry[1:])
            name = entry[entry.rfind("/")+1:]
            result.append({'name': name, 'children': children, 'isdir': isdir})
        return result

    def __exists(self, data_container, file):
        cont = self.__create_temp_container('test -e '+file+' && echo Yep', data_container)
        outstream = self.__attach(cont, 'stdout')
        self.__start_container(cont)
        result = StringIO.StringIO()
        self.__pump(outstream, result)
        self.__stop_and_remove(cont, True)
        return result.getvalue()

    def __find(self, data_container, dir, opts):
        cont = self.__create_temp_container('sh -c \'cd '+dir+' && find .'+opts+'\'', data_container)
        outstream = self.__attach(cont, 'stdout')
        self.__start_container(cont)
        result = StringIO.StringIO()
        self.__pump(outstream, result)
        self.__stop_and_remove(cont, True)
        return result.getvalue().splitlines()

    def __readfile(self, data_container, sourcefile, targetstream):
        cont = self.__create_temp_container('cat '+sourcefile, data_container)
        outstream = self.__attach(cont, 'stdout')
        self.__start_container(cont)
        self.__pump(outstream, targetstream)
        self.__stop_and_remove(cont, True)

    def __writefile(self, data_container, sourcestream, targetfile, user=0):
        cont = self.__create_temp_container('sh -c \'cat > '+targetfile+'\'', data_container, user)
        instream = self.__attach(cont, 'stdin')
        self.__start_container(cont)
        self.__pump(sourcestream, instream)
        self.__stop_and_remove(cont)

    def __pump(self, instream, outstream):
        pump = dockerio.Pump(instream, outstream)
        while True:
            if pump.flush() is None:
                break

    def __create_temp_container(self, cmd, data_container, user=0):
        return self.docker.create_container(stdin_open=True,  image='busybox:latest', command=cmd, user=user,
                                            host_config={"LogConfig": {"Config": "", "Type": "none"},
                                                         "VolumesFrom": [data_container] })

    def __create_temp_hostmount_container(self, cmd, data_container=None, user=0):
        bind=host_transferpath('')
        return self.docker.create_container(stdin_open=True,  image='busybox:latest', command=cmd, user=user,
                                            volumes=[bind],
                                            host_config={"Binds": [lft_dir+':'+bind],
                                                         "LogConfig": {"Config": "", "Type": "none"},
                                                         "VolumesFrom": [data_container] if data_container is not None
                                                         else ''})

    def __attach(self, container, streamtype):
        socket = self.docker.attach_socket(container, {streamtype: 1, 'stream': 1})
        stream = dockerio.Stream(socket)
        return dockerio.Demuxer(stream)

    def __start_container(self, container):
        try:
            self.docker.start(container)
        except APIError as e:
            # If any error occurs, kill the remaining container.
            self.__stop_and_remove(container)
            raise e

    def __stop_and_remove(self, container, wait=False):
        try:
            if wait:
                self.docker.wait(container, timeout=60)
        except APIError as e:
            # If any error occurs, kill the remaining container.
            self.__stop_and_remove(container)
            raise e
        self.docker.remove_container(container, False, False, True)