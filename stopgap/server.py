#!/usr/bin/python3
'''
server for stopgap implementation
'''
import logging, time
from http.server import CGIHTTPRequestHandler as cgi_handler, test as serve
from threading import Thread
from select import select

def background():
    '''
    run in separate thread to keep server active while browser in foreground
    '''
    with open('/dev/location') as infile:
        logging.debug('keepalive thread launched in background')
        while select([infile], [], []):
            location = infile.read()
            logging.debug('location: %s', location)

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)
    Thread(target=background).start()
    logging.debug('launching HTTP server')
    cgi_handler.cgi_directories.insert(0, '/')
    serve(
        HandlerClass=cgi_handler,
    )
