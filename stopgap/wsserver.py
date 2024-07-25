#!/usr/bin/python3 -OO
'''
websocket server

adapted from https://en.wikipedia.org/wiki/WebSocket
'''
import sys, os, time, socket, logging  # pylint: disable=multiple-imports
from base64 import b64encode
from hashlib import sha1
logging.basicConfig(level=logging.DEBUG if __debug__ else logging.INFO)

ADDRESS = os.getenv('LOCAL') or '127.0.0.1'
PORT = os.getenv('PORT') or 8080
MAGIC = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'  # from WebSocket RFC6455
MESSAGES = [b'foo', b'bar', b'baz']
FIN = MASKED = 0b10000000
PAYLOAD_SIZE = 0b01111111
RSV1 = RSV2 = RSV3 = 0  # reserved bits
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
OPCODE.update(dict(map(reversed, OPCODE.items())))
SUPPORTED = ('text', 'binary', 'close')

# pylint: disable=consider-using-f-string

def serve(address=ADDRESS, port=PORT):
    '''
    Create socket and listen
    '''
    # pylint: disable=too-many-locals, too-many-branches, too-many-statements
    ws = socket.socket()
    try:
        ws.bind((address, port))
    except TypeError:
        ws.bind((address, socket.getservbyname(port)))
    logging.debug('listening on %s', ws)
    ws.listen()
    conn = ws.accept()[0]
    nonce = b''
    # Parse request
    for line in conn.recv(4096).split(b'\r\n'):
        logging.debug('received line: %s', line)
        if line.startswith(b'Sec-WebSocket-Key'):
            nonce = line.split(b":")[1].strip()
            logging.debug('found nonce: %s', nonce)

    # Format response
    response = (
        b'HTTP/1.1 101 Switching Protocols\r\n'
        b'Upgrade: websocket\r\n'
        b'Connection: Upgrade\r\n'
        b'Sec-WebSocket-Accept: %s\r\n'
        b'\r\n'
    ) % b64encode(sha1(nonce + MAGIC).digest())

    sent = conn.send(response)
    logging.debug('sent response: %s, %d bytes', response, sent)
    counter = 0
    while True: # decode messages from the client
        conn.send(package(MESSAGES[counter % len(MESSAGES)]))
        counter += 1
        time.sleep(1)
        try:
            packet = conn.recv(4096)
            if len(packet) >= 2:
                if (packet[0] & FIN) != FIN:
                    logging.error('we only support unfragmented messages')
                    raise NotImplementedError('fragments not supported')
                opcode = OPCODE[packet[0] & 0xf]
                if opcode not in SUPPORTED:
                    logging.error('we only support data messages')
                    logging.error('offending opcode: %d', opcode)
                    raise NotImplementedError('opcode not supported')
                if opcode == 'close':
                    raise StopIteration('remote sent close message')
                masked = bool(packet[1] & MASKED)
                if not masked:
                    logging.error('unmasked client data violates standard')
                    raise NotImplementedError('unmasked data not supported')
                payload_size = packet[1] & PAYLOAD_SIZE
                if payload_size > 125:
                    logging.error('we only support small messages')
                    logging.error('offending size: %d', payload_size)
                    raise ValueError('message too large')
                masking_key = packet[2:6]
                logging.debug('masking key: %s', masking_key)
                payload = bytearray(packet[6:])
                if len(payload) != payload_size:
                    raise ValueError('wrong payload size %d != %d' %
                                     len(payload), payload_size)
                for i in range(payload_size):
                    payload[i] = payload[i] ^ masking_key[i % 4]
                logging.info('payload: %s', payload)
            elif not packet:
                raise StopIteration('remote end closed')
            else:
                raise ValueError('insufficient packet length: %d' % len(packet))
        except (NotImplementedError, ValueError, IndexError) as error:
            logging.error('error in processing message: %s', error)
        except (StopIteration, ConnectionResetError) as ended:
            logging.info('remote end closed: %s', ended)
            sys.exit(0)

def package(payload):
    '''
    wrap payload in websocket packet

    assumes plain text and short message, doesn't do any checking
    '''
    length = len(payload)
    return bytes((FIN | OPCODE['text'], length)) + payload

if __name__ == '__main__':
    serve()
