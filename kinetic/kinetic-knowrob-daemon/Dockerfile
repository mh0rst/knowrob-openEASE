FROM openease/kinetic-swi
MAINTAINER Daniel Beßler, danielb@cs.uni-bremen.de

# AR-Helper required services for this Dockerfile: ?with-service=apt&with-service=gradle&with-service=sh
ARG AR=""
ADD $AR /tmp/ar-helper
RUN test -f /tmp/ar-helper && chmod +x /tmp/ar-helper && /tmp/ar-helper || true

# Initialize the catkin workspace
USER ros
WORKDIR /home/ros/src
RUN /usr/bin/python /opt/ros/kinetic/bin/catkin_init_workspace

RUN echo "Cloning repositories..."
RUN git clone --recursive https://github.com/mh0rst/knowrob.git -b kinetic && \
    git clone --recursive https://github.com/knowrob/knowrob_addons.git -b kinetic && \
    git clone https://github.com/code-iai/iai_maps.git && \
    git clone https://github.com/code-iai/iai_common_msgs.git && \
    git clone https://github.com/code-iai/iai_cad_tools.git && \
    git clone https://github.com/RobotWebTools/mjpeg_server.git && \
    git clone https://github.com/RobotWebTools/tf2_web_republisher.git && \
    git clone https://github.com/andreihaidu/knowrob_robcog.git

WORKDIR /home/ros
# Build the catkin workspace
RUN /opt/ros/kinetic/bin/catkin_make

# ENTRYPOINT /opt/ros/kinetic/bin/roslaunch knowrob_roslog_launch knowrob_ease.launch
