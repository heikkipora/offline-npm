import errors from 'request-promise/errors'
import {fetchUrl} from './client'
import path from 'path'
import Promise from 'bluebird'
import semver from 'semver'
import url from 'url'

const fs = Promise.promisifyAll(require('fs'))

export function hasPrebuiltBinaries({binary}) {
  return binary && binary.module_name
}

export async function downloadPrebuiltBinaries(versionMetadata, localFolder, prebuiltBinaryProperties) {
  const {binary, name, version} = versionMetadata

  for (const {abi, arch, platform} of prebuiltBinaryProperties) {
    try {
      const data = await fetchPrebuiltBinary(name, version, binary, abi, platform, arch)
      await fs.writeFileAsync(prebuiltBinaryFilePath(name, version, binary, abi, platform, arch, localFolder), data)
    } catch (err) {
      // Pre-built binaries are commonly not available on all platforms
      if (err.statusCode !== 404) {
        throw err
      }
    }
  }
}

function fetchPrebuiltBinary(name, version, binary, abi, platform, arch) {
  return fetchUrl(prebuiltBinaryUrl(name, version, binary, abi, platform, arch), true)
}

function prebuiltBinaryFilePath(name, version, binary, abi, platform, arch, localFolder) {
  return path.join(localFolder, prebuiltBinaryFileName(name, version, binary, abi, platform, arch))
}

function prebuiltBinaryUrl(name, version, binary, abi, platform, arch) {
  const remotePath = prebuiltBinaryRemotePath(name, version, binary, abi, platform, arch)
  const fileName = prebuiltBinaryFileName(name, version, binary, abi, platform, arch)
  return url.resolve(binary.host, remotePath + fileName)
}

function prebuiltBinaryRemotePath(name, version, binary, abi, platform, arch) {
  return formatPrebuilt(binary.remote_path, name, version, binary.module_name, abi, platform, arch)
}

function prebuiltBinaryFileName(name, version, binary, abi, platform, arch) {
  return formatPrebuilt(binary.package_name, name, version, binary.module_name, abi, platform, arch)
}

// see node-pre-gyp: /lib/util/versioning.js for documentation of possible values
function formatPrebuilt(formatString, name, version, moduleName, abi, platform, arch) {
  const moduleVersion = semver.parse(version)
  const prerelease = (moduleVersion.prerelease || []).join('.')
  const build = (moduleVersion.build || []).join('.')

  return formatString
    .replace('{name}', name)
    .replace('{version}', version)
    .replace('{major}', moduleVersion.major)
    .replace('{minor}', moduleVersion.minor)
    .replace('{patch}', moduleVersion.patch)
    .replace('{prerelease}', prerelease)
    .replace('{build}', build)
    .replace('{module_name}', moduleName)
    .replace('{node_abi}', `node-v${abi}`)
    .replace('{platform}', platform)
    .replace('{arch}', arch)
    .replace('{configuration}', 'Release')
    .replace('{toolset}', '')
    .replace(/[\/]+/g, '/')
}