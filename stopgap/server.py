#!/usr/bin/python3
'''
server for stopgap implementation
'''
import sys, logging, time, socket  # pylint: disable=multiple-imports
import posixpath as httppath
from http.server import SimpleHTTPRequestHandler, CGIHTTPRequestHandler, \
    HTTPStatus, test as serve
from threading import Thread
from select import select

class CGIHandler(CGIHTTPRequestHandler):
    '''
    subclass to take care of some things differently from system library
    '''
    def send_head(self):
        command = self.path.lstrip('/')
        if command in dir(self) and callable(getattr(self, command)):
            getattr(self, command)()
        elif self.is_cgi():
            return self.run_cgi()
        elif self.path == '/favicon.ico':
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-type", 'image/vnd')
            self.send_header("Content-Length", '0')
            self.end_headers()
            return BytesIO(b'')
        else:
            return SimpleHTTPRequestHandler.send_head(self)

def background():
    '''
    run in separate thread to keep server active while browser in foreground
    '''
    try:
        with open('/dev/location') as infile:
            logging.debug('keepalive thread launched in background')
            while select([infile], [], [infile]):
                location = infile.read()
                logging.debug('location: %r', location)
                if not location:
                    break
    except FileNotFoundError:
        logging.debug('no /dev/location file found')

def dispatch(path):
    '''
    launch server or handle CGI script
    '''
    command = httppath.splitext(httppath.split(path)[1])[0]
    logging.debug('command: %s', command)
    if command == 'server':
        logging.debug('launching HTTP server')
        keepalive = Thread(target=background, daemon=True)
        keepalive.start()
        try:
            serve(HandlerClass=CGIHandler)
        finally:  # KeyboardInterrupt already trapped and sys.exit() called
            logging.debug('waiting for keepalive thread to exit')
    else:
        print('content-type: text/html\r\n\r\n', end='')
        print('okey-dokey')

def get_ip_address(remote='1.1.1.1', port=33434):
    '''
    returns external (NAT, if used) IP address of Internet-connected machine

    https://stackoverflow.com/a/25850698/493161

    uses innocuous traceroute port 33434 by default, even though UDP doesn't
    actually send a packet on `connect`

    1.1.1.1 is a public cloudflare DNS service
    '''
    address = None
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect((remote, port))
        address = probe.getsockname()[0]
    except (OSError, IndexError, RuntimeError) as problem:
        logging.error('Cannot determine IP address: %s', problem)
    finally:
        return address

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)
    dispatch(sys.argv[0])
