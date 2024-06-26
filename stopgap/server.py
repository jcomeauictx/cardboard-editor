#!/usr/bin/python3
'''
server for stopgap implementation
'''
import sys, logging, time
import posixpath as httppath
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

def dispatch(path):
    '''
    launch server or handle CGI script
    '''
    command = httppath.splitext(httppath.split(path)[1])[0]
    logging.debug('command: %s', command)
    if command == 'server':
        logging.debug('launching HTTP server')
        Thread(target=background).start()
        serve(
            HandlerClass=cgi_handler
        )
    else:
        print('content-type: text/html\r\n\r\n', end='')
        print('okey-dokey')

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)
    dispatch(sys.argv[0])
