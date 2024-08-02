#!/usr/bin/python3
'''
server for stopgap implementation
'''
import sys, os, logging, socket  # pylint: disable=multiple-imports
import posixpath as httppath
from http.server import SimpleHTTPRequestHandler, HTTPStatus, test as serve
from threading import Thread, enumerate as threading_enumerate
from select import select
from wsserver import create_key, launch_websocket

ADDRESS = os.getenv('LOCAL') or '127.0.0.1'
PORT = os.getenv('PORT') or 8000

# pylint: disable=consider-using-f-string

class WebSocketHandler(SimpleHTTPRequestHandler):
    '''
    subclass to take care of some things differently from system library
    '''
    def do_GET(self):
        '''
        handle WebSocket requests
        '''
        logging.debug('handling GET request for %s', self.path)
        logging.debug('socket at do_GET(): %s', self.connection)
        return super().do_GET()

    def do_POST(self):  # pylint: disable=invalid-name
        '''
        handle POST calls with command functions
        '''
        logging.debug('handling POST request for %s', self.path)
        command = self.path.lstrip('/')
        if command in dir(self) and callable(getattr(self, command)):
            return getattr(self, command)()
        self.send_error(HTTPStatus.NOT_IMPLEMENTED,
                        'Command %s unsupported' % command)
        return None

    def send_head(self):
        '''
        handle favicon.ico and websocket requests internally
        '''
        logging.debug('WebSocketHandler.send_head() called')
        if self.path == '/favicon.ico':
            logging.debug('sending fake (empty) favicon.ico')
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-type', 'image/png')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        if 'Sec-WebSocket-Key' in self.headers:
            logging.debug('websocket request received')
            if os.getenv('FORCE_WS_ERROR'):  # `make FORCE_WS_ERROR=1`
                logging.debug('pretending not to recognize WS request')
                self.send_response(HTTPStatus.NOT_IMPLEMENTED,
                                   'Pretending not to recognize, for debugging'
                )
                self.end_headers()
                return None
            nonce = self.headers['Sec-WebSocket-Key'].encode()
            self.send_response_only(HTTPStatus.SWITCHING_PROTOCOLS,
                                    'Switching Protocols')
            self.send_header('Upgrade', 'websocket')
            self.send_header('Connection', 'Upgrade')
            self.send_header('Sec-WebSocket-Accept', create_key(nonce).decode())
            self.end_headers()
            # disable keep-alive from this point
            # pylint: disable=attribute-defined-outside-init
            self.close_connection = True
            logging.debug('sent upgrade response')
            logging.debug('socket before launch_websocket: %s', self.connection)
            launch_websocket(nonce.decode(), self.connection)
            return None
        return super().send_head()

def background():
    '''
    iPhone trick for running from iSH

    runs in separate thread to keep server active while browser in foreground
    '''
    try:
        with open('/dev/location', encoding='utf-8') as infile:
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
    launch server
    '''
    command = httppath.splitext(httppath.split(path)[1])[0]
    logging.debug('command: %s', command)
    if command == 'server':
        logging.debug('launching HTTP server')
        keepalive = Thread(target=background, daemon=True)
        keepalive.start()
        try:
            serve(HandlerClass=WebSocketHandler, bind=ADDRESS,
                  protocol='HTTP/1.1', port=PORT)
        finally:  # KeyboardInterrupt already trapped and sys.exit() called
            threads = threading_enumerate()
            logging.debug('threads: %s', threads)
            logging.debug('waiting for keepalive thread to exit')
    else:
        logging.error('no longer supports CGI scripts')

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
    return address

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)
    dispatch(sys.argv[0])
