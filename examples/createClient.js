const { createClient } = require("../index");

const setting = {
  host: "127.0.0.1", // your socks 5 verison server
  port: "1080", // port your server
  login: "foo",
  password: "bar"
};

const server = createClient(setting);
server.listen(2080);

server.on("listening", () => {
  console.log(
    `server listening ${server.address().address}:${server.address().port}`
  );
});

server.on("error", err => console.error("Client Server Error --->", err));
