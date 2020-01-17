const net = require("net");
const constants = require("./lib/constants");
const { getAddress, getPort } = require("./lib/handler");

function authenticate(server, socket, buffer, options) {
  //  +----+------+----------+------+----------+
  //  |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
  //  +----+------+----------+------+----------+
  //  | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
  //  +----+------+----------+------+----------+

  const ulen = 2 + buffer[1]; // last byte of the name
  const name = buffer.toString("utf8", 2, ulen);
  const password = buffer.toString("utf8", ulen + 1, buffer.length);

  // check socks version
  if (buffer[0] !== constants.AUTH_VERSION) {
    server.emit(
      "error",
      `${socket.remoteAddress} : 
      ${socket.remotePort} auth wrong socks version: ${buffer[0]}`
    );
    const response = Buffer.from([
      constants.AUTH_VERSION,
      constants.AUTH_REPLIES.GENERAL_FAILURE
    ]);
    socket.end(response);
    return;
  }

  const auth = options.authenticate(name, password);

  if (!auth) {
    const response = Buffer.from([
      constants.AUTH_VERSION,
      constants.AUTH_REPLIES.GENERAL_FAILURE
    ]);
    socket.end(response);
    return;
  }

  const response = Buffer.from([
    constants.AUTH_VERSION,
    constants.AUTH_REPLIES.SUCCEEDED
  ]);

  socket.write(response, () => {
    socket.once("data", connect);
  });
}

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

  if (buffer[0] !== constants.VERSION) {
    server.emit(
      "error",
      `${socket.remoteAddress}: 
      ${socket.remotePort} socks5 connect: wrong socks version: 
      ${buffer[0]}`
    );
    const response = Buffer.from([0x05, constants.REPLIES.GENERAL_FAILURE]);
    socket.end(response);
    return;
  }

  if (!addr || !port) {
    server.emit(
      "error",
      `${socket.remoteAddress}: ${socket.remotePort} Unsuported address -- disconnecting`
    );
    const response = Buffer.from([
      0x05,
      constants.REPLIES.ADDRESS_TYPE_NOT_SUPPORTED
    ]);
    socket.end(response);
    return;
  }

  if (cmd !== constants.COMMANDS.CONNECT) {
    // Unsuported udp and bind metod
    server.emit(
      "error",
      `${socket.remoteAddress}: ${socket.remotePort} Unsuported metod command`
    );
    const response = Buffer.from([
      0x05,
      constants.REPLIES.COMMAND_NOT_SUPPORTED
    ]);
    socket.end(response);
    return;
  }

  if (typeof options.filter === "function") {
    const result = options.filter(addr);
    if (!result) {
      const response = Buffer.from([
        constants.VERSION,
        constants.REPLIES.HOST_UNREACHABLE
      ]);
      socket.end(response);
      return;
    }
  }

  const request = net.connect(port, addr, () => {
    buffer[1] = constants.REPLIES.SUCCEEDED;

    socket.write(buffer, () => {
      request.pipe(socket);
      socket.pipe(request);
    });
  });

  request.on("connect", () => {
    server.emit("connect", { addr, port });
  });

  request.on("data", data => {
    server.emit("data", data);
  });

  request.setTimeout(options.timeout || 120000);
  request.on("timeout", () => {
    request.destroy();
  });

  request.on("error", err => {
    err.addr = addr;
    err.atyp = atyp;
    err.port = port;
    server.emit("error", err);

    let response;
    if (err.code === "EADDRNOTAVAIL") {
      response = Buffer.from([0x05, constants.REPLIES.HOST_UNREACHABLE]);
    } else if (err.code === "ECONNREFUSED") {
      response = Buffer.from([0x05, constants.REPLIES.CONNECTION_REFUSED]);
    } else {
      response = Buffer.from([0x05, constants.REPLIES.NETWORK_UNREACHABLE]);
    }
    socket.end(response);
    request.destroy();
  });
}

function handshake(server, socket, buffer, options) {
  //  +----+----------+----------+
  //  |VER | NMETHODS | METHODS  |
  //  +----+----------+----------+
  //  | 1  |    1     | 1 to 255 |
  //  +----+----------+----------+

  // SOCKS Version 5 is the only support version
  if (buffer[0] !== constants.VERSION) {
    server.emit(
      "error",
      `${socket.remoteAddress}: ${socket.remotePort} wrong socks version: 
      ${buffer[0]}`
    );
    const response = Buffer.from([0x05, constants.REPLIES.GENERAL_FAILURE]);
    socket.end(response);
    return;
  }

  const auth = typeof options.authenticate === "function";
  let next;

  const response = Buffer.alloc(2);
  response[0] = 0x05;

  if (auth && buffer[2] === constants.METHODS.LOGIN_PASS) {
    response[1] = constants.METHODS.LOGIN_PASS;
    next = authenticate;
  } else if (!auth && buffer[2] === constants.METHODS.NO_AUTHENTICATION) {
    response[1] = constants.METHODS.NO_AUTHENTICATION;
    next = connect;
  } else {
    server.emit(
      "error",
      `${socket.remoteAddress}: ${socket.remotePort}
      Unsuported authentication method -- disconnecting, method
      ${buffer[2]}`
    );
    response[1] = constants.METHODS.NO_ACCEPTABLE_METHODS;
    socket.end(response);
    return;
  }

  socket.write(response, () => {
    socket.once("data", buffer => next(server, socket, buffer, options));
  });
}

const createServer = options => {
  options = options || {};

  const server = net.createServer(socket => {
    socket.on("error", err => {
      server.emit("error", err);
      socket.destroy();
    });

    socket.setTimeout(options.timeout || 120000);
    socket.on("timeout", () => {
      socket.destroy();
    });

    socket.once("data", buffer => handshake(server, socket, buffer, options));
  });

  return server;
};

const createClient = options => {
  const { login, password } = options;

  const server = net.createServer(socket => {
    const handshakeClient = () => {
      socket.write(
        Buffer.from([constants.VERSION, constants.METHODS.NO_AUTHENTICATION])
      );

      socket.once("data", connectClient);
    };

    const connectServer = (mainServ, buffer) => {
      mainServ.once("data", () => {
        const res = Buffer.from([
          constants.AUTH_VERSION,
          login.length,
          ...Buffer.from(login, "utf8"),
          password.length,
          ...Buffer.from(password, "utf8")
        ]);

        mainServ.write(res, () => {
          mainServ.once("data", () => {
            mainServ.write(buffer, () => {
              mainServ.pipe(socket);
              socket.pipe(mainServ);
            });
          });
        });
      });
    };

    const connectClient = buffer => {
      const mainServ = net.connect(options);

      mainServ.on("error", err => {
        err.client = "mainServ";
        server.emit("error", err);
      });

      const request = Buffer.from([
        constants.VERSION,
        1,
        constants.METHODS.LOGIN_PASS
      ]);
      mainServ.write(request, connectServer.bind(null, mainServ, buffer));
    };

    socket.on("error", err => {
      server.emit("error", err);
    });

    socket.once("data", handshakeClient);
  });
  return server;
};

module.exports = {
  createServer,
  createClient
};
