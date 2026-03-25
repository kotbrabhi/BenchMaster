const REQUIRED_NODE = '20.19.0';
const currentVersion = process.versions.node;

function parseVersion(version) {
  return version.split('.').map((segment) => Number.parseInt(segment, 10) || 0);
}

function compareVersions(left, right) {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

if (compareVersions(parseVersion(currentVersion), parseVersion(REQUIRED_NODE)) < 0) {
  console.error('');
  console.error(`BenchMaster requires Node.js ${REQUIRED_NODE} or newer.`);
  console.error(`Current runtime: ${currentVersion}`);
  console.error('');
  console.error('Angular CLI 21 will not build on Node 20.10.0.');
  console.error('Switch to the pinned project runtime, then rerun your command:');
  console.error('');
  console.error('  nvm use');
  console.error('  volta install node@20.19.0');
  console.error('  asdf install');
  console.error('');
  console.error('The repository includes .nvmrc, .node-version, and .tool-versions.');
  process.exit(1);
}
