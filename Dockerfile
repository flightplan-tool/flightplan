FROM node:10.12-alpine

ENV PATH=/home/node/.npm-global/bin:$PATH
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
RUN apk add --no-cache git python \
	make \
	g++ \	
	&& git clone git://github.com/Fffrank/flightplan.git -b dockerize \
	&& cd flightplan \
	&& npm install --global -unsafe

VOLUME /config
EXPOSE 5000
CMD cd /config && flightplan server