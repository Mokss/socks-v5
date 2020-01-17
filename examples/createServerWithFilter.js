const socks5 = require("../index");

const setAddr = new Set(["tools.ietf.org", "github.com", "2ip.ru"]);

const server = socks5.createServer({
  filter(addr) {
    const result = !setAddr.has(addr);
    if (!result) console.log(`host ${addr} unreachable`);
    return result;
  }
});

server.listen(1080);

server.on("connect", info =>
  console.log(`connected to remote server at ${info.addr}:${info.port}`)
);

server.on("listening", () => {
  console.log(
    `server listening ${server.address().address}:${server.address().port}`
  );
});

server.on("connection", socket => {
  console.log("new socks connection", socket.remoteAddress, socket.remotePort);
});

server.on("data", data => console.log(data));

server.on("error", err => {
  console.error("server ERROR --->", err);
});
