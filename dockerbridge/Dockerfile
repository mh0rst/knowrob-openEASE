FROM ubuntu:16.04
MAINTAINER Moritz Horstmann, dev@peterzweg.at

# AR-Helper required services for this Dockerfile: ?with-service=apt&with-service=pip
ARG AR=""
ADD $AR /tmp/ar-helper
RUN test -f /tmp/ar-helper && chmod +x /tmp/ar-helper && /tmp/ar-helper || true

RUN apt-get -qq update
RUN apt-get -qq install -y python-pip

ADD requirements.txt /tmp/dockerbridge_requirements.txt
RUN pip install -r /tmp/dockerbridge_requirements.txt

WORKDIR /opt/dockerbridge
ADD . /opt/dockerbridge

EXPOSE 5001
CMD ["python", "dockerbridge.py"]
