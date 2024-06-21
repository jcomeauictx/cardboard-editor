#!/usr/bin/python3
'''
server for stopgap implementation
'''
import logging, time
from http.server import CGIHTTPServer
from threading import Thread

def background:
    '''
    run in separate thread to keep server active while browser in foreground
    '''
    with open('/dev/location') as infile:
        location = infile.read()
        logging.debug('location: %s', location)

if __name__ == '__main__':
    Thread(target=background).start()
    while True:
        time.sleep(10)
