const proxy = require("../index");

const setting = {
  host: "217.160.63.243", // 217.160.63.243
  port: "5550", // 5550 for prod, 1080 for dev
  name: "lexa12",
  password: "darksouls3"
};

const server = proxy.createClient(setting);
server.listen(2080);

setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const perfomance = {
    heapTotal: `${memoryUsage.heapTotal / (1024 * 1024)}mb`,
    heapUsed: `${memoryUsage.heapUsed / (1024 * 1024)}mb`,
    rss: `${memoryUsage.rss / (1024 * 1024)}mb`
  };
  console.log(" \n\n\n Process ", perfomance, "\n\n\n");
}, 2000);

server.on("error", err => console.error(`Client Server Error ---> ${err}`));
