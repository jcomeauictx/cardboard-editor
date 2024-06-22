#!/usr/bin/python3
'''
server for stopgap implementation
'''
import logging, time
from http.server import CGIHTTPRequestHandler, ThreadingHTTPServer, test
from threading import Thread

def background():
    '''
    run in separate thread to keep server active while browser in foreground
    '''
    try:
        with open('/dev/location') as infile:
            while True:
                location = infile.read()
                logging.debug('location: %s', location)
    except FileNotFoundError:
        logging.debug('no /dev/location file found')

if __name__ == '__main__':
    Thread(target=background).start()
    test(
        HandlerClass=CGIHTTPRequestHandler,
        port=8080,
        bind='0.0.0.0',
    )
