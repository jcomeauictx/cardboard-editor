#!/usr/bin/python3
'''
server for stopgap implementation
'''
import sys, os, logging, socket, json  # pylint: disable=multiple-imports
import posixpath as httppath
from http.server import SimpleHTTPRequestHandler, HTTPStatus, test as serve
from threading import Thread, enumerate as threading_enumerate
from select import select
from wsserver import create_key, launch_websocket, package, MAXPACKET, FIN, \
    OPCODE, SUPPORTED, MASKED, PAYLOAD_SIZE, CLOSE

ADDRESS = os.getenv('LOCAL') or '127.0.0.1'
PORT = os.getenv('PORT') or 8000
KEYS = [chr(n).encode() for n in range(32, 127)]
CLIENTS = set()
FAVICONS = ('favicon', 'apple-touch-icon')

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
        if httppath.basename(self.path).startswith(FAVICONS):
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
            launch_websocket(nonce.decode(), self.connection, handler)
            return None
        return super().send_head()

def handler(connection):
    '''
    handle two-way communications with websocket client
    '''
    # pylint: disable=too-many-locals, too-many-branches, too-many-statements
    logging.debug('thread starting handle(%s)', connection)
    opcode = None
    packet = b''
    serial = 0  # serial number for keyhits
    # pylint: disable=too-many-nested-blocks
    while True: # receive keyhits and dispatch them back out to all threads
        try:
            logging.debug('awaiting packet on %s', connection)
            packet = packet or connection.recv(MAXPACKET)
            offset = 0
            serialized = None  # for joining key with serial number
            if len(packet) >= 2:
                if (packet[offset] & FIN) != FIN:
                    logging.error('we only support unfragmented messages')
                    raise NotImplementedError('fragments not supported')
                if len(packet) == MAXPACKET:
                    logging.error('large packets not supported')
                    raise StopIteration('packet too large, cannot re-sync')
                opcode = OPCODE[packet[offset] & 0xf]
                logging.debug('opcode: %s', opcode)
                if opcode not in SUPPORTED:
                    logging.error('we only support opcodes %s', SUPPORTED)
                    logging.error('offending opcode: %d', opcode)
                    raise NotImplementedError('opcode not supported')
                masked = bool(packet[offset + 1] & MASKED)
                if not masked:
                    logging.error('unmasked client data violates standard')
                    raise NotImplementedError('unmasked data not supported')
                payload_size = packet[offset + 1] & PAYLOAD_SIZE
                if payload_size > 125:
                    logging.error('we only support small messages')
                    logging.error('offending size: %d', payload_size)
                    raise ValueError('message too large')
                offset = 2  # move to masking key
                masking_key = packet[offset:offset + 4]
                logging.debug('masking key: %s', masking_key)
                offset += 4  # skip past masking key to payload
                payload = bytearray(packet[offset:])
                if len(payload) != payload_size:
                    logging.error('payload unexpected size: %s', payload)
                    logging.info('assuming we got more than one packet')
                    # split off additional packet[s]
                    packet = bytes(payload[payload_size:])
                    payload = payload[:payload_size]
                else:
                    packet = b''
                for i in range(payload_size):
                    payload[i] = payload[i] ^ masking_key[i % 4]
                logging.info('payload: %s', payload)
                if opcode == 'close':
                    code, reason = (
                        int.from_bytes(payload[:2], 'big'),
                        payload[2:]
                    )
                    logging.warning('client closed connection: %d, %s',
                                    code, reason)
                    raise StopIteration('remote end initiated closure')
                if payload == b'stop':
                    connection.send(package(
                        CLOSE.to_bytes(2, 'big') +
                            b"server closed on client's request",
                        'close')
                    )
                elif payload == b'stopgap editor':
                    logging.info('stopgap editor found at %s', connection)
                    CLIENTS.add(connection)
                else:
                    try:
                        message = json.loads(payload)
                    except json.JSONDecodeError:
                        logging.warning('could not decode %r', payload)
                        continue
                    # serial numbers must be nonzero, so increment first.
                    # same key/serial number gets sent to all clients.
                    serial += 1
                    for client in CLIENTS:
                        if client is connection and not message['echo']:
                            logging.debug('not echoing %s back to sender %s',
                                          message['key'], client)
                        else:
                            logging.debug("sending key %r to %s",
                                          message['key'], client)
                            message.pop('echo')
                            message.update({'serial': serial})
                            serialized = pack(message)
                            try:
                                client.send(package(serialized))
                            except OSError as broken:
                                logging.critical('failed sending to %s: %s',
                                                 client, broken)
                                raise BrokenPipeError from broken
            elif not packet:
                raise StopIteration('remote end closed unexpectedly')
            else:
                raise ValueError('insufficient packet length: %d' % len(packet))
        except (NotImplementedError, ValueError, IndexError) as error:
            logging.error('error in processing message: %s', error)
        except (StopIteration, ConnectionResetError, BrokenPipeError) as ended:
            logging.info('remote end closed: %s', ended)
            try:  # ignore failure on shutdown
                connection.shutdown(socket.SHUT_WR)
                connection.close()
            finally:
                threads = threading_enumerate()
                logging.debug('threads remaining: %s', threads)
                sys.exit(0)

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
    if command == 'stopgap':
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

def pack(message_dict):
    '''
    pack message, passed as dict, into shortest possible JSON bytestring
    '''
    return json.dumps(message_dict, separators=(',', ':')).encode()

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)
    dispatch(sys.argv[0])
