FROM ubuntu:16.04
MAINTAINER Daniel Beßler, danielb@cs.uni-bremen.de

# flag used in nginx configuration
ENV OPEN_EASE_WEBCLIENT true

# AR-Helper required services for this Dockerfile: ?with-service=apt&with-service=npm
ARG AR=""
ADD $AR /tmp/ar-helper
RUN test -f /tmp/ar-helper && chmod +x /tmp/ar-helper && /tmp/ar-helper || true

# install NPM (gather JS dependencies), Jekyll (build static HTML) and Nginx (serve static content)
RUN DEBIAN_FRONTEND=noninteractive apt-get -qq update &&\
    DEBIAN_FRONTEND=noninteractive\
    apt-get -qq install -y -q git nodejs nodejs-legacy npm jekyll nginx &&\
    rm -rf /var/lib/apt/lists/*

## install npm dendencies
RUN mkdir /tmp/npm; mkdir -p /var/www/html/static
ADD index.js package.json /tmp/npm/
RUN cd /tmp/npm && npm install && npm run build && mv /tmp/npm/openease*.js /var/www/html/static && rm -rf /tmp/npm

## copy this folder to the container
ADD static /var/www/html/static
ADD html /tmp/html
RUN cd /tmp/html && jekyll build && cp /tmp/html/_site/* /var/www/html && rm -rf /tmp/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
