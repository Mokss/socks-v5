import net from 'net';
import * as CONSTANTS from './lib/constants.js';
import { getAddress, getPort, createError } from './lib/handler.js';

function connect(server, socket, buffer, options) {
  //  +----+-----+-------+------+----------+----------+
  //  |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
  //  +----+-----+-------+------+----------+----------+
  //  | 1  |  1  | X'00' |  1   | Variable |    2     |
  //  +----+-----+-------+------+----------+----------+

  const cmd = buffer[1];
  const atyp = buffer[3];
  const addr = getAddress(buffer);
  const port = getPort(buffer);

  if (buffer[0] !== CONSTANTS.VERSION) {
    const error = createError('Wrong socks version in connect.', socket);
    error.bufferMessage = buffer;
    server.emit('error', error);

    const response = Buffer.from([CONSTANTS.VERSION, CONSTANTS.REPLIES.GENERAL_FAILURE]);
    socket.end(response);
    return;
  }

  if (!addr || !port) {
    const error = createError('Unsupported address.', socket);
    error.bufferMessage = buffer;
    server.emit('error', error);

    const response = Buffer.from([
      0x05,
      CONSTANTS.REPLIES.ADDRESS_TYPE_NOT_SUPPORTED,
    ]);
    socket.end(response);
    return;
  }

  if (cmd !== CONSTANTS.COMMANDS.CONNECT) {
    const error = createError('Unsupported UDP_ASSOCIATE and BIND connection.', socket);
    error.bufferMessage = buffer;
    server.emit('error', error);

    const response = Buffer.from([
      0x05,
      CONSTANTS.REPLIES.COMMAND_NOT_SUPPORTED,
    ]);
    socket.end(response);
    return;
  }

  if (typeof options.filter === 'function') {
    const result = options.filter(addr);
    if (!result) {
      const response = Buffer.from([
        CONSTANTS.VERSION,
        CONSTANTS.REPLIES.HOST_UNREACHABLE,
      ]);
      socket.end(response);
      return;
    }
  }

  const request = net.connect(port, addr, () => {
    buffer[1] = CONSTANTS.REPLIES.SUCCEEDED;

    socket.write(buffer, () => {
      request.pipe(socket);
      socket.pipe(request);
    });
  });

  socket.on('end', () => {
    request.destroy();
  });

  socket.on('timeout', () => {
    request.destroy();
  });

  request.on('connect', () => {
    server.emit('connect', { addr, port });
  });

  request.on('data', (data) => {
    server.emit('data', data);
  });

  request.setTimeout(options.timeout || 120000);
  request.on('timeout', () => {
    request.destroy();
  });

  request.on('error', (err) => {
    err.addr = addr;
    err.atyp = atyp;
    err.port = port;
    server.emit('error', err);

    let response;
    if (err.code === 'EADDRNOTAVAIL') {
      response = Buffer.from([0x05, CONSTANTS.REPLIES.HOST_UNREACHABLE]);
    } else if (err.code === 'ECONNREFUSED') {
      response = Buffer.from([0x05, CONSTANTS.REPLIES.CONNECTION_REFUSED]);
    } else {
      response = Buffer.from([0x05, CONSTANTS.REPLIES.NETWORK_UNREACHABLE]);
    }
    socket.end(response);
    request.destroy();
  });
}

function authenticate(server, socket, buffer, options) {
  //  +----+------+----------+------+----------+
  //  |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
  //  +----+------+----------+------+----------+
  //  | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
  //  +----+------+----------+------+----------+

  const ulen = 2 + buffer[1]; // last byte of the name
  const name = buffer.toString('utf8', 2, ulen);
  const password = buffer.toString('utf8', ulen + 1, buffer.length);

  // check socks version
  if (buffer[0] !== CONSTANTS.AUTH_VERSION) {
    const error = createError('Unsupported authentication version.', socket);
    error.bufferMessage = buffer;
    server.emit('error', error);

    const response = Buffer.from([
      CONSTANTS.AUTH_VERSION,
      CONSTANTS.AUTH_REPLIES.GENERAL_FAILURE,
    ]);
    socket.end(response);
    return;
  }

  const auth = options.authenticate(name, password);

  if (!auth) {
    const response = Buffer.from([
      CONSTANTS.AUTH_VERSION,
      CONSTANTS.AUTH_REPLIES.GENERAL_FAILURE,
    ]);
    socket.end(response);
    return;
  }

  const response = Buffer.from([
    CONSTANTS.AUTH_VERSION,
    CONSTANTS.AUTH_REPLIES.SUCCEEDED,
  ]);

  socket.write(response, () => {
    socket.once('data', (buffer2) => connect(server, socket, buffer2, options));
  });
}

function handshake(server, socket, buffer, options) {
  //  +----+----------+----------+
  //  |VER | NAUTH_METHODS | AUTH_METHODS  |
  //  +----+----------+----------+
  //  | 1  |    1     | 1 to 255 |
  //  +----+----------+----------+

  // SOCKS Version 5 is the only support version
  if (buffer[0] !== CONSTANTS.VERSION) {
    const error = createError('Wrong socks version in handshake.', socket);
    error.bufferMessage = buffer;
    server.emit('error', error);

    const response = Buffer.from([0x05, CONSTANTS.REPLIES.GENERAL_FAILURE]);
    socket.end(response);
    return;
  }

  const auth = typeof options.authenticate === 'function';
  let next;

  const response = Buffer.alloc(2);
  response[0] = 0x05;

  if (auth && buffer.includes(CONSTANTS.AUTH_METHODS.LOGIN_PASS, 2)) {
    response[1] = CONSTANTS.AUTH_METHODS.LOGIN_PASS;
    next = authenticate;
  } else if (!auth && buffer[2] === CONSTANTS.AUTH_METHODS.NO_AUTHENTICATION) {
    response[1] = CONSTANTS.AUTH_METHODS.NO_AUTHENTICATION;
    next = connect;
  } else {
    const error = createError('Unsupported authentication method.', socket);
    error.bufferMessage = buffer;
    server.emit('error', error);

    response[1] = CONSTANTS.AUTH_METHODS.NO_ACCEPTABLE_AUTH_METHODS;
    socket.end(response);
    return;
  }

  socket.write(response, () => {
    socket.once('data', (nextBuffer) => next(server, socket, nextBuffer, options));
  });
}

export const createServer = (options = {}) => {
  const server = net.createServer((socket) => {
    socket.on('error', (err) => {
      server.emit('error', err);
      socket.destroy();
    });

    socket.setTimeout(options.timeout || 120000);

    socket.on('end', () => {
      socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.once('data', (buffer) => handshake(server, socket, buffer, options));
  });

  return server;
};
