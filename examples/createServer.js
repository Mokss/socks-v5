const socks5 = require("../index");

// const setAddr = new Set(["tools.ietf.org"]);

const server = socks5.createServer({
  authenticate(name, password) {
    // verify name/password
    if (name !== "lexa12" || password !== "darksouls3") {
      console.log("Пшел на хуй", name, password);
      // respond with auth failure (can be any error)
      return true;
    }
    // return successful authentication
    return false;
  }
  // filter(addr) {
  //   console.log(addr);
  //   return setAddr.has(addr);
  // }
});

server.listen(5550); // 5550 for prod, 1080 for dev

server.on("connect", info =>
  console.log(`connected to remote server at ${info.addr}:${info.port}`)
);

server.on("listening", () => {
  console.log(
    `server listening ${server.address().address}:${server.address().port}`
  );
});

server.on("connection", socket => {
  console.log("connection", socket.remoteAddress, socket.remotePort);
});

// server.on("data", data => console.log(data));

server.on("error", err => {
  console.error("server ERROR");
  console.error(err);
});
