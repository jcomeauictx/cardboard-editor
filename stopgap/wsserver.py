#!/usr/bin/python3 -OO
'''
websocket server

adapted from https://en.wikipedia.org/wiki/WebSocket
'''
import sys, os, time, socket, logging  # pylint: disable=multiple-imports
from base64 import b64encode
from hashlib import sha1
from threading import Thread, enumerate as threading_enumerate
from select import select
logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)

ADDRESS = os.getenv('LOCAL') or '127.0.0.1'
PORT = os.getenv('PORT') or 8080
MAGIC = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'  # from WebSocket RFC6455
MESSAGES = [b'foo', b'bar', b'baz']  # simulated message stream
FIN = MASKED = 0b10000000  # bitmask for 'FIN' and 'MASKED' flag bits
PAYLOAD_SIZE = 0b01111111  # bitmask for payload size
RSV1 = RSV2 = RSV3 = 0  # reserved bits
CLOSE = 1000  # normal closure code per RFC 6455
OPCODE = {
    0: 'continuation',
    1: 'text',
    2: 'binary',
    3: 'reserved non-control',
    4: 'reserved non-control',
    5: 'reserved non-control',
    6: 'reserved non-control',
    7: 'reserved non-control',
    8: 'close',
    9: 'ping',
    10: 'pong',
    11: 'reserved control',
    12: 'reserved control',
    13: 'reserved control',
    14: 'reserved control',
    15: 'reserved control',
}
# allow reverse lookup, mapping (unique) opcode string to text
OPCODE.update(dict(map(reversed, OPCODE.items())))
SUPPORTED = ['text', 'binary', 'close', 'ping', 'pong']
MAXPACKET = 4096000  # quit on any packets this size or greater
MAX_RETRIES = 3
RESPONSE = (
    b'HTTP/1.1 101 Switching Protocols\r\n'
    b'Upgrade: websocket\r\n'
    b'Connection: Upgrade\r\n'
    b'Sec-WebSocket-Accept: %s\r\n'
    b'\r\n'
)
# get `uname -r` in case we need to do something special for iSH (-ish)
OS_RELEASE = os.uname().release
FAVICONS = ('favicon', 'apple-touch-icon')
PINGS = {
    'serial': 0,
    'sent': [],
    'received': []
}

# pylint: disable=consider-using-f-string

def socket_serve(address=ADDRESS, port=PORT):
    '''
    Create socket and listen
    '''
    websocket = socket.socket()
    # allow listening even if client is already attempting to connect
    websocket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    # make sure port is an integer
    try:
        port = int(port)
    except ValueError:
        port = socket.getservbyname(port)
    logging.info('wsserver attempting to bind %s', repr((address, port)))
    websocket.bind((address, port))
    logging.debug('listening on %s', websocket)
    websocket.listen()
    while True:
        connection = websocket.accept()[0]
        nonce = b''
        # Parse request
        packet = connection.recv(MAXPACKET)
        for line in packet.split(b'\r\n'):
            logging.debug('received line: %s', line)
            if line.startswith(b'Sec-WebSocket-Key'):
                nonce = line.split(b":")[1].strip()
        if nonce:
            response = RESPONSE % create_key(nonce)
            sent = connection.send(response)
            logging.debug('sent response %r, %d bytes', response, sent)
            launch_websocket(nonce.decode(), connection, demo)
        else:
            logging.warning('ignoring packet %s', packet)

def create_key(nonce):
    '''
    generate unique key for this nonce
    '''
    logging.debug('found nonce: %s', nonce)
    return b64encode(sha1(nonce + MAGIC).digest())

def launch_websocket(nonce, connection, handler):
    '''
    launch thread to handle websocket

    setting daemon=True reduces overhead, because the thread will terminate
    by itself when the program exits, but it causes the wfile of the
    connection (rfile of the socket) to disappear shortly after the first
    `send`, when called with a dup'd connection UNLESS the original socket
    is closed. I don't understand why, just found out experimentally.
    '''
    socketcopy = connection.dup()
    connection.close()
    thread = Thread(target=handler, args=(socketcopy,),
                    name=nonce, daemon=True)
    thread.start()

def demo(connection):
    '''
    handle two-way communications with websocket client
    '''
    # pylint: disable=too-many-locals, too-many-branches, too-many-statements
    logging.debug('thread starting handle(%s)', connection)
    counter = retries = 0
    opcode = None
    previous = packet = b''
    closed = False
    ping(connection)  # send a ping to break the ice
    while True: # send messages and show responses from the client
        if not closed:
            message = MESSAGES[counter % len(MESSAGES)]
            logging.debug('sending %s on %s', message, connection)
            try:
                connection.send(package(message))
                counter += 1
                retries = 0
            except BrokenPipeError as send_failed:
                if retries < MAX_RETRIES:
                    logging.debug('send failed, will try again')
                    retries += 1
                    time.sleep(1)
                    continue
                raise send_failed
        try:
            if PINGS['received']:
                connection.send(package(PINGS['received'][-1]), 'pong')
                PINGS['received'][:] = []  # erase this and any prior pings
            logging.debug('awaiting packet on %s', connection)
            # attempted fix for when we get a truncated packet with only
            # the first two bytes, as happened in commit 17aed9a3
            packet = packet or (previous + connection.recv(MAXPACKET))
            logging.debug('packet: %s...', packet[:64])
            offset = 0
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
                offset += 2  # move to masking key (for short payload anyway)
                if payload_size == 126:
                    payload_size = int.from_bytes(
                        packet[offset + 2:offset + 4], 'big'
                    )
                    offset += 2
                elif payload_size == 127:
                    payload_size = int.from_bytes(
                        packet[offset + 2: offset + 6], 'big'
                    )
                    offset += 4
                masking_key = packet[offset:offset + 4]
                logging.debug('masking key: %s', masking_key)
                offset += 4  # skip past masking key to payload
                payload = bytearray(packet[offset:])
                if len(payload) > payload_size:
                    logging.error('payload unexpected size: %s', payload)
                    logging.info('assuming we got more than one packet')
                    # split off additional packet[s]
                    packet = bytes(payload[payload_size:])
                    payload = payload[:payload_size]
                    previous = b''
                elif len(payload) < payload_size:
                    logging.error('received truncated packet %s', packet)
                    previous = packet
                    packet = b''
                else:
                    previous = packet = b''
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
                if opcode == 'ping':
                    if len(payload) <= 125:
                        PINGS['received'].append(payload)
                        PINGS['received'][0:-2] = []  # only keep last 2
                    else:
                        logging.error('ping payload must not exceed 125 bytes')
                elif opcode == 'pong':
                    if PINGS['sent']:
                        if payload != PINGS['sent'][-1]:
                            logging.error(
                                'pong payload %s does not match our ping %s',
                                payload, PINGS['sent'][-1]
                            )
                        else:
                            logging.info('received pong for ping %s', payload)
                    else:
                        logging.warning('pong %s unsolicited', payload)
                    PINGS['sent'][:] = []  # erase any sent pings
                elif payload == b'stop':
                    connection.send(package(
                        CLOSE.to_bytes(2, 'big') +
                            b"server closed on client's request",
                        'close')
                    )
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
        # simulate having to wait for data, if packet not already queued
        if not packet:
            time.sleep(1)

def package(payload, opcode='text'):
    r'''
    wrap payload in websocket packet

    >>> package(bytes(10))
    b'\x81\n\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
    >>> package(bytes(1000))[:12]
    b'\x81~\x03\xe8\x00\x00\x00\x00\x00\x00\x00\x00'
    >>> package(bytes(100000))[:12]
    b'\x81\x7f\x00\x00\x00\x00\x00\x01\x86\xa0\x00\x00'
    '''
    length = len(payload)
    if length <= 125:
        packed = bytes((FIN | OPCODE[opcode], length)) + payload
        logging.debug('package being sent: %s', packed)
    elif length <= 65535:  # 16 bits
        packed = (
            bytes((FIN | OPCODE[opcode], 126)) + length.to_bytes(2, 'big') +
            payload
        )
        logging.debug('package being sent: %s...', packed[:128])
    elif length < MAXPACKET - 10:  # 10 bytes for header
        packed = (
            bytes((FIN | OPCODE[opcode], 127)) + length.to_bytes(8, 'big') +
            payload
        )
        logging.debug('package being sent: %s...', packed[:128])
    else:
        raise BufferError('Package length of %d not permitted' % length)
    return packed

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

def ping(connection):
    '''
    send ping packet
    '''
    payload = str(PINGS['serial']).encode()
    PINGS['serial'] += 1
    connection.send(package(payload, 'ping'))
    PINGS['sent'].append(payload)
    PINGS['sent'][0:-2] = []  # only keep last 2

if __name__ == '__main__':
    try:
        socket_serve()
    finally:
        logging.debug('exiting __main__')
