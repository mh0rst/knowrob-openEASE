FROM ubuntu:16.04
MAINTAINER Moritz Horstmann, dev@peterzweg.at

RUN apt-get -qq update
RUN apt-get -qq install -y python-pip

ADD requirements.txt /tmp/dockerbridge_requirements.txt
RUN pip install -r /tmp/dockerbridge_requirements.txt

WORKDIR /opt/dockerbridge
ADD . /opt/dockerbridge

EXPOSE 5001
CMD ["python", "dockerbridge.py"]
