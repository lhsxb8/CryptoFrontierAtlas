import {createRequire} from 'node:module';
const {checkVersion} = createRequire(import.meta.url)('../lib/node/release.cjs');
try {
  const version = checkVersion(undefined, {tag: process.env.ATLAS_RELEASE_TAG || ''});
  console.log(`PASS: application v${version}, lockfile, changelog and available citation agree.`);
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
