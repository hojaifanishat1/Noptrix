const { spawnSync } = require("node:child_process");
const path = require("node:path");

const backendDirectory = path.resolve(__dirname, "..");
const composeArgs = [
  "compose",
  "up",
  "-d",
  "--wait",
  "--wait-timeout",
  "30",
  "redis",
];

const runDocker = (args) => {
  const result = spawnSync("docker", args, {
    cwd: backendDirectory,
    encoding: "utf8",
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output) {
    process.stdout.write(output);
  }
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }

  return {
    status: result.status ?? 1,
    output,
  };
};

const volume = runDocker(["volume", "create", "noptrix_redis_data"]);
if (volume.status !== 0) {
  process.exitCode = volume.status;
} else {
  const startup = runDocker(composeArgs);

  if (startup.status === 0) {
    process.exitCode = 0;
  } else if (/RWLayer of container .+ is unexpectedly nil/.test(startup.output)) {
    console.warn(
      "Redis container has a corrupted Docker layer; recreating the container while preserving its data volume.",
    );

    const removal = runDocker(["rm", "-f", "noptrix-redis"]);
    if (removal.status !== 0) {
      process.exitCode = removal.status;
    } else {
      const retry = runDocker(composeArgs);
      process.exitCode = retry.status;
    }
  } else {
    process.exitCode = startup.status;
  }
}
