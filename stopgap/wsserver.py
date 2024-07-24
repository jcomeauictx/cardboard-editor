#!/usr/bin/python3
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
MESSAGES = [b'foo', b'bar', b'baz']  # offset of -1 from wsclient.js

# pylint: disable=consider-using-f-string

def serve(address=ADDRESS, port=PORT):
    '''
    Create socket and listen
    '''
    # pylint: disable=too-many-locals
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
        conn.send(MESSAGES[counter % len(MESSAGES)])
        counter += 1
        try:
            header = conn.recv(2)
            if len(header) == 2:
                fin = bool(header[0] & 0x80) # bit 0
                assert fin == 1, 'We only support unfragmented messages'
                opcode = header[0] & 0xf # bits 4-7
                assert opcode in (1, 2), 'We only support data messages'
                masked = bool(header[1] & 0x80) # bit 8
                assert masked, 'The client must mask all frames'
                payload_size = header[1] & 0x7f # bits 9-15
                assert payload_size <= 125, 'We only support small messages'
                masking_key = conn.recv(4)
                payload = bytearray(conn.recv(payload_size))
                for i in range(payload_size):
                    payload[i] = payload[i] ^ masking_key[i % 4]
                logging.info('payload: %s', payload)
            elif not header:
                raise StopIteration('remote end closed')
            else:
                raise ValueError('insufficient header length: %d' % len(header))
        except (AssertionError, ValueError) as error:
            logging.error('error in processing message: %s', error)
        except (StopIteration, ConnectionResetError):
            logging.info('remote end closed')
            sys.exit(0)

if __name__ == '__main__':
    serve()
