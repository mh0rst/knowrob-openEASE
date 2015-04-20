"""
Basic file handling functions for handling data in docker data containers.
"""
import StringIO

import docker
from docker.errors import APIError

import dockerio


__author__ = 'mhorst@cs.uni-bremen.de'


class FileManager(object):

    def __init__(self):
        self.docker = docker.Client(base_url='unix://var/run/docker.sock', version='1.12', timeout=10)

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

    def mkdir(self, container, dir, parents=False, user=0):
        """
        Creates a new directory inside the container
        :param container: container to create the folder in
        :param dir: the directory to create
        :param parents: set to true if nonexisting parent directories should also be created
        :param user: uid or username of the desired owner
        """
        cont = self.__create_temp_container('mkdir '+('-p ' if parents else ' ')+dir, user)
        self.__start_container(cont, container)
        self.__stop_and_remove(cont)

    def rm(self, container, file, recursive=False):
        """
        Removes the given file from the container
        :param container: container to remove the file from
        :param file: the file to remove
        :param recursive: set to true if directories should be removed recursively
        """
        cont = self.__create_temp_container('rm '+('-r ' if recursive else ' ')+file)
        self.__start_container(cont, container)
        self.__stop_and_remove(cont)

    def tar(self, container, sourcefile, target):
        """
        Compresses the given file from the container
        :param container: container to use
        :param sourcefile: file to compress
        :param target: stream to write the data to
        """
        cont = self.__create_temp_container('tar -c -f - '+sourcefile)
        outstream = self.__attach(cont, 'stdout')
        self.__start_container(cont, container)
        self.__pump(outstream, target)
        self.__stop_and_remove(cont)

    def untar(self, container, source, targetdir, user=0):
        """
        Untar the tar file from the source stream into the targetdir inside the container
        :param container: container to use
        :param source: stream of a tar file
        :param targetdir: directory to extract the tar file into
        """
        cont = self.__create_temp_container('tar -x -C '+targetdir+' -f -', user)
        instream = self.__attach(cont, 'stdin')
        self.__start_container(cont, container)
        self.__pump(source, instream)
        self.__stop_and_remove(cont)

    def listfiles(self, container, dir):
        """
        Returns all files found in given directory (including subdirectories) inside the container
        :param container: Name of the data container
        :param dir: Path to list the files from
        :return: a string list of files
        """
        find = self.__find(container, dir)
        if len(find) > 0:
            del find[0]
        return find

    def __find(self, data_container, dir):
        cont = self.__create_temp_container('cd '+dir+' && find .')
        outstream = self.__attach(cont, 'stdout')
        self.__start_container(cont, data_container)
        result = StringIO.StringIO()
        self.__pump(outstream, result)
        self.__stop_and_remove(cont)
        return result.getvalue().splitlines()

    def __readfile(self, data_container, sourcefile, targetstream):
        cont = self.__create_temp_container('cat '+sourcefile)
        outstream = self.__attach(cont, 'stdout')
        self.__start_container(cont, data_container)
        self.__pump(outstream, targetstream)
        self.__stop_and_remove(cont)

    def __writefile(self, data_container, sourcestream, targetfile, user=0):
        cont = self.__create_temp_container('sh -c \'cat > '+targetfile+'\'', user)
        instream = self.__attach(cont, 'stdin')
        self.__start_container(cont, data_container)
        self.__pump(sourcestream, instream)
        self.__stop_and_remove(cont)

    def __pump(self, instream, outstream):
        pump = dockerio.Pump(instream, outstream)
        while True:
            if pump.flush() is None:
                break

    def __create_temp_container(self, cmd, user=0):
        return self.docker.create_container(stdin_open=True, image='busybox:latest', command=cmd, user=user)

    def __attach(self, container, streamtype):
        socket = self.docker.attach_socket(container, {streamtype: 1, 'stream': 1})
        stream = dockerio.Stream(socket)
        stream.set_blocking(False)
        return dockerio.Demuxer(stream)

    def __start_container(self, container, data_container):
        try:
            self.docker.start(container, volumes_from=data_container)
        except APIError as e:
            # If any error occurs, kill the remaining container.
            self.__stop_and_remove(container)
            raise e

    def __stop_and_remove(self, container):
        self.docker.remove_container(container, False, False, True)