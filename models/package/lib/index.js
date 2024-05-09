import { resolve } from 'path'

import { packageDirectorySync } from 'pkg-dir'
import npmInstall from 'npminstall'
import { pathExistsSync } from 'path-exists'
import { mkdirpSync } from 'fs-extra'

import { isObject } from '@t-cli/utils'
import { formatPath } from '@t-cli/format-path'
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

		this.cacheFilePathPrefix = this.packageName.replace('/', '+')
	}

	async prepare() {
		if (this.storeDir && !pathExistsSync(this.storeDir)) {
			mkdirpSync(this.storeDir, { recursive: true })
		}
		if (this.packageVersion === 'latest') {
			this.packageVersion = await getNpmLatestVersion(this.packageName)
			console.log('准备阶段获取最新的版本号', this.packageVersion)
		}
	}

	get cacheFilePath() {
		return resolve(
			this.storeDir,
			'.store',
			`${this.cacheFilePathPrefix}@${this.packageVersion}/node_modules/${this.packageName}`
		)
	}

	// 获取指定版本的 缓存路径
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
		console.log('最新版本号', latestPackageVersion)
		// 	2.查询最新版本号对应的路径是否存在
		const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
		console.log('最新版本号路径', latestFilePath)
		console.log('最新版本号路径是否存在', pathExistsSync(latestFilePath))
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
			// 	更新了最新版本后，修改版本号
			this.packageVersion = latestPackageVersion
		}
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
			console.log('needPath', needPath)
			const dir = packageDirectorySync({ cwd: needPath })
			console.log('dir', dir)
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
			console.log('使用缓存的时入口文件地址', _getRootFile(this.cacheFilePath))
			return _getRootFile(this.cacheFilePath)
		} else {
			// 没有缓存的情况
			console.log('不使用缓存的时入口文件地址', _getRootFile(this.targetPath))
			return _getRootFile(this.targetPath)
		}
	}
}
