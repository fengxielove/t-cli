import { resolve } from 'path'

import { packageDirectorySync } from 'pkg-dir'
import npmInstall from 'npminstall'
import { pathExistsSync } from 'path-exists'
import { mkdirpSync } from 'fs-extra'

import { isObject } from '@t-cli/utils'
import { formatPath } from '@t-cli/format-path'
import npmlog from '@t-cli/log'
import { getDefaultRegistry, getNpmLatestVersion } from '@t-cli/get-npm-info'

export class Package {
	constructor(options) {
		if (!options) {
			throw new Error('Package类的options参数不能为空!')
		}
		if (!isObject(options)) {
			throw new Error('Package类的options参数必须为对象!')
		}
		// package的目标路径
		this.targetPath = options?.targetPath
		// package 缓存的路径 即 node_modules 路径
		this.storeDir = options?.storeDir
		// package 的 name
		this.packageName = options?.packageName
		// package 的 version
		this.packageVersion = options?.packageVersion

		// TODO: 在mac系统上，此字段暂时无用，后续验证 windows的情况
		this.cacheFilePathPrefix = this.packageName.replace('/', '+')
	}

	async prepare() {
		if (this.storeDir && !pathExistsSync(this.storeDir)) {
			mkdirpSync(this.storeDir, { recursive: true })
		}
		if (this.packageVersion === 'latest') {
			this.packageVersion = await getNpmLatestVersion(this.packageName)
			npmlog.verbose('从NPM处获取包名的最新版本', this.packageVersion)
		}
	}

	// 这里不需要拼接全路径地址，通过软链可以直接获取到
	get cacheFilePath() {
		// return resolve(
		// 	this.storeDir,
		// 	`${this.cacheFilePathPrefix}@${this.packageVersion}/node_modules/${this.packageName}`
		// )
		return resolve(this.storeDir, `${this.packageName}`)
	}

	// ⚠️FIX:BUG
	// 获取指定版本的缓存路径: 必须从 .store 中去拼接版本号获取，默认的软链指向的始终是旧版本的
	getSpecificCacheFilePath(packageVersion) {
		return resolve(
			this.storeDir,
			'.store',
			`${this.cacheFilePathPrefix}@${packageVersion}/node_modules/${this.packageName}`
		)
	}

	async exists() {
		if (this.storeDir) {
			await this.prepare()
			return pathExistsSync(this.cacheFilePath)
		} else {
			return pathExistsSync(this.targetPath)
		}
	}

	/**
	 *
	 */
	async install() {
		await this.prepare()
		return await npmInstall({
			root: this.targetPath,
			storeDir: this.storeDir,
			registry: getDefaultRegistry(),
			pkgs: [
				{
					name: this.packageName,
					version: this.packageVersion
				}
			]
		})
	}

	async update() {
		await this.prepare()
		// 	1.获取最新的版本号
		const latestPackageVersion = await getNpmLatestVersion(this.packageName)
		npmlog.verbose('NPM上最新版本号', latestPackageVersion)
		// 	2.查询最新版本号对应的路径是否存在
		const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
		npmlog.verbose('最新版本号在本地的拼接路径', latestFilePath)
		npmlog.verbose('最新版本号在本地是否存在', pathExistsSync(latestFilePath))
		// 	3.如果不存在，则更新(安装)
		if (!pathExistsSync(latestFilePath)) {
			await npmInstall({
				root: this.targetPath,
				storeDir: this.storeDir,
				registry: getDefaultRegistry(),
				pkgs: [
					{
						name: this.packageName,
						version: latestPackageVersion
					}
				]
			})
		}
		// 	更新了最新版本后，修改版本号
		this.packageVersion = latestPackageVersion
	}

	/**
	 * 获取入口文件的路径
	 *    1. 通过 package.json 所在目录，来获取到根目录 use pkg-dir plugin
	 *    2. 读取 package.json
	 *    3. 按顺序找：main 、lib，确定最终的执行文件路径
	 *    4. 路径的兼容（macOS / windows）
	 */
	async getRootFilePath() {
		const _getRootFile = async (needPath) => {
			const dir = packageDirectorySync({ cwd: needPath })
			if (dir) {
				const packageJsonFile = (
					await import(resolve(dir, 'package.json'), {
						assert: { type: 'json' }
					})
				).default
				if (packageJsonFile && packageJsonFile.main) {
					return formatPath(resolve(dir, packageJsonFile.main))
				}
			}
			return null
		}

		// 使用缓存的情况
		if (this.storeDir) {
			npmlog.verbose(
				'使用缓存的时入口文件地址',
				await _getRootFile(this.cacheFilePath)
			)
			return await _getRootFile(this.cacheFilePath)
		} else {
			// 没有缓存的情况
			npmlog.verbose(
				'不使用缓存的时入口文件地址',
				await _getRootFile(this.targetPath)
			)
			return await _getRootFile(this.targetPath)
		}
	}
}
