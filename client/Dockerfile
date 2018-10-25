FROM node:10.12-alpine

ENV PATH=/home/node/.npm-global/bin:$PATH
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
RUN apk add --update git python \
	make \
	g++ \
  && rm -rf /var/cache/apk/* && \
  git clone https://github.com/Fffrank/flightplan.git

VOLUME /config
EXPOSE 3000
CMD cd /config && flightplan client