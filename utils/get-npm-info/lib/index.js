import axios from 'axios'
import urlJoin from 'url-join'
import semver from 'semver'

export const getNpmInfo = async (npmName, registry) => {
	console.log(npmName)
	if (!npmName) return null

	registry = registry || getDefaultRegistry()
	const npmInfoUrl = urlJoin(registry, npmName)
	const result = await axios.get(npmInfoUrl)
	if (result.status === 200) {
		return result.data
	}
	return null
}

export const getDefaultRegistry = (isOriginal = true) => {
	return isOriginal
		? 'https://registry.npmjs.org'
		: 'https://registry.npmmirror.com/'
}

export const getNpmVersions = async (npmName, registry) => {
	const data = await getNpmInfo(npmName, registry)
	if (data) {
		return Object.keys(data.versions)
	} else {
		return []
	}
}

// 获取比本地新的所有版本号
export const getNpmSemverVersions = (baseVersion, versions) => {
	return versions
		.filter((version) => semver.satisfies(version, `^${baseVersion}`))
		.sort((a, b) => (semver.gt(b, a) ? 1 : semver.lt(b, a) ? -1 : 0))
}

export const getNpmSemverVersion = async (
	baseVersion,
	npmName,
	registry = ''
) => {
	const versions = await getNpmVersions(npmName, registry)
	const newVersions = getNpmSemverVersions(baseVersion, versions)
	if (newVersions && newVersions.length) {
		return newVersions[0]
	}
}

export const getNpmLatestVersion = async (npmName, registry) => {
	const versions = await getNpmVersions(npmName, registry)
	if (versions) {
		return versions.sort((a, b) =>
			semver.gt(b, a) ? 1 : semver.lt(b, a) ? -1 : 0
		)[0]
	}
	return null
}
