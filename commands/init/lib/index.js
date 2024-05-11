import { readdirSync } from 'fs'
import { resolve } from 'path'

import inquirer from 'inquirer'
import { emptyDirSync } from 'fs-extra'
import { valid } from 'semver'
import userHome from 'userhome'

import Command from '@t-cli/command'
import npmlog from '@t-cli/log'
import { Package } from '@t-cli/package'
import { spinnerStart } from '@t-cli/utils'

import { getNpmTemplates } from './getTemplates.js'

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

export class InitCommand extends Command {
	init() {
		this.projectName = this._argv[0] || ''
		this.force = !!this._cmd.getOptionValue('force')
		npmlog.verbose('projectName', this.projectName)
		npmlog.verbose('force', this.force)
	}

	async exec() {
		try {
			// 	1. 准备阶段
			const projectInfo = await this.prepare()
			this.projectInfo = projectInfo
			if (projectInfo) {
				npmlog.verbose('projectInfo', projectInfo)
				// 	2. 下载模版
				await this.downloadTemplate()
				// 	3. 安装模板
			}
		} catch (e) {
			npmlog.error(e)
		}
	}

	async prepare() {
		this.templates = await getNpmTemplates()
		if (!this.templates || this.templates.length === 0) {
			throw new Error('项目模板不存在')
		}
		const localPath = process.cwd()
		// 	1. 判断当前目录是否为空
		if (!this.isDirEmpty(localPath)) {
			let isContinue = false
			if (!this.force) {
				// 	1.1 如果不为空，询问是否继续创建，并清空文件夹
				isContinue = (
					await inquirer.prompt({
						type: 'confirm',
						name: 'isContinue',
						default: false,
						message: '当前文件夹不为空，是否继续创建项目'
					})
				).isContinue
				if (!isContinue) return
			}
			if (isContinue || this.force) {
				const { confirmDelete } = await inquirer.prompt({
					type: 'confirm',
					name: 'confirmDelete',
					default: false,
					message: '是否确认清空当前文件夹下的所有内容'
				})
				if (confirmDelete) {
					// 	清空文件夹
					emptyDirSync(localPath)
				}
			}
		}
		return await this.getProjectInfo()
	}

	isDirEmpty(localPath) {
		npmlog.info('localPath', localPath)
		const fileList = readdirSync(localPath).filter(
			(file) => !file.startsWith('.') && !['node_modules'].includes(file)
		)
		npmlog.info('fileList', fileList)
		return !fileList || fileList.length <= 0
	}

	async getProjectInfo() {
		let projectInfo = null
		const { type } = await inquirer.prompt({
			type: 'list',
			name: 'type',
			message: '请选择初始化类型',
			default: TYPE_PROJECT,
			choices: [
				{
					name: '项目',
					value: TYPE_PROJECT
				},
				{
					name: '组件',
					value: TYPE_COMPONENT
				}
			]
		})

		if (type === TYPE_PROJECT) {
			const project = await inquirer.prompt([
				{
					type: 'input',
					name: 'projectName',
					message: '请输入项目名称',
					default: '',
					validate: function (v) {
						const done = this.async()
						// 1.首字符必须为英文字符
						// 2.尾字符必须为英文或数字，不能为空字符
						// 3.字符仅允许"-_"
						// 合法：a, a-b, a_b,a-b-c,a_b_c, a-b1-c1, a_b1_c1
						// 不合法：1,a_,a-,a_1,a-1
						const regExp =
							/^[a-zA-Z]+(-[a-zA-Z][a-zA-Z0-9]*|_[a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/
						if (regExp.test(v)) {
							done(null, true)
						} else {
							done('请输入合法的项目名')
						}
					}
				},
				{
					type: 'input',
					name: 'projectVersion',
					message: '请输入项目版本号',
					default: '1.0.0',
					validate: function (v) {
						const done = this.async()
						if (valid(v)) {
							done(null, true)
						} else {
							done('请输入合法的版本号')
						}
					},
					filter: function (v) {
						return valid(v) ? valid(v) : v
					}
				},
				{
					type: 'list',
					name: 'projectTemplate',
					message: '请选择项目模板',
					choices: this.createTemplateChoice()
				}
			])

			projectInfo = {
				type,
				...project
			}
		} else if (type === TYPE_COMPONENT) {
		}

		return projectInfo
	}

	createTemplateChoice() {
		return this.templates.map((item) => ({
			value: item.npmName,
			name: item.name
		}))
	}

	/**
	 * 1.通过项目模板API获取项目模板信息
	 * 1.1.通过midway搭建接口
	 * 1.2.通过npm存储项目模板
	 * 1.3.通过midway获取mongodb中的数据并返回
	 * @returns {Promise<void>}
	 */
	async downloadTemplate() {
		const { projectTemplate } = this.projectInfo
		const templateInfo = this.templates.find(
			(item) => item.npmName === projectTemplate
		)
		const targetPath = resolve(userHome(), '.t-cli', 'template')
		const storeDir = resolve(userHome(), '.t-cli', 'template', 'node_modules')
		const { npmName, version } = templateInfo
		const templateNpm = new Package({
			targetPath,
			storeDir,
			packageName: npmName,
			packageVersion: version
		})
		npmlog.verbose('templateNpm', templateNpm)
		// 如果本地没有就安装
		if (!(await templateNpm.exists())) {
			const spinner = spinnerStart()
			try {
				await templateNpm.install()
				spinner.succeed('模版下载成功!')
			} catch (error) {
				npmlog.error(error.message)
				spinner.fail('模版下载失败，请检查版本号')
			}
		} else {
			const spinner = spinnerStart()
			try {
				await templateNpm.update()
				spinner.succeed('模版更新成功!')
			} catch (error) {
				npmlog.error(error.message)
				spinner.fail('模版更新失败，请检查版本号')
			}
		}
	}
}

/**
 * 默认导出 init 初始化的执行函数，在入口文件那里动态导入执行
 */
const init = (args) => {
	return new InitCommand(args)
}

export default init
