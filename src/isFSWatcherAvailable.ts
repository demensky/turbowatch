/* eslint-disable canonical/filename-match-regex */

import { platform } from 'node:os';
import * as semver from 'semver';

const isMacOs = () => {
  return platform() === 'darwin';
};

const isLinux = () => {
  return platform() === 'linux';
};

export const isFSWatcherAvailable = () => {
  return semver.gte(process.version, '19.1.0') && (isMacOs() || isLinux());
};
