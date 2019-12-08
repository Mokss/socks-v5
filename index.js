const net = require("net");
const constants = require("./lib/constants");
const { getAddress, getPort } = require("./lib/handler");

const createServer = options => {
  const server = net.createServer(socket => {
    const authenticate = buffer => {
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
        console.log(`auth wrong socks version: ${buffer[0]}`);
        const response = Buffer.from([
          constants.AUTH_VERSION,
          constants.AUTH_REPLIES.GENERAL_FAILURE
        ]);
        socket.end(response);
      }

      const auth = options.authenticate(name, password);

      if (auth) {
        const response = Buffer.from([
          constants.AUTH_VERSION,
          constants.AUTH_REPLIES.GENERAL_FAILURE
        ]);
        socket.end(response);
      }

      const response = Buffer.from([
        constants.AUTH_VERSION,
        constants.AUTH_REPLIES.SUCCEEDED
      ]);

      socket.write(response, () => {
        socket.once("data", connect);
      });
    };

    const connect = buffer => {
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
        console.error(`socks5 connect: wrong socks version: ${buffer[0]}`);
        const response = Buffer.from([0x05, constants.REPLIES.GENERAL_FAILURE]);
        socket.end(response);
      }

      if (!addr) {
        console.log("Unsuported address -- disconnecting");
        const response = Buffer.from([
          0x05,
          constants.REPLIES.ADDRESS_TYPE_NOT_SUPPORTED
        ]);
        socket.end(response);
      }

      if (cmd !== constants.COMMANDS.CONNECT) {
        // Unsuported udp and bind metod
        console.log("Unsuported metod command");
        const response = Buffer.from([
          0x05,
          constants.REPLIES.COMMAND_NOT_SUPPORTED
        ]);
        socket.end(response);
      }

      if (typeof options.filter === "function") {
        const result = options.filter(addr);
        if (result) {
          const response = Buffer.from([
            constants.VERSION,
            constants.REPLIES.HOST_UNREACHABLE
          ]);
          socket.end(response);
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

      request.on("error", err => {
        err.addr = addr;
        err.atyp = atyp;
        err.port = port;
        server.emit("error", err);

        if (err.code === "EADDRNOTAVAIL") {
          const response = Buffer.from([
            0x05,
            constants.REPLIES.HOST_UNREACHABLE
          ]);
          socket.end(response);
        }

        if (err.code === "ECONNREFUSED") {
          const response = Buffer.from([
            0x05,
            constants.REPLIES.CONNECTION_REFUSED
          ]);
          socket.end(response);
        }
        const response = Buffer.from([
          0x05,
          constants.REPLIES.NETWORK_UNREACHABLE
        ]);
        socket.end(response);
      });
    };

    const handshake = buffer => {
      //  +----+----------+----------+
      //  |VER | NMETHODS | METHODS  |
      //  +----+----------+----------+
      //  | 1  |    1     | 1 to 255 |
      //  +----+----------+----------+

      // SOCKS Version 5 is the only support version
      if (buffer[0] !== constants.VERSION) {
        console.error(`wrong socks version: ${buffer[0]}`);
        const response = Buffer.from([0x05, constants.REPLIES.GENERAL_FAILURE]);
        socket.end(response);
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
        console.log(
          "Unsuported authentication method -- disconnecting, method",
          buffer[2]
        );
        response[1] = constants.METHODS.NO_ACCEPTABLE_METHODS;
        socket.end(response);
      }

      socket.write(response, () => {
        socket.once("data", next);
      });
    };

    socket.on("error", err => {
      server.emit("error", err);
    });

    socket.once("data", handshake);
  });

  return server;
};

const createClient = options => {
  console.log(options);
  const { name, password } = options;

  const server = net.createServer(socket => {
    const handshakeClient = data => {
      socket.write(
        Buffer.from([constants.VERSION, constants.METHODS.NO_AUTHENTICATION])
      );
      console.log("Browser data ", data);

      socket.once("data", connectClient);
    };

    const connectServer = (mainServ, buffer) => {
      mainServ.once("data", data => {
        console.log("mainServ data ", data);
        const res = Buffer.from([
          constants.AUTH_VERSION,
          name.length,
          ...Buffer.from(name, "utf8"),
          password.length,
          ...Buffer.from(password, "utf8")
        ]);

        mainServ.write(res, () => {
          mainServ.once("data", data => {
            console.log("mainserv 2 data ", data);

            mainServ.write(buffer, () => {
              mainServ.pipe(socket);
              socket.pipe(mainServ);
            });
          });
        });
      });
    };

    const connectClient = buffer => {
      const cmd = buffer[1];
      const atyp = buffer[3];
      const addr = getAddress(buffer);
      const port = getPort(buffer);

      console.log("Browser 2 data", buffer[0], cmd, atyp, addr, port);
      console.log("Browser 2 data buffer ", buffer);

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
